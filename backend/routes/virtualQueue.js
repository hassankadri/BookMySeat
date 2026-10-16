
"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Show = require("../models/Show");

const {
  auth,
  adminAuth,
} = require("../middleware/auth");

const {
  getConfiguration,
  configureQueue,
  joinQueue,
  leaveQueue,
} = require("../services/virtualQueueService");

const router = express.Router();

const validId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const invalid = (res, message) =>
  res.status(400).json({
    success: false,
    message,
  });

// =====================================================
// PUBLIC QUEUE CONFIGURATION
// GET /api/queue/shows/:showId
// =====================================================

router.get(
  "/shows/:showId",
  async (req, res) => {
    const { showId } = req.params;

    if (!validId(showId)) {
      return invalid(res, "Invalid show ID.");
    }

    try {
      const show = await Show.exists({
        _id: showId,
        isActive: true,
      });

      if (!show) {
        return res.status(404).json({
          success: false,
          message: "Show not found.",
        });
      }

      return res.json({
        success: true,
        ...(await getConfiguration(showId)),
      });
    } catch (error) {
      console.error(
        "Queue configuration error:",
        error
      );

      return res.status(503).json({
        success: false,
        message: "Queue service unavailable.",
      });
    }
  }
);

// =====================================================
// JOIN / CHECK STATUS
// =====================================================
//
// Both actions are idempotent.
// Repeated requests preserve a waiting user's position.
//
// POST /api/queue/shows/:showId/join
// POST /api/queue/shows/:showId/status

async function handleJoin(req, res) {
  const { showId } = req.params;

  if (!validId(showId)) {
    return invalid(res, "Invalid show ID.");
  }

  try {
    const now = new Date();

    const show = await Show.findOne({
      _id: showId,
      isActive: true,
      status: "SCHEDULED",
      startTime: {
        $gt: now,
      },
    })
      .select(
        "bookingOpensAt bookingClosesAt"
      )
      .lean();

    if (!show) {
      return res.status(404).json({
        success: false,
        message:
          "Show not found or unavailable.",
      });
    }

    if (
      show.bookingOpensAt &&
      now < show.bookingOpensAt
    ) {
      return res.status(409).json({
        success: false,
        code: "BOOKING_NOT_OPEN",
        message:
          "Booking has not opened for this show.",
      });
    }

    if (
      show.bookingClosesAt &&
      now > show.bookingClosesAt
    ) {
      return res.status(409).json({
        success: false,
        code: "BOOKING_CLOSED",
        message:
          "Booking has closed for this show.",
      });
    }

    const status = await joinQueue({
      showId,
      userId: req.userId,
    });

    res.set("Cache-Control", "no-store");

    return res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error(
      "Queue join/status error:",
      error
    );

    return res.status(503).json({
      success: false,
      message:
        "Waiting room temporarily unavailable.",
    });
  }
}

router.post(
  "/shows/:showId/join",
  auth,
  handleJoin
);

router.post(
  "/shows/:showId/status",
  auth,
  handleJoin
);

// =====================================================
// LEAVE QUEUE
// POST /api/queue/shows/:showId/leave
// =====================================================

router.post(
  "/shows/:showId/leave",
  auth,
  async (req, res) => {
    const { showId } = req.params;

    if (!validId(showId)) {
      return invalid(res, "Invalid show ID.");
    }

    try {
      await leaveQueue({
        showId,
        userId: req.userId,
      });

      return res.json({
        success: true,
        message:
          "You left the waiting room.",
      });
    } catch (error) {
      console.error(
        "Queue leave error:",
        error
      );

      return res.status(503).json({
        success: false,
        message:
          "Could not leave the waiting room.",
      });
    }
  }
);

// =====================================================
// ADMIN — ENABLE / DISABLE A SHOW QUEUE
// PATCH /api/queue/admin/shows/:showId
// =====================================================
//
// Example:
// {
//   "enabled": true,
//   "capacity": 10,
//   "admissionSeconds": 300
// }
//
// Disable:
// {
//   "enabled": false
// }
//
// Reconfiguration resets the existing waiting queue
// and invalidates previous admission tokens.

router.patch(
  "/admin/shows/:showId",
  auth,
  adminAuth,
  async (req, res) => {
    const { showId } = req.params;

    if (!validId(showId)) {
      return invalid(res, "Invalid show ID.");
    }

    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      typeof body.enabled !== "boolean" ||
      Object.keys(body).some(
        (field) =>
          ![
            "enabled",
            "capacity",
            "admissionSeconds",
          ].includes(field)
      )
    ) {
      return invalid(
        res,
        "Provide enabled (boolean), capacity and admissionSeconds."
      );
    }

    const capacity =
      body.capacity ?? 10;

    const admissionSeconds =
      body.admissionSeconds ?? 300;

    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 100
    ) {
      return invalid(
        res,
        "Capacity must be a whole number from 1 to 100."
      );
    }

    if (
      !Number.isInteger(admissionSeconds) ||
      admissionSeconds < 60 ||
      admissionSeconds > 900
    ) {
      return invalid(
        res,
        "Admission duration must be 60 to 900 seconds."
      );
    }

    try {
      const show = await Show.findById(showId)
        .select(
          "isActive status startTime"
        )
        .lean();

      if (!show) {
        return res.status(404).json({
          success: false,
          message: "Show not found.",
        });
      }

      if (
        body.enabled &&
        (
          !show.isActive ||
          show.status !== "SCHEDULED" ||
          show.startTime <= new Date()
        )
      ) {
        return invalid(
          res,
          "Only an upcoming, active show can use a virtual queue."
        );
      }

      const configuration =
        await configureQueue({
          showId,
          enabled: body.enabled,
          capacity,
          admissionSeconds,
          expiresAt: new Date(
            new Date(
              show.startTime
            ).getTime() + 86400000
          ),
        });

      return res.json({
        success: true,

        message: body.enabled
          ? "Waiting room enabled."
          : "Waiting room disabled.",

        showId,
        ...configuration,
      });
    } catch (error) {
      console.error(
        "Configure virtual queue error:",
        error
      );

      return res.status(503).json({
        success: false,
        message:
          "Could not update waiting room.",
      });
    }
  }
);

module.exports = router;
