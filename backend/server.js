require("dotenv").config();

const crypto = require("crypto");
const http = require("http");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");

const {
  initSocketServer,
} = require("./config/socket");

// =====================================================
// ROUTES
// =====================================================

const authRoutes =
  require("./routes/auth");

const movieRoutes =
  require("./routes/movies");

const theatreRoutes =
  require("./routes/theatres");

const screenRoutes =
  require("./routes/screens");

const showRoutes =
  require("./routes/shows");

const seatLockRoutes =
  require("./routes/seatLocks");

const paymentRoutes =
  require("./routes/payments");

const bookingRoutes =
  require("./routes/bookings");

const adminRoutes =
  require("./routes/admin");

const stripeWebhookRoutes =
  require("./routes/stripeWebhook");

const ticketRoutes =
  require("./routes/tickets");

const contactRoutes =
  require("./routes/contact");

const customerBookingRoutes =
  require("./routes/customerBookings");

const adminAnalyticsRoutes =
  require("./routes/adminAnalytics");

const aiRoutes =
  require("./routes/ai");

// =====================================================
// SEEDING
// =====================================================

const {
  seedAdmin,
} = require("./utils/seed");

// =====================================================
// BACKGROUND WORKERS
// =====================================================

const {
  startBookingExpiryWorker,
} =
  require("./services/bookingExpiryService");

const {
  startBookingNotificationWorker,
} =
  require("./services/bookingNotificationWorker");

// =====================================================
// ENVIRONMENT
// =====================================================

const isProduction =
  process.env.NODE_ENV ===
  "production";

const PORT =
  Number(
    process.env.PORT ||
      8001
  );

const mongoUrl =
  process.env.MONGO_URL;

const dbName =
  process.env.DB_NAME;

const jwtSecret =
  process.env.JWT_SECRET;

const requiredEnvironment = [
  ["MONGO_URL", mongoUrl],
  ["DB_NAME", dbName],
  ["JWT_SECRET", jwtSecret],
];

const missingEnvironment =
  requiredEnvironment
    .filter(
      ([, value]) =>
        !value
    )
    .map(
      ([name]) =>
        name
    );

if (
  missingEnvironment.length
) {
  console.error(
    `❌ Missing environment variables: ${missingEnvironment.join(
      ", "
    )}`
  );

  process.exit(1);
}

// Weak JWT secrets make signed tokens much easier
// to compromise. Do not silently start with one.
if (
  jwtSecret.length < 32
) {
  console.error(
    "❌ JWT_SECRET must be at least 32 characters long."
  );

  process.exit(1);
}

// =====================================================
// CORS
// =====================================================

const defaultDevelopmentOrigins =
  "http://localhost:3000,http://localhost:5173";

if (
  isProduction &&
  !process.env.CORS_ORIGINS
) {
  console.error(
    "❌ CORS_ORIGINS must be configured in production."
  );

  process.exit(1);
}

const normalizeOrigin = (
  origin
) =>
  String(origin || "")
    .trim()
    .replace(/\/+$/, "");

const allowedOrigins =
  (
    process.env.CORS_ORIGINS ||
    defaultDevelopmentOrigins
  )
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

const allowedOriginSet =
  new Set(
    allowedOrigins
  );

// =====================================================
// APP
// =====================================================

const app =
  express();

const httpServer =
  http.createServer(app);

// Hide Express fingerprint.
app.disable(
  "x-powered-by"
);

// Needed when deployed behind Render,
// Railway, Nginx, Cloudflare, etc.
if (isProduction) {
  app.set(
    "trust proxy",
    1
  );
}

// =====================================================
// REQUEST ID
// =====================================================

app.use(
  (
    req,
    res,
    next
  ) => {
    const requestId =
      req.get(
        "X-Request-Id"
      ) ||
      crypto.randomUUID();

    req.requestId =
      requestId;

    res.setHeader(
      "X-Request-Id",
      requestId
    );

    next();
  }
);

// =====================================================
// SECURITY HEADERS
// =====================================================

app.use(
  helmet({
    // This backend is an API rather than a page-rendering
    // server. Allow frontend resources to call it.
    crossOriginResourcePolicy: {
      policy:
        "cross-origin",
    },

    // Avoid HSTS while developing on localhost.
    hsts:
      isProduction
        ? undefined
        : false,
  })
);

// =====================================================
// CORS
// =====================================================

app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      // Server-to-server tools such as Stripe may not
      // send a browser Origin header.
      if (!origin) {
        return callback(
          null,
          true
        );
      }

      const normalized =
        normalizeOrigin(
          origin
        );

      if (
        allowedOriginSet.has(
          normalized
        )
      ) {
        return callback(
          null,
          true
        );
      }

      const error =
        new Error(
          "CORS_ORIGIN_BLOCKED"
        );

      error.status =
        403;

      return callback(
        error
      );
    },

    credentials:
      true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-Id",
    "Cache-Control",
    ],

    optionsSuccessStatus:
      204,
  })
);

// =====================================================
// SOCKET.IO
// =====================================================

initSocketServer(
  httpServer,
  {
    allowedOrigins,
  }
);

// =====================================================
// STRIPE WEBHOOK
//
// MUST REMAIN BEFORE express.json().
//
// Stripe signature verification needs the exact raw body.
// It is also mounted before the general API rate limiter
// so legitimate Stripe retries are not accidentally
// throttled.
// =====================================================

app.use(
  "/api/webhooks/stripe",

  express.raw({
    type:
      "application/json",

    limit:
      "1mb",
  }),

  stripeWebhookRoutes
);

// =====================================================
// GENERAL API RATE LIMIT
// =====================================================

const apiLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    max: Number(
      process.env
        .API_RATE_LIMIT ||
        500
    ),

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      error:
        "Too many requests. Please try again later.",
    },
  });

app.use(
  "/api",
  apiLimiter
);

// =====================================================
// BODY PARSERS
// =====================================================

app.use(
  express.json({
    limit:
      "1mb",

    strict:
      true,
  })
);

app.use(
  express.urlencoded({
    extended:
      false,

    limit:
      "1mb",

    parameterLimit:
      100,
  })
);

// =====================================================
// DATABASE SETTINGS
// =====================================================

mongoose.set(
  "strictQuery",
  true
);

// =====================================================
// HEALTH
// =====================================================

app.get(
  "/api/",

  (
    req,
    res
  ) => {
    return res.json({
      success:
        true,

      service:
        "BookMySeat API",

      status:
        "ok",

      database:
        mongoose.connection
          .readyState ===
        1
          ? "connected"
          : "unavailable",
    });
  }
);

// =====================================================
// API ROUTES
// =====================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/movies",
  movieRoutes
);

app.use(
  "/api/theatres",
  theatreRoutes
);

app.use(
  "/api/screens",
  screenRoutes
);

app.use(
  "/api/shows",
  showRoutes
);

app.use(
  "/api/seat-locks",
  seatLockRoutes
);

app.use(
  "/api/payments",
  paymentRoutes
);

app.use(
  "/api/bookings",
  bookingRoutes
);

app.use(
  "/api/admin",
  adminRoutes
);

app.use(
  "/api/tickets",
  ticketRoutes
);

app.use(
  "/api/contact",
  contactRoutes
);

app.use(
  "/api/admin/analytics",
  adminAnalyticsRoutes
);

app.use(
  "/api/customer-bookings",
  customerBookingRoutes
);

app.use(
  "/api/ai",
  aiRoutes
);

// =====================================================
// 404
// =====================================================

app.use(
  (
    req,
    res
  ) => {
    return res
      .status(404)
      .json({
        error:
          "API route not found.",

        requestId:
          req.requestId,
      });
  }
);

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {
    // Keep server-side details in logs.
    console.error(
      `[${req.requestId}]`,
      err.stack ||
        err
    );

    if (
      err.message ===
      "CORS_ORIGIN_BLOCKED"
    ) {
      return res
        .status(403)
        .json({
          error:
            "This origin is not allowed.",

          requestId:
            req.requestId,
        });
    }

    if (
      err.type ===
      "entity.too.large"
    ) {
      return res
        .status(413)
        .json({
          error:
            "Request body is too large.",

          requestId:
            req.requestId,
        });
    }

    if (
      err instanceof
      SyntaxError
    ) {
      return res
        .status(400)
        .json({
          error:
            "Invalid request body.",

          requestId:
            req.requestId,
        });
    }

    const status =
      Number(
        err.status ||
          err.statusCode ||
          500
      );

    // Never leak internal exception messages to users
    // for unexpected production failures.
    const message =
      status >= 500
        ? isProduction
          ? "Internal server error."
          : err.message ||
            "Internal server error."
        : err.message ||
          "Request failed.";

    return res
      .status(status)
      .json({
        error:
          message,

        requestId:
          req.requestId,
      });
  }
);

// =====================================================
// START
// =====================================================

let shuttingDown =
  false;

const startServer =
  async () => {
    try {
      await mongoose.connect(
        `${mongoUrl.replace(
          /\/$/,
          ""
        )}/${dbName}`,
        {
          serverSelectionTimeoutMS:
            10000,
        }
      );

      console.log(
        "✅ MongoDB connected successfully"
      );

      console.log(
        `✅ Database: ${mongoose.connection.name}`
      );

      await seedAdmin();

      startBookingExpiryWorker();

      startBookingNotificationWorker();

      httpServer.listen(
        PORT,
        "0.0.0.0",
        () => {
          console.log(
            `🚀 Server running on port ${PORT}`
          );

          console.log(
            `🔒 Environment: ${
              isProduction
                ? "production"
                : "development"
            }`
          );
        }
      );
    } catch (error) {
      console.error(
        "❌ Server startup failed:",
        error
      );

      process.exit(1);
    }
  };

// =====================================================
// GRACEFUL SHUTDOWN
// =====================================================

const shutdown =
  async (
    signal
  ) => {
    if (
      shuttingDown
    ) {
      return;
    }

    shuttingDown =
      true;

    console.log(
      `\n${signal} received. Shutting down...`
    );

    const forceExit =
      setTimeout(
        () => {
          console.error(
            "Forced shutdown after timeout."
          );

          process.exit(1);
        },
        10000
      );

    forceExit.unref();

    httpServer.close(
      async () => {
        try {
          await mongoose.connection.close();

          console.log(
            "✅ MongoDB connection closed"
          );

          process.exit(0);
        } catch (error) {
          console.error(
            "Shutdown error:",
            error
          );

          process.exit(1);
        }
      }
    );
  };

process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
);

process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);

startServer();

module.exports =
  app;