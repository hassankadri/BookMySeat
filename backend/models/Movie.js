const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  genre: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  rating: {
    type: String,
    default: 'U/A'
  },
  poster: {
    type: String,
    required: true
  },
  banner: {
    type: String
  },
  trailer: {
    type: String
  },
  cast: [{
    name: String,
    role: String,
    image: String
  }],
  director: {
    type: String,
    default: ''
  },
  producer: {
    type: String,
    default: ''
  },
  releaseYear: {
    type: Number,
    default: 2024
  },
  releaseDate: {
    type: Date,
    default: Date.now
  },
  avgRating: {
    type: Number,
    default: 4.5
  },
  trending: {
    type: Boolean,
    default: false
  },
  trendingRank: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Movie', movieSchema);
