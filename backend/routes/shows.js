const express = require('express');
const Show = require('../models/Show');
const Movie = require('../models/Movie');
const { adminAuth } = require('../middleware/auth');

const router = express.Router();

// Get all shows
router.get('/', async (req, res) => {
  try {
    const { movieId, date } = req.query;
    const query = {};
    
    if (movieId) query.movie = movieId;
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }
    
    const shows = await Show.find(query)
      .populate('movie')
      .sort({ date: 1, time: 1 });
    
    res.json({ shows });
  } catch (error) {
    console.error('Fetch shows error:', error);
    res.status(500).json({ error: 'Failed to fetch shows' });
  }
});

// Get single show
router.get('/:id', async (req, res) => {
  try {
    const show = await Show.findById(req.params.id).populate('movie');
    if (!show) {
      return res.status(404).json({ error: 'Show not found' });
    }
    res.json({ show });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch show' });
  }
});

// Create show (Admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const { movieId, date, time, price } = req.body;
    
    if (!movieId || !date || !time || !price) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    
    const show = new Show({
      movie: movieId,
      date: new Date(date),
      time,
      price,
      createdBy: req.userId
    });
    
    await show.save();
    await show.populate('movie');
    
    res.status(201).json({ 
      message: 'Show created successfully', 
      show 
    });
  } catch (error) {
    console.error('Create show error:', error);
    res.status(500).json({ error: 'Failed to create show' });
  }
});

module.exports = router;