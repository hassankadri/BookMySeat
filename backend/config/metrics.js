
"use strict";

const client = require("prom-client");
const mongoose = require("mongoose");

const {
  getRedisClient,
} = require("./redis");

// =====================================================
// BOOKMYSEAT PROMETHEUS REGISTRY
// =====================================================

const register = new client.Registry();

client.collectDefaultMetrics({
  register,
  prefix: "bookmyseat_",
});

// =====================================================
// HTTP REQUEST METRICS
// =====================================================

const httpRequestsTotal = new client.Counter({
  name: "bookmyseat_http_requests_total",
  help: "Total completed HTTP requests",
  labelNames: [
    "method",
    "route",
    "status_code",
  ],
  registers: [register],
});

const httpRequestDurationSeconds =
  new client.Histogram({
    name: "bookmyseat_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: [
      "method",
      "route",
      "status_code",
    ],
    buckets: [
      0.01,
      0.025,
      0.05,
      0.1,
      0.25,
      0.5,
      1,
      2.5,
      5,
      10,
    ],
    registers: [register],
  });

const httpErrorsTotal = new client.Counter({
  name: "bookmyseat_http_errors_total",
  help: "Total HTTP 5xx responses",
  labelNames: [
    "method",
    "route",
    "status_code",
  ],
  registers: [register],
});

// =====================================================
// BOOKING AND PAYMENT BUSINESS METRICS
// =====================================================
//
// Keep these metric names and exports unchanged.
// Existing modules can continue incrementing them.
//
// Counters measure actual events only when their
// corresponding business logic calls .inc().

const seatLockEventsTotal = new client.Counter({
  name: "bookmyseat_seat_lock_events_total",
  help: "Seat locking lifecycle events",
  labelNames: ["event"],
  registers: [register],
});

const bookingEventsTotal = new client.Counter({
  name: "bookmyseat_booking_events_total",
  help: "Booking lifecycle events",
  labelNames: ["event"],
  registers: [register],
});

const paymentEventsTotal = new client.Counter({
  name: "bookmyseat_payment_events_total",
  help: "Payment lifecycle events",
  labelNames: ["event"],
  registers: [register],
});

// =====================================================
// DATABASE AND REDIS HEALTH
// =====================================================
//
// 1 = healthy/connected
// 0 = unavailable
//
// No database URLs, credentials or user information
// are exposed in Prometheus labels.

const mongodbUp = new client.Gauge({
  name: "bookmyseat_mongodb_up",
  help: "MongoDB connection availability: 1 healthy, 0 unavailable",
  registers: [register],
});

const redisUp = new client.Gauge({
  name: "bookmyseat_redis_up",
  help: "Redis connectivity: 1 healthy, 0 unavailable",
  registers: [register],
});

// =====================================================
// LOW-CARDINALITY ROUTE LABELS
// =====================================================
//
// Never use complete raw URLs as metric labels.
// IDs and query strings can create unbounded numbers
// of Prometheus time series.

function sanitizePath(path) {
  return String(path || "")
    .replace(
      /\/[0-9a-f]{24}(?=\/|$)/gi,
      "/:id"
    )
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
      "/:id"
    )
    .replace(
      /\/[0-9]+(?=\/|$)/g,
      "/:id"
    );
}

function getRouteLabel(req) {
  const routePath = req.route?.path;

  if (typeof routePath !== "string") {
    return "unmatched";
  }

  const base = String(req.baseUrl || "");

  const combined =
    `${base}${routePath}`;

  return (
    sanitizePath(combined)
      .replace(/\/{2,}/g, "/")
      .replace(/\/$/, "") || "/"
  );
}

// =====================================================
// HTTP INSTRUMENTATION
// =====================================================

function metricsMiddleware(req, res, next) {
  const startedAt =
    process.hrtime.bigint();

  res.once("finish", () => {
    const durationSeconds =
      Number(
        process.hrtime.bigint() - startedAt
      ) / 1_000_000_000;

    const labels = {
      method: req.method,
      route: getRouteLabel(req),
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);

    httpRequestDurationSeconds.observe(
      labels,
      durationSeconds
    );

    if (res.statusCode >= 500) {
      httpErrorsTotal.inc(labels);
    }
  });

  next();
}

// =====================================================
// TIME-BOUNDED REDIS HEALTH PROBE
// =====================================================
//
// A broken Redis connection must not leave the
// Prometheus scrape hanging indefinitely.
//
// getRedisClient() remains the project's existing
// shared Redis connection implementation.

function withTimeout(operation, milliseconds) {
  let timeoutId;

  const timeout = new Promise(
    (_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error("Health probe timed out.")
        );
      }, milliseconds);
    }
  );

  return Promise.race([
    Promise.resolve(operation),
    timeout,
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function checkRedis() {
  try {
    const redis = await withTimeout(
      getRedisClient(),
      1500
    );

    const response = await withTimeout(
      redis.ping(),
      1500
    );

    return response === "PONG";
  } catch (_error) {
    return false;
  }
}

// =====================================================
// SERVICE HEALTH METRICS
// =====================================================

async function updateServiceHealth() {
  mongodbUp.set(
    mongoose.connection.readyState === 1
      ? 1
      : 0
  );

  redisUp.set(
    (await checkRedis()) ? 1 : 0
  );
}

// =====================================================
// PROMETHEUS SCRAPE ENDPOINT
// =====================================================
//
// The route is already mounted in server.js:
//
// GET /api/metrics

async function metricsHandler(req, res, next) {
  try {
    await updateServiceHealth();

    res.setHeader(
      "Content-Type",
      register.contentType
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.end(
      await register.metrics()
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,

  metricsMiddleware,
  metricsHandler,

  httpRequestsTotal,
  httpRequestDurationSeconds,
  httpErrorsTotal,

  seatLockEventsTotal,
  bookingEventsTotal,
  paymentEventsTotal,

  mongodbUp,
  redisUp,
};
