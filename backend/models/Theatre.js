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
 * Later this lets us support:
 *
 * "Theatres near me"
 * distance sorting
 * map view
 *
 * coordinates format:
 *
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
    // Example: PVR Phoenix Palladium
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    /**
     * URL-friendly unique name.
     *
     * Example:
     *
     * pvr-phoenix-palladium-mumbai
     */
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Kept at top level for easy filtering.
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
    // STATUS
    // =================================================

    /**
     * We soft-delete theatres.
     *
     * Old bookings/shows may still reference them,
     * so we should not physically remove the document.
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

/**
 * Allows future queries such as:
 *
 * "find cinemas within 5 km"
 */
theatreSchema.index({
  location: "2dsphere",
});

/**
 * Common query:
 *
 * city -> active theatres
 */
theatreSchema.index({
  city: 1,
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