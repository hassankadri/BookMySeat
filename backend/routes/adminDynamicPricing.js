
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const { auth, adminAuth } = require("../middleware/auth");
const Show = require("../models/Show");
const DynamicPricingPolicy = require("../models/DynamicPricingPolicy");

const router = express.Router();

router.use(auth, adminAuth);

const DEFAULTS = Object.freeze({
  enabled: false,
  minMultiplier: 0.9,
  maxMultiplier: 1.3,
  lowOccupancyThreshold: 0.3,
  highOccupancyThreshold: 0.75,
  lowDemandDiscount: 0.05,
  highDemandSurcharge: 0.15,
  last48HoursSurcharge: 0.05,
  last12HoursSurcharge: 0.05,
  weekendSurcharge: 0.05,
  openingWeekSurcharge: 0.05,
});

const BOUNDS = Object.freeze({
  minMultiplier: [0.8, 1],
  maxMultiplier: [1, 1.5],
  lowOccupancyThreshold: [0, 1],
  highOccupancyThreshold: [0, 1],
  lowDemandDiscount: [0, 0.2],
  highDemandSurcharge: [0, 0.3],
  last48HoursSurcharge: [0, 0.15],
  last12HoursSurcharge: [0, 0.15],
  weekendSurcharge: [0, 0.15],
  openingWeekSurcharge: [0, 0.15],
});

const isObjectId = (value) =>
  /^[0-9a-f]{24}$/i.test(String(value || ""));

const cleanPolicy = (policy) => ({
  ...DEFAULTS,
  ...(policy
    ? Object.fromEntries(
        Object.keys(DEFAULTS)
          .filter((key) => policy[key] !== undefined)
          .map((key) => [key, policy[key]])
      )
    : {}),
});

const invalid = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

function validateUpdates(body, existing) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw invalid("A pricing policy object is required.");
  }

  const keys = Object.keys(body);

  if (!keys.length) {
    throw invalid("Provide at least one pricing setting.");
  }

  const patch = {};

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      throw invalid(`Unsupported pricing setting: ${key}.`);
    }

    const value = body[key];

    if (key === "enabled") {
      if (typeof value !== "boolean") {
        throw invalid("Enabled must be true or false.");
      }

      patch.enabled = value;
      continue;
    }

    const [minimum, maximum] = BOUNDS[key];

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    ) {
      throw invalid(
        `${key} must be between ${minimum} and ${maximum}.`
      );
    }

    patch[key] = value;
  }

  const next = {
    ...cleanPolicy(existing),
    ...patch,
  };

  if (
    next.lowOccupancyThreshold >=
    next.highOccupancyThreshold
  ) {
    throw invalid(
      "The low occupancy threshold must be below the high threshold."
    );
  }

  if (next.minMultiplier > next.maxMultiplier) {
    throw invalid(
      "The minimum multiplier cannot exceed the maximum multiplier."
    );
  }

  return patch;
}

function handleError(res, error, context) {
  if (error.status === 400) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "The policy was updated concurrently. Reload and retry.",
    });
  }

  console.error(context, error);

  return res.status(500).json({
    success: false,
    message: "Unable to process the pricing policy.",
  });
}

// =====================================================
// GET /api/admin/pricing
// List upcoming shows with their pricing policies.
// =====================================================

router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page ?? 1);

    if (!Number.isInteger(page) || page < 1 || page > 10000) {
      throw invalid("Invalid page number.");
    }

    const limit = 30;

    const filter = {
      status: "SCHEDULED",
      isActive: true,
      startTime: { $gt: new Date() },
    };

    const [shows, total] = await Promise.all([
      Show.find(filter)
        .select("movie theatre screen startTime pricing price")
        .populate("movie", "title")
        .populate("theatre", "name city")
        .populate("screen", "name screenNumber")
        .sort({ startTime: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Show.countDocuments(filter),
    ]);

    const policies = shows.length
      ? await DynamicPricingPolicy.find({
          show: { $in: shows.map((show) => show._id) },
        }).lean()
      : [];

    const policyMap = new Map(
      policies.map((policy) => [
        String(policy.show),
        cleanPolicy(policy),
      ])
    );

    return res.json({
      success: true,
      shows: shows.map((show) => ({
        ...show,
        dynamicPricing:
          policyMap.get(String(show._id)) || cleanPolicy(null),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleError(res, error, "Pricing show list error:");
  }
});

// =====================================================
// GET /api/admin/pricing/:showId
// =====================================================

router.get("/:showId", async (req, res) => {
  try {
    const { showId } = req.params;

    if (!isObjectId(showId)) {
      throw invalid("Invalid show ID.");
    }

    const show = await Show.findById(showId)
      .select("movie theatre screen startTime status isActive pricing price")
      .populate("movie", "title")
      .populate("theatre", "name city")
      .populate("screen", "name screenNumber")
      .lean();

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found.",
      });
    }

    const policy = await DynamicPricingPolicy.findOne({
      show: showId,
    }).lean();

    return res.json({
      success: true,
      show,
      policy: cleanPolicy(policy),
      updatedAt: policy?.updatedAt || null,
    });
  } catch (error) {
    return handleError(res, error, "Pricing policy lookup error:");
  }
});

// =====================================================
// PUT /api/admin/pricing/:showId
// Save validated pricing policy.
// =====================================================

router.put("/:showId", async (req, res) => {
  try {
    const { showId } = req.params;

    if (!isObjectId(showId)) {
      throw invalid("Invalid show ID.");
    }

    const show = await Show.findById(showId)
      .select("status isActive startTime pricing")
      .lean();

    if (!show) {
      return res.status(404).json({
        success: false,
        message: "Show not found.",
      });
    }

    if (
      show.status !== "SCHEDULED" ||
      !show.isActive ||
      new Date(show.startTime).getTime() <= Date.now()
    ) {
      return res.status(409).json({
        success: false,
        message: "Pricing can only be changed for upcoming active shows.",
      });
    }

    const existing = await DynamicPricingPolicy.findOne({
      show: showId,
    }).lean();

    const patch = validateUpdates(req.body, existing);

    const nextEnabled =
      patch.enabled ?? existing?.enabled ?? false;

    if (
      nextEnabled &&
      !(show.pricing || []).some(
        (item) =>
          Number.isFinite(Number(item.price)) &&
          Number(item.price) > 0
      )
    ) {
      return res.status(409).json({
        success: false,
        message: "Configure the show's base ticket prices first.",
      });
    }

    const policy = await DynamicPricingPolicy.findOneAndUpdate(
      { show: new mongoose.Types.ObjectId(showId) },
      {
        $set: {
          ...patch,
          updatedBy: req.userId,
        },
        $setOnInsert: {
          show: new mongoose.Types.ObjectId(showId),
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.json({
      success: true,
      message: policy.enabled
        ? "Dynamic pricing policy enabled."
        : "Pricing policy saved. Dynamic pricing is disabled.",
      policy: cleanPolicy(policy.toObject()),
      updatedAt: policy.updatedAt,
    });
  } catch (error) {
    return handleError(res, error, "Pricing policy update error:");
  }
});

module.exports = router;
