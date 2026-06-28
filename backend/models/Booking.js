const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  show: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Show',
    required: true
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  seats: [{
    type: String,
    required: true
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  bookingReference: {
    type: String,
    required: true,
    unique: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentId: {
    type: String
  },
  sessionId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', bookingSchema);