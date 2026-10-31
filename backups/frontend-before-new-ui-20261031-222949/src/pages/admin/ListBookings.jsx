import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, DollarSign } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ListBookings = () => {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/bookings`, {
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
    <div data-testid="list-bookings-page">
      <h1 className="text-4xl font-bold mb-8" data-testid="list-bookings-title">All Bookings</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-400">Loading...</div>
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 text-zinc-400" data-testid="no-bookings">
          No bookings yet
        </div>
      ) : (
        <div className="overflow-x-auto" data-testid="bookings-table">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-4">User Name</th>
                <th className="text-left py-4 px-4">Email</th>
                <th className="text-left py-4 px-4">Movie Name</th>
                <th className="text-left py-4 px-4">Show Time</th>
                <th className="text-left py-4 px-4">Seats</th>
                <th className="text-left py-4 px-4">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking, idx) => (
                <motion.tr
                  key={booking._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/5"
                  data-testid={`booking-row-${idx}`}
                >
                  <td className="py-4 px-4">
                    <div className="font-semibold">{booking.user.name}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm text-zinc-400">{booking.user.email}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold">{booking.movie.title}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="h-4 w-4 text-red-500" strokeWidth={1.5} />
                      <span>{new Date(booking.show.date).toLocaleDateString()}</span>
                      <Clock className="h-4 w-4 text-red-500 ml-2" strokeWidth={1.5} />
                      <span>{booking.show.time}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap gap-1">
                      {booking.seats.map((seat) => (
                        <span key={seat} className="px-2 py-1 bg-red-600/20 text-red-500 rounded text-xs font-semibold">
                          {seat}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-green-500 flex items-center">
                      <DollarSign className="h-4 w-4" strokeWidth={1.5} />
                      {booking.totalAmount.toFixed(2)}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ListBookings;