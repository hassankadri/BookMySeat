import React from "react";

import "@/App.css";

import {
  BrowserRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  Toaster,
} from "react-hot-toast";

import {
  AuthProvider,
} from "./context/AuthContext";

import {
  BookingProvider,
} from "./context/BookingContext";

import Navbar from "./components/Navbar";

// =====================================================
// PUBLIC PAGES
// =====================================================

import Home from "./pages/Home";
import Movies from "./pages/Movies";
import MovieDetails from "./pages/MovieDetails";
import Booking from "./pages/Booking";
import Checkout from "./pages/Checkout";
import Auth from "./pages/Auth";
import MyBookings from "./pages/MyBookings";
import Favorites from "./pages/Favorites";
import BookingSuccess from "./pages/BookingSuccess";
import Contact from "./pages/Contact";
import Cinemas from "./pages/Cinemas";
import AiSearch from "./pages/AiSearch";

// =====================================================
// ADMIN PAGES
// =====================================================

import Admin from "./pages/admin/Admin";
import AdminMovies from "./pages/admin/AdminMovies";
import AdminTheatres from "./pages/admin/AdminTheatres";
import AdminScreens from "./pages/admin/AdminScreens";
import AdminShows from "./pages/admin/AdminShows";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AddShow from "./pages/admin/AddShow";
import TicketScanner from "./pages/admin/TicketScanner";

// =====================================================
// APP
// =====================================================

function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <BrowserRouter>

          <div className="App">

            <Navbar />

            <Routes>

              {/* =======================================
                  PUBLIC ROUTES
              ======================================== */}

              <Route
                path="/"
                element={<Home />}
              />

              <Route
                path="/movies"
                element={<Movies />}
              />

              <Route
                path="/cinemas"
                element={<Cinemas />}
              />

              <Route
                path="/movie/:id"
                element={<MovieDetails />}
              />

              <Route
                path="/booking/:id"
                element={<Booking />}
              />

              <Route
                path="/checkout"
                element={<Checkout />}
              />

              <Route
                path="/auth"
                element={<Auth />}
              />

              <Route
                path="/my-bookings"
                element={<MyBookings />}
              />

              <Route
                path="/favorites"
                element={<Favorites />}
              />

              <Route
                path="/booking-success"
                element={<BookingSuccess />}
              />

              <Route
                path="/booking-cancel"
                element={<Home />}
              />

              <Route
                path="/contact"
                element={<Contact />}
              />

              {/* AI SEARCH MUST BE A PUBLIC ROUTE */}

              <Route
                path="/ai-search"
                element={<AiSearch />}
              />

              {/* =======================================
                  ADMIN ROUTES
              ======================================== */}

              <Route
                path="/admin"
                element={<Admin />}
              >

                <Route
                  path="analytics"
                  element={<AdminAnalytics />}
                />

                <Route
                  path="movies"
                  element={<AdminMovies />}
                />

                <Route
                  path="theatres"
                  element={<AdminTheatres />}
                />

                <Route
                  path="screens"
                  element={<AdminScreens />}
                />

                <Route
                  path="add-show"
                  element={<AddShow />}
                />

                <Route
                  path="shows"
                  element={<AdminShows />}
                />

                <Route
                  path="users"
                  element={<AdminUsers />}
                />

                <Route
                  path="bookings"
                  element={<AdminBookings />}
                />

                <Route
                  path="scanner"
                  element={<TicketScanner />}
                />

              </Route>

            </Routes>

            {/* =======================================
                TOASTS
            ======================================== */}

            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background:
                    "#18181b",

                  color:
                    "#fff",

                  border:
                    "1px solid rgba(255,255,255,0.1)",
                },

                success: {
                  iconTheme: {
                    primary:
                      "#dc2626",

                    secondary:
                      "#fff",
                  },
                },
              }}
            />

          </div>

        </BrowserRouter>
      </BookingProvider>
    </AuthProvider>
  );
}

export default App;