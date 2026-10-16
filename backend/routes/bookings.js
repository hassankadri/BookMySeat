
"use strict";

const express = require("express");
const router = express.Router();

// =====================================================
// LEGACY STRIPE CHECKOUT — RETIRED
// =====================================================
//
// The current BookMySeat checkout uses:
//
// POST /api/payments/create-intent
//
// This newer payment flow verifies the authenticated
// customer's Redis seat-lock ownership.
//
// The old POST /api/bookings/checkout endpoint did not
// perform that verification. Allowing it to remain
// active could bypass the distributed locking system.
//
// Reject new legacy checkout requests before forwarding
// any other requests to the compatibility router.

router.post("/checkout", (_req, res) => {
  return res.status(410).json({
    success: false,
    code: "LEGACY_CHECKOUT_RETIRED",
    message:
      "This checkout method is no longer available. " +
      "Select your seats again and continue to secure checkout.",
  });
});

// =====================================================
// PRESERVE LEGACY COMPATIBILITY
// =====================================================
//
// Keep the existing implementation of:
//
// POST /api/bookings/verify-payment
// GET  /api/bookings/my-bookings
//
// Historical Stripe Checkout payments may still need
// verification. Their original logic is preserved in
// bookingsLegacyCompat.js.
//
// The retired /checkout handler above intercepts
// requests before they reach the legacy router.

router.use(require("./bookingsLegacyCompat"));

module.exports = router;
