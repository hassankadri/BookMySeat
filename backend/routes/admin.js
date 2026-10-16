
"use strict";

const express = require("express");

const router = express.Router();

// =====================================================
// FEATURE 6 — ADMIN RISK MONITORING
// =====================================================

router.use(
  "/risk",
  require("./adminRisk")
);

// =====================================================
// FEATURE 7 — CINEMA PARTNER ASSIGNMENTS
// =====================================================
//
// Access to these endpoints is restricted by
// auth and adminAuth inside adminPartnerAssignments.js.

router.use(
  "/partner-assignments",
  require("./adminPartnerAssignments")
);

// =====================================================
// EXISTING ADMIN ROUTES
// =====================================================
//
// Preserve all existing administrative functionality,
// including dashboard statistics, users, bookings,
// refunds and other management operations.

router.use(
  require("./adminCore")
);

module.exports = router;
