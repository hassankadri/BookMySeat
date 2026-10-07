const mongoose = require("mongoose");

// =====================================================
// MOVIE
// =====================================================

const movieSchema =
  new mongoose.Schema(
    {
      title: {
        type: String,
        required: true,
        trim: true,
      },

      description: {
        type: String,
        required: true,
        trim: true,
      },

      genre: {
        type: String,
        required: true,
        trim: true,
      },

      duration: {
        type: String,
        required: true,
        trim: true,
      },

      // -------------------------------------------------
      // Movie's primary/original listing language.
      //
      // Individual Shows can still have their own
      // language because dubbed versions may exist.
      // -------------------------------------------------

      language: {
        type: String,
        default: "",
        trim: true,
      },

      rating: {
        type: String,
        default: "U/A",
        trim: true,
      },

      poster: {
        type: String,
        required: true,
        trim: true,
      },

      banner: {
        type: String,
        default: "",
        trim: true,
      },

      trailer: {
        type: String,
        default: "",
        trim: true,
      },

      cast: [
        {
          name: {
            type: String,
            default: "",
          },

          role: {
            type: String,
            default: "",
          },

          image: {
            type: String,
            default: "",
          },
        },
      ],

      director: {
        type: String,
        default: "",
        trim: true,
      },

      producer: {
        type: String,
        default: "",
        trim: true,
      },

      releaseYear: {
        type: Number,
        default: () =>
          new Date().getFullYear(),
      },

      // Do not pretend "today" was the movie's
      // release date when the real date is unknown.
      releaseDate: {
        type: Date,
        default: null,
      },

      avgRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },

      // =================================================
      // MOVIE LIFECYCLE
      //
      // ACTIVE
      //   Can be scheduled and shown normally.
      //
      // COMING_SOON
      //   May be shown publicly as upcoming,
      //   but should not be presented as bookable
      //   unless actual shows are scheduled.
      //
      // HIDDEN
      //   Removed from public discovery without
      //   deleting historical references.
      // =================================================

      listingStatus: {
        type: String,

        enum: [
          "ACTIVE",
          "COMING_SOON",
          "HIDDEN",
        ],

        default: "ACTIVE",

        index: true,
      },
    },
    {
      timestamps: true,
    }
  );

// =====================================================
// INDEXES
// =====================================================

movieSchema.index({
  title: 1,
});

movieSchema.index({
  listingStatus: 1,
  releaseDate: -1,
});

// =====================================================
// EXPORT
// =====================================================

module.exports =
  mongoose.model(
    "Movie",
    movieSchema
  );