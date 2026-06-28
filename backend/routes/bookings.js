const express = require('express');
const Booking = require('../models/Booking');
const Show = require('../models/Show');
const Movie = require('../models/Movie');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendBookingConfirmation } = require('../utils/email');
const { createCheckoutSession, verifyPayment } = require('../utils/stripe');

const router = express.Router();

// Create checkout session
router.post('/checkout', auth, async (req, res) => {
  try {
    const { showId, seats, originUrl } = req.body;

    if (!showId || !seats || seats.length === 0) {
      return res.status(400).json({ error: 'Show ID and seats are required' });
    }

    const show = await Show.findById(showId).populate('movie');
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }

    // Check if seats are already booked
    const alreadyBooked = seats.some(seat => show.bookedSeats.includes(seat));
    if (alreadyBooked) {
      return res.status(400).json({ error: 'Some seats are already booked' });
    }

    const totalAmount = show.price * seats.length;
    const bookingReference = `BMS${Date.now()}`;

    // Create pending booking
    const booking = new Booking({
      user: req.userId,
      show: showId,
      movie: show.movie._id,
      seats,
      totalAmount,
      bookingReference,
      paymentStatus: 'pending'
    });

    await booking.save();

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      bookingId: booking._id.toString(),
      amount: totalAmount,
      movieTitle: show.movie.title,
      seats: seats.join(', '),
      originUrl
    });

    booking.sessionId = session.id;
    await booking.save();

    res.json({ 
      sessionUrl: session.url, 
      bookingReference 
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Verify payment
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const booking = await Booking.findOne({ sessionId })
      .populate('show')
      .populate('movie')
      .populate('user');

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.paymentStatus === 'completed') {
      return res.json({ 
        message: 'Payment already verified', 
        booking 
      });
    }

    const paymentStatus = await verifyPayment(sessionId);

    if (paymentStatus.status === 'complete') {
      booking.paymentStatus = 'completed';
      booking.paymentId = sessionId;
      await booking.save();

      // Update show's booked seats
      const show = await Show.findById(booking.show._id);
      show.bookedSeats.push(...booking.seats);
      await show.save();

      // Send confirmation email
      try {
        await sendBookingConfirmation({
          email: booking.user.email,
          name: booking.user.name,
          bookingReference: booking.bookingReference,
          movieTitle: booking.movie.title,
          movieRating: booking.movie.rating,
          showDate: new Date(show.date).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          showTime: show.time,
          seats: booking.seats,
          totalAmount: booking.totalAmount,
          theaterName: show.theater.name,
          theaterAddress: show.theater.address
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }

      return res.json({ 
        message: 'Payment verified successfully', 
        booking 
      });
    } else {
      booking.paymentStatus = 'failed';
      await booking.save();
      return res.status(400).json({ error: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Get user bookings
router.get('/my-bookings', auth, async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      user: req.userId,
      paymentStatus: 'completed'
    })
      .populate('movie')
      .populate('show')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    console.error('Fetch bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

module.exports = router;