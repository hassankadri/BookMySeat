import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(formData.email, formData.password);
      } else {
        result = await register(formData.name, formData.email, formData.password);
      }

      if (result.success) {
        toast.success(isLogin ? 'Login successful!' : 'Registration successful!');
        navigate('/');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-24 px-4" data-testid="auth-page">
      <div className="max-w-md w-full">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glassmorphism rounded-2xl p-8"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2" data-testid="auth-title">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-zinc-400">
              {isLogin ? 'Sign in to continue booking' : 'Sign up to start booking'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div data-testid="name-input-group">
                <label className="block text-sm font-medium mb-2">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" strokeWidth={1.5} />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required={!isLogin}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="Enter your name"
                    data-testid="name-input"
                  />
                </div>
              </div>
            )}

            <div data-testid="email-input-group">
              <label className="block text-sm font-medium mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" strokeWidth={1.5} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Enter your email"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div data-testid="password-input-group">
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" strokeWidth={1.5} />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full bg-zinc-900 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-red-500 transition-colors"
                  placeholder="Enter your password"
                  data-testid="password-input"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="auth-submit-button"
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-red-500 hover:text-red-400 transition-colors"
              data-testid="toggle-auth-mode"
            >
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;