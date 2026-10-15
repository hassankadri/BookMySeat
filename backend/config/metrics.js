const client = require("prom-client");

// Separate registry keeps BookMySeat metrics controlled and explicit.
const register = new client.Registry();

// -----------------------------------------------------
// DEFAULT NODE.JS METRICS
// CPU, memory, event loop, garbage collection, etc.
// -----------------------------------------------------

client.collectDefaultMetrics({
  register,
  prefix: "bookmyseat_",
});

// -----------------------------------------------------
// HTTP METRICS
// -----------------------------------------------------

const httpRequestsTotal = new client.Counter({
  name: "bookmyseat_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "bookmyseat_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
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
  ],
  registers: [register],
});

const httpErrorsTotal = new client.Counter({
  name: "bookmyseat_http_errors_total",
  help: "Total number of HTTP 5xx responses",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// -----------------------------------------------------
// BUSINESS METRICS
// -----------------------------------------------------

const seatLockEventsTotal = new client.Counter({
  name: "bookmyseat_seat_lock_events_total",
  help: "Seat locking events",
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

// -----------------------------------------------------
// HELPERS
// -----------------------------------------------------

const getRouteLabel = (req) => {
  if (req.route?.path) {
    return req.route.path;
  }

  return "unmatched";
};

const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationNanoseconds =
      process.hrtime.bigint() - start;

    const durationSeconds =
      Number(durationNanoseconds) / 1_000_000_000;

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
};

const metricsHandler = async (req, res, next) => {
  try {
    res.setHeader(
      "Content-Type",
      register.contentType
    );

    res.end(
      await register.metrics()
    );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,

  seatLockEventsTotal,
  bookingEventsTotal,
  paymentEventsTotal,
};