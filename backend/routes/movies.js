const express = require('express');
const Movie = require('../models/Movie');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Get all movies
router.get('/', async (req, res) => {
  try {
    const movies = await Movie.find({ trending: { $ne: true } }).sort({ createdAt: -1 });
    res.json({ movies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
});

// Get trending movies
router.get('/trending', async (req, res) => {
  try {
    const movies = await Movie.find({ trending: true }).sort({ trendingRank: 1 });
    res.json({ movies });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trending movies' });
  }
});

// Get user favorites - must be before /:id
router.get('/favorites/list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate('favorites');
    res.json({ favorites: user.favorites });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

// Get single movie
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json({ movie });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movie' });
  }
});

// Toggle favorite
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const movieId = req.params.id;
    
    const isFavorite = user.favorites.includes(movieId);
    
    if (isFavorite) {
      user.favorites = user.favorites.filter(id => id.toString() !== movieId);
    } else {
      user.favorites.push(movieId);
    }
    
    await user.save();
    
    res.json({ 
      message: isFavorite ? 'Removed from favorites' : 'Added to favorites',
      isFavorite: !isFavorite
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update favorites' });
  }
});

module.exports = router;
