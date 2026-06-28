import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Ticket } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    fetchBookings();
  }, [authLoading]);

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data.bookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="my-bookings-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl font-bold mb-8"
          data-testid="bookings-title"
        >
          My Bookings
        </motion.h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-400">Loading...</div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16" data-testid="no-bookings">
            <Ticket className="h-16 w-16 mx-auto mb-4 text-zinc-600" strokeWidth={1.5} />
            <p className="text-xl text-zinc-400 mb-4">No bookings yet</p>
            <a href="/movies" className="text-red-500 hover:text-red-400">Browse Movies</a>
          </div>
        ) : (
          <div className="space-y-6" data-testid="bookings-list">
            {bookings.map((booking, idx) => (
              <motion.div
                key={booking._id}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="glassmorphism rounded-xl p-6"
                data-testid={`booking-card-${idx}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center space-x-4">
                    <img
                      src={booking.movie.poster}
                      alt={booking.movie.title}
                      className="w-24 h-36 object-cover rounded-lg"
                    />
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{booking.movie.title}</h3>
                      <p className="text-sm text-zinc-400">{booking.movie.genre}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-zinc-300">
                      <Calendar className="h-5 w-5 text-red-500" strokeWidth={1.5} />
                      <span>{new Date(booking.show.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-zinc-300">
                      <MapPin className="h-5 w-5 text-red-500" strokeWidth={1.5} />
                      <span>{booking.show.time}</span>
                    </div>
                    <div>
                      <p className="text-sm text-zinc-400 mb-2">Seats:</p>
                      <div className="flex flex-wrap gap-2">
                        {booking.seats.map((seat) => (
                          <span
                            key={seat}
                            className="px-3 py-1 bg-red-600/20 text-red-500 rounded-md text-sm font-semibold"
                          >
                            {seat}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between items-end">
                    <div>
                      <p className="text-sm text-zinc-400 mb-1">Booking Reference</p>
                      <p className="text-lg font-bold text-red-500">{booking.bookingReference}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zinc-400 mb-1">Total Amount</p>
                      <p className="text-2xl font-bold">${booking.totalAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookings;