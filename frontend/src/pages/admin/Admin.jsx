import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Ticket, Film, Users } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link, Outlet, useLocation } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Admin = () => {
  const { user, token, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/');
      return;
    }
    if (location.pathname === '/admin' || location.pathname === '/admin/') {
      fetchStats();
    }
  }, [user, location, authLoading]);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen pt-16 bg-zinc-950" data-testid="admin-dashboard">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 min-h-screen glassmorphism border-r border-white/10" data-testid="admin-sidebar">
          <div className="p-6">
            <h2 className="text-2xl font-bold mb-6">Admin Panel</h2>
            <nav className="space-y-2">
              <Link
                to="/admin"
                className={`block px-4 py-3 rounded-lg transition-all duration-300 ${
                  isActive('/admin') ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
                data-testid="admin-nav-dashboard"
              >
                Dashboard
              </Link>
              <Link
                to="/admin/add-show"
                className={`block px-4 py-3 rounded-lg transition-all duration-300 ${
                  isActive('/admin/add-show') ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
                data-testid="admin-nav-add-show"
              >
                Add Shows
              </Link>
              <Link
                to="/admin/shows"
                className={`block px-4 py-3 rounded-lg transition-all duration-300 ${
                  isActive('/admin/shows') ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
                data-testid="admin-nav-shows"
              >
                List Shows
              </Link>
              <Link
                to="/admin/bookings"
                className={`block px-4 py-3 rounded-lg transition-all duration-300 ${
                  isActive('/admin/bookings') ? 'bg-red-600 text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`}
                data-testid="admin-nav-bookings"
              >
                List Bookings
              </Link>
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {(location.pathname === '/admin' || location.pathname === '/admin/') ? (
            <div data-testid="admin-stats">
              <h1 className="text-4xl font-bold mb-8">Dashboard Overview</h1>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-zinc-400">Loading...</div>
                </div>
              ) : stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="glassmorphism rounded-xl p-6"
                    data-testid="stat-revenue"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <DollarSign className="h-10 w-10 text-green-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-3xl font-bold mb-2">${stats.totalRevenue.toFixed(2)}</p>
                    <p className="text-zinc-400">Total Revenue</p>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="glassmorphism rounded-xl p-6"
                    data-testid="stat-bookings"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Ticket className="h-10 w-10 text-blue-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-3xl font-bold mb-2">{stats.totalBookings}</p>
                    <p className="text-zinc-400">Total Bookings</p>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="glassmorphism rounded-xl p-6"
                    data-testid="stat-shows"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Film className="h-10 w-10 text-purple-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-3xl font-bold mb-2">{stats.activeShows}</p>
                    <p className="text-zinc-400">Active Shows</p>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="glassmorphism rounded-xl p-6"
                    data-testid="stat-users"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <Users className="h-10 w-10 text-red-500" strokeWidth={1.5} />
                    </div>
                    <p className="text-3xl font-bold mb-2">{stats.totalUsers}</p>
                    <p className="text-zinc-400">Total Users</p>
                  </motion.div>
                </div>
              )}
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
};

export default Admin;