import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Clock, Calendar, Heart, Play, Ticket, User, Clapperboard } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MovieDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, isAuthenticated } = useAuth();
  const { updateBooking } = useBooking();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    fetchMovie();
  }, [id]);

  const fetchMovie = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies/${id}`);
      setMovie(response.data.movie);
    } catch (error) {
      console.error('Error fetching movie:', error);
      toast.error('Failed to load movie details');
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to add favorites');
      navigate('/auth');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/api/movies/${id}/favorite`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsFavorite(response.data.isFavorite);
      toast.success(response.data.message);
    } catch (error) {
      toast.error('Failed to update favorites');
    }
  };

  const handleBookTickets = () => {
    updateBooking({ movie });
    navigate(`/booking/${id}`);
  };

  const handleWatchTrailer = () => {
    if (movie?.trailer) {
      window.open(movie.trailer, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-xl text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-xl text-zinc-400">Movie not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="movie-details-page">
      {/* Hero Banner */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative min-h-screen flex items-center overflow-hidden"
        data-testid="movie-hero"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${movie.banner || movie.poster})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/90 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
            {/* Poster */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="hidden md:block"
            >
              <img
                src={movie.poster}
                alt={movie.title}
                className="w-full max-w-xs rounded-2xl shadow-2xl border border-white/10"
                data-testid="movie-poster"
              />
            </motion.div>

            {/* Details */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="md:col-span-2"
            >
              <h1 className="text-5xl sm:text-6xl font-black tracking-tighter leading-none mb-4" data-testid="movie-title">
                {movie.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center space-x-1 bg-yellow-500/20 px-3 py-1 rounded-full">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" strokeWidth={1.5} />
                  <span className="text-sm font-semibold text-yellow-500">{movie.avgRating}/5</span>
                </div>
                <div className="flex items-center space-x-1 text-zinc-300">
                  <Clock className="h-4 w-4" strokeWidth={1.5} />
                  <span className="text-sm">{movie.duration}</span>
                </div>
                <span className="px-3 py-1 bg-red-600/20 text-red-500 rounded-full text-sm font-medium">
                  {movie.rating}
                </span>
                <div className="flex items-center space-x-1 text-zinc-300">
                  <Calendar className="h-4 w-4" strokeWidth={1.5} />
                  <span className="text-sm">{movie.releaseYear}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {movie.genre.split(',').map((g, i) => (
                  <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-sm">{g.trim()}</span>
                ))}
              </div>

              <p className="text-zinc-300 leading-relaxed mb-6 text-lg max-w-2xl">{movie.description}</p>

              {/* Director & Producer */}
              <div className="flex flex-wrap gap-8 mb-8">
                {movie.director && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">Director</p>
                    <p className="text-white font-semibold">{movie.director}</p>
                  </div>
                )}
                {movie.producer && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1">Producer</p>
                    <p className="text-white font-semibold">{movie.producer}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleBookTickets}
                  className="inline-flex items-center justify-center rounded-full bg-red-600 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-red-500 active:scale-95"
                  data-testid="book-tickets-button"
                >
                  <Ticket className="mr-2 h-5 w-5" strokeWidth={1.5} />
                  Buy Tickets
                </button>
                {movie.trailer && (
                  <button
                    onClick={handleWatchTrailer}
                    className="inline-flex items-center justify-center rounded-full bg-white/10 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/20 active:scale-95 backdrop-blur-md"
                    data-testid="watch-trailer-button"
                  >
                    <Play className="mr-2 h-5 w-5" strokeWidth={1.5} />
                    Watch Trailer
                  </button>
                )}
                <button
                  onClick={handleFavorite}
                  className="inline-flex items-center justify-center rounded-full bg-white/10 px-6 py-4 text-base font-semibold text-white transition-all hover:bg-white/20 active:scale-95 backdrop-blur-md"
                  data-testid="favorite-button"
                >
                  <Heart 
                    className={`h-5 w-5 transition-all ${isFavorite ? 'fill-red-500 text-red-500 scale-110' : ''}`} 
                    strokeWidth={1.5} 
                  />
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Cast Section */}
      {movie.cast && movie.cast.length > 0 && (
        <section className="py-16 bg-zinc-950" data-testid="cast-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold mb-8">Cast & Crew</h2>
            <div className="flex overflow-x-auto space-x-8 pb-4">
              {movie.cast.map((actor, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  viewport={{ once: true }}
                  className="flex-shrink-0 text-center"
                  data-testid={`cast-member-${idx}`}
                >
                  <img
                    src={actor.image}
                    alt={actor.name}
                    className="w-28 h-28 rounded-full object-cover mb-3 border-2 border-white/10 mx-auto"
                  />
                  <p className="text-sm font-semibold">{actor.name}</p>
                  <p className="text-xs text-zinc-400">{actor.role}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default MovieDetails;
