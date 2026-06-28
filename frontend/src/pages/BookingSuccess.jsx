import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Ticket } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BookingSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();
  const { token } = useAuth();
  const [verified, setVerified] = React.useState(false);
  const [booking, setBooking] = React.useState(null);

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/api/bookings/verify-payment`,
        { sessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBooking(response.data.booking);
      setVerified(true);
      toast.success('Payment verified successfully!');
    } catch (error) {
      console.error('Payment verification error:', error);
      toast.error('Failed to verify payment');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 flex items-center justify-center" data-testid="booking-success-page">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl w-full glassmorphism rounded-2xl p-8 text-center"
      >
        <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-6" strokeWidth={1.5} />
        <h1 className="text-4xl font-bold mb-4" data-testid="success-title">Booking Confirmed!</h1>
        <p className="text-xl text-zinc-400 mb-8">Your movie tickets have been successfully booked.</p>

        {verified && booking && (
          <div className="bg-zinc-900 rounded-xl p-6 mb-8 text-left" data-testid="booking-details">
            <h2 className="text-2xl font-semibold mb-4">Booking Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">Booking Reference:</span>
                <span className="font-bold text-red-500">{booking.bookingReference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Movie:</span>
                <span className="font-semibold">{booking.movie.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Seats:</span>
                <span className="font-semibold">{booking.seats.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total Amount:</span>
                <span className="font-bold text-xl">${booking.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => navigate('/my-bookings')}
            className="inline-flex items-center justify-center rounded-full bg-red-600 px-8 py-3 font-semibold text-white transition-all hover:bg-red-500 active:scale-95"
            data-testid="view-bookings-button"
          >
            <Ticket className="mr-2 h-5 w-5" strokeWidth={1.5} />
            View My Bookings
          </button>
          <button
            onClick={() => navigate('/movies')}
            className="inline-flex items-center justify-center rounded-full bg-white/10 px-8 py-3 font-semibold text-white transition-all hover:bg-white/20 active:scale-95 backdrop-blur-md"
            data-testid="browse-movies-button"
          >
            Browse More Movies
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default BookingSuccess;