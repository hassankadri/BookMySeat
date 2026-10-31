import React from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBooking } from '../context/BookingContext';

export function makePage(name) {
  function RouteProbe() {
    const { user, token, isAuthenticated } = useAuth();
    const { bookingData, updateBooking } = useBooking();
    const location = useLocation();
    const params = useParams();
    return <div data-page={name}>
      <pre data-testid="provider-state">{JSON.stringify({ user, token, isAuthenticated, bookingData, params, location: location.pathname + location.search })}</pre>
      <button data-testid="remember-seat" onClick={() => updateBooking({ selectedSeats: ['A1'] })}>Remember fixture seat</button>
      <Link data-testid="go-movies" to="/movies?theatre=venue-1">Movies</Link>
      {name === 'admin/Admin' && <Outlet />}
    </div>;
  }
  return RouteProbe;
}
