
const mongoose = require("mongoose");

// =====================================================
// THEATRE GALLERY IMAGE
// =====================================================

const galleryImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    alt: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// GEO LOCATION
// =====================================================

/**
 * GeoJSON location.
 *
 * Supports:
 * - Nearby theatres
 * - Distance sorting
 * - Map display
 *
 * Coordinate format:
 * [longitude, latitude]
 */

const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },

    coordinates: {
      type: [Number],

      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 2 &&
            value.every(Number.isFinite)
          );
        },

        message:
          "Location coordinates must be [longitude, latitude].",
      },
    },
  },
  {
    _id: false,
  }
);

// =====================================================
// THEATRE MODEL
// =====================================================

const theatreSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // =================================================
    // ADDRESS
    // =================================================

    address: {
      street: {
        type: String,
        required: true,
        trim: true,
      },

      area: {
        type: String,
        default: "",
        trim: true,
      },

      city: {
        type: String,
        required: true,
        trim: true,
      },

      state: {
        type: String,
        required: true,
        trim: true,
      },

      postalCode: {
        type: String,
        default: "",
        trim: true,
      },

      country: {
        type: String,
        default: "India",
        trim: true,
      },
    },

    // =================================================
    // MAP LOCATION
    // =================================================

    location: {
      type: locationSchema,
      default: undefined,
    },

    // =================================================
    // IMAGES
    // =================================================

    coverImage: {
      type: String,
      default: "",
      trim: true,
    },

    gallery: {
      type: [galleryImageSchema],
      default: [],
    },

    // =================================================
    // AMENITIES
    // =================================================

    amenities: {
      type: [
        {
          type: String,

          enum: [
            "Parking",
            "Food & Beverages",
            "Wheelchair Accessible",
            "Dolby Atmos",
            "IMAX",
            "4DX",
            "Recliner Seats",
            "Lounger Seats",
            "3D",
            "Air Conditioning",
            "Online Food Ordering",
          ],
        },
      ],

      default: [],
    },

    // =================================================
    // CONTACT
    // =================================================

    contact: {
      phone: {
        type: String,
        default: "",
        trim: true,
      },

      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },

      whatsapp: {
        type: String,
        default: "",
        trim: true,
      },
    },

    // =================================================
    // DESCRIPTION
    // =================================================

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1500,
    },

    // =================================================
    // FEATURE 7 — CINEMA PARTNER OWNERSHIP
    // =================================================

    /**
     * Reference to the partner responsible for
     * managing this theatre.
     *
     * Security rules:
     *
     * 1. Only administrators can assign a partner.
     *
     * 2. Partner operations must verify ownership
     *    on every request.
     *
     * 3. An unassigned theatre is never accessible
     *    through partner-management endpoints.
     *
     * 4. Existing theatres remain unassigned until
     *    an administrator explicitly assigns them.
     *
     * Do not accept this field from public requests.
     */

    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // =================================================
    // STATUS
    // =================================================

    /**
     * Soft-deletion preserves historical references
     * from bookings, screens and showtimes.
     */

    isActive: {
      type: Boolean,
      default: true,
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

// Support nearby theatre searches.
theatreSchema.index({
  location: "2dsphere",
});

// Common public search:
// city -> active theatres.
theatreSchema.index({
  city: 1,
  isActive: 1,
});

// =====================================================
// FEATURE 7 — PARTNER OWNERSHIP INDEX
// =====================================================

// Efficiently retrieve theatres assigned to a partner.
// Also supports filtering for active theatres.

theatreSchema.index({
  partner: 1,
  isActive: 1,
});

// =====================================================
// NORMALIZATION
// =====================================================

theatreSchema.pre(
  "validate",
  function (next) {
    /**
     * Keep top-level city and address.city consistent.
     */

    if (
      this.city &&
      this.address &&
      !this.address.city
    ) {
      this.address.city =
        this.city;
    }

    if (
      this.address?.city &&
      !this.city
    ) {
      this.city =
        this.address.city;
    }

    next();
  }
);

// =====================================================
// EXPORT REAL MONGOOSE MODEL
// =====================================================

module.exports =
  mongoose.models.Theatre ||
  mongoose.model(
    "Theatre",
    theatreSchema
  );
