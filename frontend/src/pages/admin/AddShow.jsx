import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, DollarSign, X } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AddShow = () => {
  const { token } = useAuth();
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [price, setPrice] = useState('');
  const [showSlots, setShowSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ date: '', time: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      const [regular, trending] = await Promise.all([
        axios.get(`${API_URL}/api/movies`),
        axios.get(`${API_URL}/api/movies/trending`)
      ]);
      setMovies([...regular.data.movies, ...trending.data.movies]);
    } catch (error) {
      console.error('Error fetching movies:', error);
      toast.error('Failed to load movies');
    }
  };

  const addShowSlot = () => {
    if (!newSlot.date || !newSlot.time) {
      toast.error('Please select both date and time');
      return;
    }
    setShowSlots([...showSlots, { ...newSlot }]);
    setNewSlot({ date: '', time: '' });
  };

  const removeShowSlot = (index) => {
    setShowSlots(showSlots.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedMovie) {
      toast.error('Please select a movie');
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    if (showSlots.length === 0) {
      toast.error('Please add at least one show slot');
      return;
    }

    setLoading(true);
    try {
      for (const slot of showSlots) {
        await axios.post(
          `${API_URL}/api/shows`,
          {
            movieId: selectedMovie._id,
            date: slot.date,
            time: slot.time,
            price: parseFloat(price)
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      toast.success('Shows added successfully!');
      setSelectedMovie(null);
      setPrice('');
      setShowSlots([]);
    } catch (error) {
      console.error('Error adding shows:', error);
      toast.error(error.response?.data?.error || 'Failed to add shows');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="add-show-page">
      <h1 className="text-4xl font-bold mb-8" data-testid="add-show-title">Add Shows</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Movie Selection */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Select Movie</h2>
          <div className="flex overflow-x-auto space-x-4 pb-4" data-testid="movie-selection">
            {movies.map((movie) => (
              <button
                key={movie._id}
                type="button"
                onClick={() => setSelectedMovie(movie)}
                className={`flex-shrink-0 w-40 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                  selectedMovie?._id === movie._id ? 'border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.5)]' : 'border-white/10 hover:border-red-500'
                }`}
                data-testid={`movie-select-${movie._id}`}
              >
                <img src={movie.poster} alt={movie.title} className="w-full h-56 object-cover" />
                <div className="p-3 bg-zinc-900">
                  <p className="text-sm font-semibold line-clamp-1">{movie.title}</p>
                </div>
              </button>
            ))}
          </div>
          {selectedMovie && (
            <div className="mt-4 p-4 glassmorphism rounded-lg">
              <p className="text-zinc-400">Selected: <span className="text-white font-semibold">{selectedMovie.title}</span></p>
            </div>
          )}
        </div>

        {/* Price */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Show Price</h2>
          <div className="max-w-md">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" strokeWidth={1.5} />
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Enter price per ticket"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                data-testid="price-input"
              />
            </div>
          </div>
        </div>

        {/* Date & Time */}
        <div>
          <h2 className="text-2xl font-semibold mb-4">Add Show Timings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mb-4">
            <div>
              <input
                type="date"
                value={newSlot.date}
                onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                data-testid="date-input"
              />
            </div>
            <div>
              <input
                type="time"
                value={newSlot.time}
                onChange={(e) => setNewSlot({ ...newSlot, time: e.target.value })}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                data-testid="time-input"
              />
            </div>
            <button
              type="button"
              onClick={addShowSlot}
              className="bg-red-600 hover:bg-red-500 px-6 py-3 rounded-lg font-semibold transition-all active:scale-95"
              data-testid="add-slot-button"
            >
              Add Slot
            </button>
          </div>

          {/* Show Slots List */}
          {showSlots.length > 0 && (
            <div className="space-y-2" data-testid="show-slots-list">
              <h3 className="font-semibold mb-2">Added Slots:</h3>
              {showSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 glassmorphism rounded-lg"
                  data-testid={`show-slot-${idx}`}
                >
                  <div className="flex items-center space-x-4">
                    <Calendar className="h-5 w-5 text-red-500" strokeWidth={1.5} />
                    <span>{new Date(slot.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span className="text-zinc-400">at</span>
                    <span className="font-semibold">{slot.time}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeShowSlot(idx)}
                    className="text-red-500 hover:text-red-400"
                    data-testid={`remove-slot-${idx}`}
                  >
                    <X className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="bg-red-600 hover:bg-red-500 px-8 py-3 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="submit-shows-button"
        >
          {loading ? 'Adding Shows...' : 'Add Shows'}
        </button>
      </form>
    </div>
  );
};

export default AddShow;