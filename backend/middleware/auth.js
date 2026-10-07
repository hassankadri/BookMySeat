const crypto =
  require("crypto");

const jwt =
  require("jsonwebtoken");

const User =
  require("../models/User");

// =====================================================
// HELPERS
// =====================================================

const passwordFingerprint =
  (passwordHash) =>
    crypto
      .createHash(
        "sha256"
      )
      .update(
        String(
          passwordHash ||
          ""
        )
      )
      .digest(
        "hex"
      );

const getBearerToken =
  (req) => {
    const header =
      req.get(
        "Authorization"
      );

    if (!header) {
      return null;
    }

    const match =
      header.match(
        /^Bearer\s+(.+)$/i
      );

    return match
      ? match[1].trim()
      : null;
  };

// =====================================================
// AUTHENTICATE
//
// Supports BOTH:
//
// Old BookMySeat tokens:
// { userId, email }
//
// New hardened tokens:
// { userId, email, type, pwd, ... }
//
// This lets us migrate safely without breaking login.
// =====================================================

const authenticateRequest =
  async (
    req
  ) => {
    const token =
      getBearerToken(
        req
      );

    if (!token) {
      const error =
        new Error(
          "Authentication required."
        );

      error.status =
        401;

      throw error;
    }

    let decoded;

    try {
      decoded =
        jwt.verify(
          token,
          process.env.JWT_SECRET,
          {
            algorithms: [
              "HS256",
            ],
          }
        );
    } catch (error) {
      const authError =
        new Error(
          error.name ===
            "TokenExpiredError"
            ? "Session expired. Please sign in again."
            : "Invalid authentication token."
        );

      authError.status =
        401;

      throw authError;
    }

    if (
      !decoded.userId
    ) {
      const error =
        new Error(
          "Invalid authentication token."
        );

      error.status =
        401;

      throw error;
    }

    // If token has a type, it must be ACCESS.
    // Legacy tokens have no type and are still allowed.
    if (
      decoded.type &&
      decoded.type !==
        "ACCESS"
    ) {
      const error =
        new Error(
          "Invalid authentication token."
        );

      error.status =
        401;

      throw error;
    }

    const user =
      await User.findById(
        decoded.userId
      )
        .select(
          "+password"
        )
        .lean();

    if (!user) {
      const error =
        new Error(
          "Authentication required."
        );

      error.status =
        401;

      throw error;
    }

    if (
      user.emailVerified ===
      false
    ) {
      const error =
        new Error(
          "Email verification required."
        );

      error.status =
        403;

      throw error;
    }

    // New hardened tokens include pwd.
    // Validate it when present.
    //
    // Old tokens don't have pwd, so we don't reject
    // them during this migration.
    if (
      decoded.pwd
    ) {
      const currentFingerprint =
        passwordFingerprint(
          user.password
        );

      if (
        decoded.pwd !==
        currentFingerprint
      ) {
        const error =
          new Error(
            "Session is no longer valid. Please sign in again."
          );

        error.status =
          401;

        throw error;
      }
    }

    delete user.password;

    req.user =
      user;

    req.userId =
      user._id;

    req.auth =
      decoded;
  };

// =====================================================
// USER AUTH
// =====================================================

const auth =
  async (
    req,
    res,
    next
  ) => {
    try {
      await authenticateRequest(
        req
      );

      return next();
    } catch (error) {
      return res
        .status(
          error.status ||
            401
        )
        .json({
          error:
            error.message ||
            "Authentication failed.",
        });
    }
  };

// =====================================================
// ADMIN AUTH
// =====================================================

const adminAuth =
  async (
    req,
    res,
    next
  ) => {
    try {
      if (!req.user) {
        await authenticateRequest(
          req
        );
      }

      if (
        req.user.role !==
        "admin"
      ) {
        return res
          .status(403)
          .json({
            error:
              "Admin access required.",
          });
      }

      return next();
    } catch (error) {
      return res
        .status(
          error.status ||
            401
        )
        .json({
          error:
            error.message ||
            "Authentication failed.",
        });
    }
  };

module.exports = {
  auth,
  adminAuth,
};