import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, ArrowRight, ArrowLeft, Star, Clock, Film, Ticket, MapPin, Mail, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Home = () => {
  const [movies, setMovies] = useState([]);
  const [trending, setTrending] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchMovies();
    fetchTrending();
  }, []);

  const fetchMovies = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies`);
      setMovies(response.data.movies);
    } catch (error) {
      console.error('Error fetching movies:', error);
    }
  };

  const fetchTrending = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/movies/trending`);
      setTrending(response.data.movies);
    } catch (error) {
      console.error('Error fetching trending:', error);
    }
  };

  const scrollTrending = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Pick first 4 trending movies for trailers
  const trailerMovies = trending.slice(0, 4);
  const [activeTrailerIdx, setActiveTrailerIdx] = useState(0);
  const activeTrailer = trailerMovies[activeTrailerIdx] || null;

  const getYoutubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/)([\w-]{11})/);
    return match ? match[1] : null;
  };

  const handleTrailerClick = (url) => {
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen" data-testid="home-page">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative h-screen flex items-center overflow-hidden"
        data-testid="hero-section"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1400)` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/80 to-transparent"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }} className="max-w-2xl">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-none mb-6" data-testid="hero-title">
              Experience Cinema
              <span className="block text-gradient">Like Never Before</span>
            </h1>
            <p className="text-xl text-zinc-400 mb-8 leading-relaxed">
              Book your favorite movies instantly. Premium seats, immersive experience, unforgettable moments.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/movies" className="inline-flex items-center justify-center rounded-full bg-red-600 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-red-500 active:scale-95" data-testid="explore-movies-button">
                Explore Movies <ArrowRight className="ml-2 h-5 w-5" strokeWidth={1.5} />
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.section>

    {/* Trending Top 10 Section with Arrow Buttons */}
{trending.length > 0 && (
  <section className="py-16 bg-zinc-950" data-testid="trending-section">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Top <span className="text-red-500">Trending Movies</span>
        </h2>
      </div>

      {/* WRAPPER FOR SIDE ARROWS */}
      <div className="relative group">

        {/* LEFT ARROW */}
        <button
          onClick={() => scrollTrending('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 
          opacity-0 group-hover:opacity-100 transition-all duration-300
          h-full w-14 flex items-center justify-center
          bg-gradient-to-r from-black/70 to-transparent
          pointer-events-none group-hover:pointer-events-auto"
        >
          <ChevronLeft className="h-7 w-7 text-white" strokeWidth={1.5} />
        </button>

        {/* RIGHT ARROW */}
        <button
          onClick={() => scrollTrending('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 
          opacity-0 group-hover:opacity-100 transition-all duration-300
          h-full w-14 flex items-center justify-center
          bg-gradient-to-l from-black/70 to-transparent
          pointer-events-none group-hover:pointer-events-auto"
        >
          <ChevronRight className="h-7 w-7 text-white" strokeWidth={1.5} />
        </button>

        <div
          ref={scrollRef}
          className="flex overflow-x-auto space-x-6 pb-6 scroll-smooth no-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          data-testid="trending-scroll"
        >
          {trending.map((movie, idx) => (
            <Link
              key={movie._id}
              to={`/movie/${movie._id}`}
              className="flex-shrink-0 relative group/card"
              data-testid={`trending-card-${idx}`}
            >
              <div className="relative w-48">

                {/* NUMBER (FIXED VISIBILITY) */}
                <span
                  className="absolute -left-4 -bottom-2 text-[120px] font-black 
                  text-zinc-700/70 leading-none z-[15] select-none"
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                >
                  {idx + 1}
                </span>

                {/* POSTER */}
                <div className="relative z-[10] overflow-hidden rounded-xl border border-white/5 
                  transition-all duration-300 
                  group-hover/card:-translate-y-2 
                  group-hover/card:scale-105 
                  group-hover/card:shadow-[0_8px_30px_rgba(220,38,38,0.3)]">
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    className="w-48 h-72 object-cover"
                    loading="lazy"
                  />
                </div>

                {/* TITLE */}
                <p className="relative z-10 mt-3 text-sm font-semibold text-center line-clamp-1">
                  {movie.title}
                </p>

              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  </section>
)}
      {/* Trailer Section - 4 Trailers from Trending */}
      {trailerMovies.length > 0 && activeTrailer && (
        <section className="py-16 bg-zinc-900/50" data-testid="trailer-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">Latest Trailers</h2>
            
            {/* Main Large Trailer */}
            <div className="mb-6" data-testid="main-trailer-player">
              <div
                className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 cursor-pointer group"
                onClick={() => handleTrailerClick(activeTrailer.trailer)}
              >
                {getYoutubeId(activeTrailer.trailer) ? (
                  <img
                    src={`https://img.youtube.com/vi/${getYoutubeId(activeTrailer.trailer)}/maxresdefault.jpg`}
                    alt={activeTrailer.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <Play className="h-16 w-16 text-zinc-600" strokeWidth={1.5} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center">
                    <Play className="h-10 w-10 text-white ml-1" strokeWidth={1.5} />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                  <h3 className="text-2xl font-bold">{activeTrailer.title}</h3>
                  <p className="text-zinc-300 text-sm">{activeTrailer.genre} | {activeTrailer.releaseYear}</p>
                </div>
              </div>
            </div>

            {/* 4 Thumbnail Trailers Below */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="trailer-thumbnails">
              {trailerMovies.map((movie, idx) => (
                <button
                  key={movie._id}
                  onClick={() => { setActiveTrailerIdx(idx); handleTrailerClick(movie.trailer); }}
                  className={`relative group overflow-hidden rounded-xl border transition-all duration-300 ${
                    activeTrailerIdx === idx
                      ? 'border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.3)]'
                      : 'border-white/5 hover:border-red-500/50'
                  }`}
                  data-testid={`trailer-thumb-${idx}`}
                >
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={getYoutubeId(movie.trailer) ? `https://img.youtube.com/vi/${getYoutubeId(movie.trailer)}/mqdefault.jpg` : movie.poster}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center">
                      <Play className="h-6 w-6 text-white ml-0.5" strokeWidth={1.5} />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-sm font-semibold line-clamp-1">{movie.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-24 bg-zinc-950" data-testid="features-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Why BookMySeat?</h2>
            <p className="text-zinc-400 text-lg">The ultimate movie booking experience</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: 'Instant Booking', desc: 'Book your seats in seconds with our streamlined process', icon: Ticket },
              { title: 'Best Prices', desc: 'Get the best deals on movie tickets with exclusive offers', icon: Star },
              { title: 'Premium Experience', desc: 'Enjoy cinema in comfort with premium seating options', icon: Film }
            ].map((feature, idx) => (
              <motion.div key={idx} initial={{ y: 50, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} transition={{ delay: idx * 0.2, duration: 0.5 }} viewport={{ once: true }}
                className="p-8 rounded-xl bg-zinc-900 border border-white/5 hover:border-red-500/50 transition-all duration-300" data-testid={`feature-${idx}`}>
                <feature.icon className="h-10 w-10 mb-4 text-red-500" strokeWidth={1.5} />
                <h3 className="text-2xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-zinc-400">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-900/50 border-t border-white/5 pt-16 pb-8" data-testid="footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-4">
                <Film className="h-8 w-8 text-red-600" strokeWidth={1.5} />
                <span className="text-xl font-black tracking-tight">BookMySeat</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Your premium destination for movie ticket booking. Experience cinema like never before.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-[0.2em] mb-4 text-zinc-300">Quick Links</h4>
              <ul className="space-y-3">
                <li><Link to="/" className="text-zinc-400 hover:text-white transition-colors text-sm">Home</Link></li>
                <li><Link to="/movies" className="text-zinc-400 hover:text-white transition-colors text-sm">Movies</Link></li>
                <li><Link to="/favorites" className="text-zinc-400 hover:text-white transition-colors text-sm">Favorites</Link></li>
                <li><Link to="/my-bookings" className="text-zinc-400 hover:text-white transition-colors text-sm">My Bookings</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-[0.2em] mb-4 text-zinc-300">Company</h4>
              <ul className="space-y-3">
                <li><span className="text-zinc-400 text-sm">About Us</span></li>
                <li><Link to="/contact" className="text-zinc-400 hover:text-white transition-colors text-sm">Contact</Link></li>
                <li><span className="text-zinc-400 text-sm">Privacy Policy</span></li>
                <li><span className="text-zinc-400 text-sm">Terms of Service</span></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold uppercase tracking-[0.2em] mb-4 text-zinc-300">Contact Us</h4>
              <ul className="space-y-3">
                <li className="flex items-center space-x-2 text-zinc-400 text-sm"><Mail className="h-4 w-4 text-red-500" strokeWidth={1.5} /><span>support@bookmyseat.com</span></li>
                <li className="flex items-center space-x-2 text-zinc-400 text-sm"><Phone className="h-4 w-4 text-red-500" strokeWidth={1.5} /><span>+91 1800-123-4567</span></li>
                <li className="flex items-center space-x-2 text-zinc-400 text-sm"><MapPin className="h-4 w-4 text-red-500" strokeWidth={1.5} /><span>Mumbai, Maharashtra, India</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center">
            <p className="text-zinc-500 text-sm">2025 BookMySeat. All rights reserved. Made with love for cinema.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
