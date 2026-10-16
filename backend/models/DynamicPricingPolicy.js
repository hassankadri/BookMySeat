
"use strict";

const mongoose = require("mongoose");

// One optional policy per show.
// No policy means existing fixed prices.
// Every new policy starts disabled.

const dynamicPricingPolicySchema = new mongoose.Schema(
  {
    show: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Show",
      required: true,
      unique: true,
      index: true,
    },

    enabled: {
      type: Boolean,
      default: false,
    },

    minMultiplier: {
      type: Number,
      min: 0.8,
      max: 1,
      default: 0.9,
    },

    maxMultiplier: {
      type: Number,
      min: 1,
      max: 1.5,
      default: 1.3,
    },

    lowOccupancyThreshold: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.3,
    },

    highOccupancyThreshold: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },

    lowDemandDiscount: {
      type: Number,
      min: 0,
      max: 0.2,
      default: 0.05,
    },

    highDemandSurcharge: {
      type: Number,
      min: 0,
      max: 0.3,
      default: 0.15,
    },

    last48HoursSurcharge: {
      type: Number,
      min: 0,
      max: 0.15,
      default: 0.05,
    },

    last12HoursSurcharge: {
      type: Number,
      min: 0,
      max: 0.15,
      default: 0.05,
    },

    weekendSurcharge: {
      type: Number,
      min: 0,
      max: 0.15,
      default: 0.05,
    },

    openingWeekSurcharge: {
      type: Number,
      min: 0,
      max: 0.15,
      default: 0.05,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

dynamicPricingPolicySchema.pre(
  "validate",
  function validatePolicy(next) {
    if (
      this.lowOccupancyThreshold >=
      this.highOccupancyThreshold
    ) {
      return next(
        new Error(
          "Low occupancy threshold must be below high occupancy threshold."
        )
      );
    }

    if (
      this.minMultiplier >
      this.maxMultiplier
    ) {
      return next(
        new Error(
          "Minimum multiplier cannot exceed maximum multiplier."
        )
      );
    }

    return next();
  }
);

module.exports =
  mongoose.models.DynamicPricingPolicy ||
  mongoose.model(
    "DynamicPricingPolicy",
    dynamicPricingPolicySchema
  );
