import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { BookingProvider } from "./context/BookingContext";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Movies from "./pages/Movies";
import MovieDetails from "./pages/MovieDetails";
import Booking from "./pages/Booking";
import Auth from "./pages/Auth";
import MyBookings from "./pages/MyBookings";
import Favorites from "./pages/Favorites";
import BookingSuccess from "./pages/BookingSuccess";
import Contact from "./pages/Contact";
import Admin from "./pages/admin/Admin";
import AddShow from "./pages/admin/AddShow";
import ListShows from "./pages/admin/ListShows";
import ListBookings from "./pages/admin/ListBookings";

function App() {
  return (
    <AuthProvider>
      <BookingProvider>
        <BrowserRouter>
          <div className="App">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/movies" element={<Movies />} />
              <Route path="/movie/:id" element={<MovieDetails />} />
              <Route path="/booking/:id" element={<Booking />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/my-bookings" element={<MyBookings />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/booking-success" element={<BookingSuccess />} />
              <Route path="/booking-cancel" element={<Home />} />
              <Route path="/contact" element={<Contact />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<Admin />}>
                <Route path="add-show" element={<AddShow />} />
                <Route path="shows" element={<ListShows />} />
                <Route path="bookings" element={<ListBookings />} />
              </Route>
            </Routes>
            <Toaster 
              position="bottom-right"
              toastOptions={{
                style: {
                  background: '#18181b',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                },
                success: {
                  iconTheme: {
                    primary: '#dc2626',
                    secondary: '#fff',
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
