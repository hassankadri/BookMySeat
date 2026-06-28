const mongoose = require('mongoose');

const showSchema = new mongoose.Schema({
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  theater: {
    name: {
      type: String,
      default: 'BookMySeat Cinema'
    },
    address: {
      type: String,
      default: '123 Movie Street, Cinema City, CC 10001'
    }
  },
  totalSeats: {
    type: Number,
    default: 90
  },
  bookedSeats: [{
    type: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Show', showSchema);