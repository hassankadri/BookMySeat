import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, MapPin } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const Booking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, isAuthenticated, loading: authLoading } = useAuth();
  const { bookingData, updateBooking } = useBooking();

  const [shows, setShows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedShow, setSelectedShow] = useState(null);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const seatsPerRow = 9;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      toast.error('Please login to book tickets');
      navigate('/auth');
      return;
    }
    fetchShows();
  }, [id, authLoading]);

  const fetchShows = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/shows?movieId=${id}`);
      setShows(response.data.shows);
    } catch (error) {
      console.error('Error fetching shows:', error);
      toast.error('Failed to load shows');
    }
  };

  const getUniqueDates = () => {
    const dates = shows.map(show => new Date(show.date).toDateString());
    return [...new Set(dates)];
  };

  const getShowsForDate = (date) => {
    return shows.filter(show => new Date(show.date).toDateString() === date);
  };

  const handleSeatClick = (seat) => {
    if (selectedShow.bookedSeats.includes(seat)) return;

    if (selectedSeats.includes(seat)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seat));
    } else {
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const handleCheckout = async () => {
    if (selectedSeats.length === 0) {
      toast.error('Please select at least one seat');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/bookings/checkout`,
        {
          showId: selectedShow._id,
          seats: selectedSeats,
          originUrl: window.location.origin
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Redirect to Stripe checkout
      window.location.href = response.data.sessionUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.response?.data?.error || 'Checkout failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16" data-testid="booking-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl font-bold mb-8"
          data-testid="booking-title"
        >
          Book Your Tickets
        </motion.h1>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12" data-testid="booking-steps">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {s}
              </div>
              {s < 3 && <div className={`w-24 h-1 ${step > s ? 'bg-red-600' : 'bg-zinc-800'}`}></div>}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* No Shows Available */}
          {step === 1 && getUniqueDates().length === 0 && (
            <motion.div
              key="no-shows"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
              data-testid="no-shows-available"
            >
              <Calendar className="h-16 w-16 mx-auto mb-4 text-zinc-600" strokeWidth={1.5} />
              <p className="text-xl text-zinc-400 mb-4">No shows available for this movie yet</p>
              <button
                onClick={() => navigate('/movies')}
                className="text-red-500 hover:text-red-400 transition-colors"
              >
                Browse other movies
              </button>
            </motion.div>
          )}

          {/* Step 1: Select Date */}
          {step === 1 && getUniqueDates().length > 0 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              data-testid="date-selection"
            >
              <h2 className="text-2xl font-semibold mb-6">Select Date</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {getUniqueDates().map((date, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedDate(date);
                      setStep(2);
                    }}
                    className="p-6 rounded-xl bg-zinc-900 border border-white/5 hover:border-red-500 transition-all duration-300 active:scale-95"
                    data-testid={`date-option-${idx}`}
                  >
                    <Calendar className="h-6 w-6 mb-2 text-red-500" strokeWidth={1.5} />
                    <p className="font-semibold">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    <p className="text-sm text-zinc-400">{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 2: Select Time */}
          {step === 2 && selectedDate && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              data-testid="time-selection"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Select Show Time</h2>
                <button
                  onClick={() => setStep(1)}
                  className="text-red-500 hover:text-red-400"
                  data-testid="back-to-date"
                >
                  Change Date
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {getShowsForDate(selectedDate).map((show, idx) => (
                  <button
                    key={show._id}
                    onClick={() => {
                      setSelectedShow(show);
                      setStep(3);
                    }}
                    className="p-6 rounded-xl bg-zinc-900 border border-white/5 hover:border-red-500 transition-all duration-300 active:scale-95"
                    data-testid={`time-option-${idx}`}
                  >
                    <Clock className="h-6 w-6 mb-2 text-red-500" strokeWidth={1.5} />
                    <p className="font-semibold text-lg">{show.time}</p>
                    <p className="text-sm text-zinc-400">${show.price} per seat</p>
                    <p className="text-xs text-zinc-500 mt-2">{show.totalSeats - show.bookedSeats.length} seats available</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Select Seats */}
          {step === 3 && selectedShow && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              data-testid="seat-selection"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Select Seats</h2>
                <button
                  onClick={() => setStep(2)}
                  className="text-red-500 hover:text-red-400"
                  data-testid="back-to-time"
                >
                  Change Time
                </button>
              </div>

              {/* Theater Screen */}
              <div className="mb-8">
                <div className="max-w-3xl mx-auto">
                  <div className="h-2 bg-gradient-to-r from-transparent via-zinc-600 to-transparent rounded-full mb-2"></div>
                  <p className="text-center text-zinc-400 text-sm mb-8">Screen this way</p>
                </div>
              </div>

              {/* Seats Grid */}
              <div className="max-w-4xl mx-auto mb-8">
                {rows.map((row) => (
                  <div key={row} className="flex justify-center items-center mb-3" data-testid={`seat-row-${row}`}>
                    <span className="w-8 text-zinc-400 font-semibold">{row}</span>
                    <div className="flex space-x-2">
                      {[...Array(seatsPerRow)].map((_, idx) => {
                        const seatNumber = `${row}${idx + 1}`;
                        const isBooked = selectedShow.bookedSeats.includes(seatNumber);
                        const isSelected = selectedSeats.includes(seatNumber);

                        return (
                          <button
                            key={seatNumber}
                            onClick={() => handleSeatClick(seatNumber)}
                            disabled={isBooked}
                            className={`w-10 h-10 rounded-md text-xs font-semibold transition-all duration-300 ${
                              isBooked
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-700 opacity-50 cursor-not-allowed'
                                : isSelected
                                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)] scale-110'
                                : 'border border-zinc-600 bg-zinc-800 hover:border-red-500 active:scale-95'
                            }`}
                            data-testid={`seat-${seatNumber}`}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center space-x-8 mb-8" data-testid="seat-legend">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded bg-zinc-800 border border-zinc-600"></div>
                  <span className="text-sm text-zinc-400">Available</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded bg-red-600"></div>
                  <span className="text-sm text-zinc-400">Selected</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded bg-zinc-900 opacity-50"></div>
                  <span className="text-sm text-zinc-400">Booked</span>
                </div>
              </div>

              {/* Checkout Summary */}
              {selectedSeats.length > 0 && (
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="max-w-2xl mx-auto p-6 rounded-xl bg-zinc-900 border border-white/10"
                  data-testid="checkout-summary"
                >
                  <h3 className="text-xl font-semibold mb-4">Booking Summary</h3>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Selected Seats:</span>
                      <span className="font-semibold">{selectedSeats.join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Number of Tickets:</span>
                      <span className="font-semibold">{selectedSeats.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Price per Ticket:</span>
                      <span className="font-semibold">${selectedShow.price}</span>
                    </div>
                    <div className="border-t border-white/10 pt-3 flex justify-between text-xl">
                      <span className="font-bold">Total:</span>
                      <span className="font-bold text-red-500">${(selectedShow.price * selectedSeats.length).toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center rounded-full bg-red-600 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-red-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="proceed-to-payment-button"
                  >
                    {loading ? 'Processing...' : 'Proceed to Payment'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Booking;