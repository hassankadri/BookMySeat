import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Film, Search, User, LogOut, Heart, Ticket } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 w-full z-50 glassmorphism"
      data-testid="main-navbar"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2" data-testid="logo-link">
            <Film className="h-8 w-8 text-red-600" strokeWidth={1.5} />
            <span className="text-xl font-black tracking-tight">BookMySeat</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-zinc-400 hover:text-white transition-colors duration-300" data-testid="nav-home">Home</Link>
            <Link to="/movies" className="text-zinc-400 hover:text-white transition-colors duration-300" data-testid="nav-movies">Movies</Link>
            <Link to="/contact" className="text-zinc-400 hover:text-white transition-colors duration-300" data-testid="nav-contact">Contact Us</Link>
            {isAuthenticated && (
              <>
                <Link to="/favorites" className="text-zinc-400 hover:text-white transition-colors duration-300" data-testid="nav-favorites">Favorites</Link>
                <Link to="/my-bookings" className="text-zinc-400 hover:text-white transition-colors duration-300" data-testid="nav-my-bookings">My Bookings</Link>
              </>
            )}
            {user?.role === 'admin' && (
              <Link to="/admin" className="text-red-500 hover:text-red-400 transition-colors duration-300" data-testid="nav-admin">Admin</Link>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 bg-zinc-900 px-4 py-2 rounded-full hover:bg-zinc-800 transition-all duration-300"
                  data-testid="user-menu-button"
                >
                  <User className="h-5 w-5" strokeWidth={1.5} />
                  <span className="hidden md:block">{user?.name}</span>
                </button>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute right-0 mt-2 w-48 glassmorphism rounded-xl py-2 shadow-xl"
                    data-testid="user-menu-dropdown"
                  >
                    <Link to="/favorites" className="flex items-center px-4 py-2 hover:bg-white/10 transition-colors" data-testid="dropdown-favorites">
                      <Heart className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      Favorites
                    </Link>
                    <Link to="/my-bookings" className="flex items-center px-4 py-2 hover:bg-white/10 transition-colors" data-testid="dropdown-bookings">
                      <Ticket className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      My Bookings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 hover:bg-white/10 transition-colors text-red-500"
                      data-testid="logout-button"
                    >
                      <LogOut className="h-4 w-4 mr-2" strokeWidth={1.5} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-full font-semibold transition-all duration-300 active:scale-95"
                data-testid="login-button"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;