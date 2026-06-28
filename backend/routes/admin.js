const express = require('express');
const Booking = require('../models/Booking');
const Show = require('../models/Show');
const User = require('../models/User');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const totalRevenue = await Booking.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const totalBookings = await Booking.countDocuments({ paymentStatus: 'completed' });
    const activeShows = await Show.countDocuments({ date: { $gte: new Date() } });
    const totalUsers = await User.countDocuments({ role: 'user' });

    res.json({
      stats: {
        totalRevenue: totalRevenue[0]?.total || 0,
        totalBookings,
        activeShows,
        totalUsers
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get all bookings (Admin)
router.get('/bookings', adminAuth, async (req, res) => {
  try {
    const bookings = await Booking.find({ paymentStatus: 'completed' })
      .populate('user', 'name email')
      .populate('movie', 'title')
      .populate('show', 'date time')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    console.error('Fetch all bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get all shows (Admin)
router.get('/shows', adminAuth, async (req, res) => {
  try {
    const shows = await Show.find()
      .populate('movie', 'title')
      .sort({ date: -1, time: -1 });

    // Calculate bookings count and revenue for each show
    const showsWithStats = await Promise.all(
      shows.map(async (show) => {
        const bookings = await Booking.countDocuments({
          show: show._id,
          paymentStatus: 'completed'
        });

        const revenue = await Booking.aggregate([
          { $match: { show: show._id, paymentStatus: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        return {
          _id: show._id,
          movie: show.movie,
          date: show.date,
          time: show.time,
          price: show.price,
          totalSeats: show.totalSeats,
          bookedSeats: show.bookedSeats.length,
          bookingsCount: bookings,
          revenue: revenue[0]?.total || 0
        };
      })
    );

    res.json({ shows: showsWithStats });
  } catch (error) {
    console.error('Fetch all shows error:', error);
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

module.exports = router;