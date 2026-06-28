require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const showRoutes = require('./routes/shows');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');

const { seedAdmin, seedMovies } = require('./utils/seed');

const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors({
  origin: ["http://localhost:3000"],
  //origin: process.env.CORS_ORIGINS || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const mongoUrl = process.env.MONGO_URL;
const dbName = process.env.DB_NAME;

mongoose.connect(`${mongoUrl}/${dbName}`)
  .then(async () => {
    console.log('✅ MongoDB connected successfully');
    await seedAdmin();
    //await seedMovies();
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Routes
app.get('/api/', (req, res) => {
  res.json({ message: 'BookMySeat API Server' });
});

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;