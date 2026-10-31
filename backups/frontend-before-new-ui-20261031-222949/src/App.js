
import React, { useEffect } from "react";

import "@/App.css";

import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { Toaster } from "react-hot-toast";

import { AuthProvider } from "./context/AuthContext";
import { BookingProvider } from "./context/BookingContext";

import Navbar from "./components/Navbar";

import VirtualQueueGate from "./components/VirtualQueueGate";

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
import AdminDynamicPricing from "./pages/admin/AdminDynamicPricing";
import AdminRiskMonitoring from "./pages/admin/AdminRiskMonitoring";
import AddShow from "./pages/admin/AddShow";
import TicketScanner from "./pages/admin/TicketScanner";

// =====================================================
// PARTNER PAGES
// =====================================================

import PartnerDashboard from "./pages/partner/PartnerDashboard";

import PartnerShowtimeCreate from "./pages/partner/PartnerShowtimeCreate";

// =====================================================
// PARTNER HOME
// =====================================================

function PartnerHome() {
  return (
    <div className="bg-[#09090b]">
      <div className="px-5 pt-20 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-white/40">
            Partner workspace
          </p>

          <Link
            to="/partner/new-show"
            className="inline-flex items-center justify-center rounded-full border border-[#D71935]/60 bg-[#D71935] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#ec2e4b]"
          >
            Schedule a show
          </Link>
        </div>
      </div>

      <PartnerDashboard />
    </div>
  );
}

// =====================================================
// ROUTING — PRESERVE ADMIN SHELL
// =====================================================

function AppRoutes() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location.pathname]);

  const routeKey =
    location.pathname.startsWith("/admin")
      ? "admin"
      : location.pathname;

  return (
    <Routes key={routeKey}>
      {/* PUBLIC ROUTES */}

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

      {/* FEATURE 8 — VIRTUAL QUEUE GATE */}

      <Route
        path="/booking/:id"
        element={
          <VirtualQueueGate>
            <Booking />
          </VirtualQueueGate>
        }
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

      <Route
        path="/ai-search"
        element={<AiSearch />}
      />

      {/* PARTNER ROUTES */}

      <Route
        path="/partner"
        element={<PartnerHome />}
      />

      <Route
        path="/partner/new-show"
        element={<PartnerShowtimeCreate />}
      />

      {/* ADMIN ROUTES */}

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
          path="pricing"
          element={<AdminDynamicPricing />}
        />

        <Route
          path="risk"
          element={<AdminRiskMonitoring />}
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
  );
}

// =====================================================
// APPLICATION
// =====================================================

function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <BrowserRouter>
          <div className="App">
            <Navbar />

            <AppRoutes />

            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#19191D",
                  color: "#F5F5F5",
                  border:
                    "1px solid rgba(245,245,245,0.12)",
                  borderRadius: "16px",
                },

                success: {
                  iconTheme: {
                    primary: "#D71935",
                    secondary: "#F5F5F5",
                  },
                },

                error: {
                  iconTheme: {
                    primary: "#D71935",
                    secondary: "#F5F5F5",
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
