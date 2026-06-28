import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Star, Clock } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Favorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    fetchFavorites();
  }, [authLoading]);

  const fetchFavorites = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies/favorites/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFavorites(response.data.favorites);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (movieId) => {
    try {
      await axios.post(
        `${API_URL}/api/movies/${movieId}/favorite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFavorites(favorites.filter(fav => fav._id !== movieId));
      toast.success('Removed from favorites');
    } catch (error) {
      toast.error('Failed to remove favorite');
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="favorites-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl font-bold mb-8"
          data-testid="favorites-title"
        >
          My Favorites
        </motion.h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-zinc-400">Loading...</div>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16" data-testid="no-favorites">
            <Heart className="h-16 w-16 mx-auto mb-4 text-zinc-600" strokeWidth={1.5} />
            <p className="text-xl text-zinc-400 mb-4">No favorites yet</p>
            <Link to="/movies" className="text-red-500 hover:text-red-400">Browse Movies</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6" data-testid="favorites-grid">
            {favorites.map((movie, idx) => (
              <motion.div
                key={movie._id}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="relative group"
                data-testid={`favorite-card-${idx}`}
              >
                <Link
                  to={`/movie/${movie._id}`}
                  className="block overflow-hidden rounded-xl bg-zinc-900 border border-white/5 transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_8px_30px_rgba(220,38,38,0.2)]"
                >
                  <div className="aspect-[2/3] overflow-hidden">
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2 line-clamp-1">{movie.title}</h3>
                    <div className="flex items-center justify-between text-sm text-zinc-400">
                      <div className="flex items-center space-x-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" strokeWidth={1.5} />
                        <span>{movie.avgRating}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" strokeWidth={1.5} />
                        <span>{movie.duration}</span>
                      </div>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => removeFavorite(movie._id)}
                  className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-sm rounded-full hover:bg-black/80 transition-all"
                  data-testid={`remove-favorite-${idx}`}
                >
                  <Heart className="h-5 w-5 fill-red-500 text-red-500" strokeWidth={1.5} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;