import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Clock, Ticket, Search } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Movies = () => {
  const [movies, setMovies] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');

 useEffect(() => {
  fetchMovies();
  fetchTrending();
}, []);

  const fetchMovies = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies`, {
  headers: {
    "Cache-Control": "no-cache"
  }
});
console.log("API RESPONSE:", response.data);
      setMovies(response.data.movies);
    } catch (error) {
      console.error('Error fetching movies:', error);
      toast.error('Failed to load movies');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrending = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies/trending`, {
      headers: { "Cache-Control": "no-cache" }});
      setTrending(response.data.movies);
    } catch (error) {
      console.error('Error fetching trending:', error);
    }
  };

  const allMovies = [...movies, ...trending];
  
  const genres = ['All', ...new Set(allMovies.flatMap(m => m.genre.split(',').map(g => g.trim())))];

  const filteredMovies = allMovies.filter(movie => {
    const matchesSearch = movie.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === 'All' || movie.genre.includes(selectedGenre);
    return matchesSearch && matchesGenre;
  });
  console.log("RENDER MOVIES:", filteredMovies);
  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="movies-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4" data-testid="movies-title">Now Showing</h1>
          <p className="text-zinc-400 text-lg">Discover the latest blockbusters</p>
        </motion.div>

        {/* Search + Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-10" data-testid="movies-filters">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search movies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-white/10 rounded-full pl-10 pr-4 py-3 focus:outline-none focus:border-red-500 transition-colors text-sm"
              data-testid="search-input"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {genres.slice(0, 10).map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedGenre === genre
                    ? 'bg-red-600 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-white/10'
                }`}
                data-testid={`genre-filter-${genre}`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[...Array(10)].map((_, idx) => (
              <div key={idx} className="animate-pulse">
                <div className="bg-zinc-900 rounded-xl h-96"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6" data-testid="movies-grid">
            {filteredMovies.map((movie, idx) => (
              <motion.div
                key={movie._id + movie.poster}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: Math.min(idx * 0.05, 0.5), duration: 0.4 }}
              >
                <Link
                  to={`/movie/${movie._id}`}
                  className="group relative block overflow-hidden rounded-xl bg-zinc-900 border border-white/5 transition-transform duration-300 hover:-translate-y-2 hover:shadow-[0_8px_30px_rgba(220,38,38,0.2)]"
                >
                  {movie.trending && (
                    <div className="absolute top-2 left-2 z-10 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      #{movie.trendingRank} Trending
                    </div>
                  )}
                  <div className="aspect-[2/3] overflow-hidden">
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-2 line-clamp-1">{movie.title}</h3>
                    <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
                      <div className="flex items-center space-x-1">
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" strokeWidth={1.5} />
                        <span className="text-xs">{movie.avgRating}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span className="text-xs">{movie.duration}</span>
                      </div>
                    </div>
                    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-red-600/20 text-red-500 rounded-full mb-3">
                      {movie.genre.split(',')[0]}
                    </span>
                    <div
                      className="w-full inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-red-500 active:scale-95"
                      data-testid={`book-ticket-btn-${idx}`}
                    >
                      <Ticket className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                      Book Tickets
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && filteredMovies.length === 0 && (
          <div className="text-center py-16 text-zinc-400" data-testid="no-results">
            <p className="text-xl">No movies found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Movies;
