import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, DollarSign } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ListShows = () => {
  const { token } = useAuth();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchShows();
  }, []);

  const fetchShows = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/shows`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShows(response.data.shows);
    } catch (error) {
      console.error('Error fetching shows:', error);
      toast.error('Failed to load shows');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="list-shows-page">
      <h1 className="text-4xl font-bold mb-8" data-testid="list-shows-title">All Shows</h1>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-400">Loading...</div>
        </div>
      ) : shows.length === 0 ? (
        <div className="text-center py-16 text-zinc-400" data-testid="no-shows">
          No shows available
        </div>
      ) : (
        <div className="overflow-x-auto" data-testid="shows-table">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 px-4">Movie Name</th>
                <th className="text-left py-4 px-4">Show Time</th>
                <th className="text-left py-4 px-4">Price</th>
                <th className="text-left py-4 px-4">Booked Seats</th>
                <th className="text-left py-4 px-4">Total Bookings</th>
                <th className="text-left py-4 px-4">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {shows.map((show, idx) => (
                <motion.tr
                  key={show._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border-b border-white/5 hover:bg-white/5"
                  data-testid={`show-row-${idx}`}
                >
                  {/* <td className="py-4 px-4">
                    <div className="font-semibold">{show.movie.title}</div>
                  </td> */}
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="h-4 w-4 text-red-500" strokeWidth={1.5} />
                      <span>{new Date(show.date).toLocaleDateString()}</span>
                      <Clock className="h-4 w-4 text-red-500 ml-2" strokeWidth={1.5} />
                      <span>{show.time}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4" strokeWidth={1.5} />
                      <span>{show.price}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-zinc-400">{show.bookedSeats}/{show.totalSeats}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold">{show.bookingsCount}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-bold text-green-500">${show.revenue.toFixed(2)}</div>
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

export default ListShows;