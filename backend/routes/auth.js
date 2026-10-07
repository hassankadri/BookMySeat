const express =
  require("express");

const bcrypt =
  require("bcryptjs");

const jwt =
  require("jsonwebtoken");

const crypto =
  require("crypto");

const rateLimit =
  require("express-rate-limit");

const {
  OAuth2Client,
} =
  require("google-auth-library");

const {
  body,
  validationResult,
} =
  require("express-validator");

const User =
  require("../models/User");

const {
  auth,
} =
  require("../middleware/auth");

const {
  sendVerificationOtp,
  sendPasswordResetOtp,
} =
  require("../utils/authEmail");

const router =
  express.Router();

// =====================================================
// CONSTANTS
// =====================================================

const OTP_EXPIRY_MINUTES =
  10;

const OTP_RESEND_SECONDS =
  60;

const MAX_OTP_ATTEMPTS =
  5;

const JWT_ISSUER =
  process.env.JWT_ISSUER ||
  "bookmyseat-api";

const JWT_AUDIENCE =
  process.env.JWT_AUDIENCE ||
  "bookmyseat-web";

const JWT_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN ||
  "7d";

const BCRYPT_ROUNDS =
  Math.min(
    14,
    Math.max(
      10,
      Number(
        process.env
          .BCRYPT_ROUNDS ||
          10
      )
    )
  );

const googleClient =
  new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
  );

// =====================================================
// NEVER CACHE AUTH RESPONSES
// =====================================================

router.use(
  (
    req,
    res,
    next
  ) => {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, private"
    );

    res.setHeader(
      "Pragma",
      "no-cache"
    );

    next();
  }
);

// =====================================================
// RATE LIMITERS
// =====================================================

const loginLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    max:
      10,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    skipSuccessfulRequests:
      true,

    message: {
      error:
        "Too many sign-in attempts. Please try again later.",
    },
  });

const googleLimiter =
  rateLimit({
    windowMs:
      15 *
      60 *
      1000,

    max:
      20,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      error:
        "Too many sign-in attempts. Please try again later.",
    },
  });

const otpSendLimiter =
  rateLimit({
    windowMs:
      10 *
      60 *
      1000,

    max:
      8,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      error:
        "Too many code requests. Please wait before trying again.",
    },
  });

const otpVerifyLimiter =
  rateLimit({
    windowMs:
      10 *
      60 *
      1000,

    max:
      20,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      error:
        "Too many verification attempts. Please try again later.",
    },
  });

// =====================================================
// HELPERS
// =====================================================

const normalizeEmail =
  (email) =>
    String(
      email ||
      ""
    )
      .trim()
      .toLowerCase();

const generateOtp =
  () =>
    String(
      crypto.randomInt(
        100000,
        1000000
      )
    );

const hashOtp =
  (otp) => {
    const secret =
      process.env
        .OTP_SECRET ||
      process.env
        .JWT_SECRET;

    if (!secret) {
      throw new Error(
        "OTP secret is not configured."
      );
    }

    return crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        String(otp)
      )
      .digest(
        "hex"
      );
  };

const otpMatches =
  (
    enteredOtp,
    storedHash
  ) => {
    if (
      !enteredOtp ||
      !storedHash
    ) {
      return false;
    }

    const calculated =
      hashOtp(
        enteredOtp
      );

    const first =
      Buffer.from(
        calculated,
        "hex"
      );

    const second =
      Buffer.from(
        storedHash,
        "hex"
      );

    if (
      first.length !==
      second.length
    ) {
      return false;
    }

    return crypto.timingSafeEqual(
      first,
      second
    );
  };

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

const createAccessToken =
  (user) => {
    if (
      !user.password
    ) {
      throw new Error(
        "Cannot issue token without account credential state."
      );
    }

    return jwt.sign(
      {
        userId:
          user._id,

        email:
          user.email,

        type:
          "ACCESS",

        // Invalidates token when password changes.
        pwd:
          passwordFingerprint(
            user.password
          ),
      },

      process.env.JWT_SECRET,

      {
        algorithm:
          "HS256",

        expiresIn:
          JWT_EXPIRES_IN,

        issuer:
          JWT_ISSUER,

        audience:
          JWT_AUDIENCE,

        subject:
          String(
            user._id
          ),
      }
    );
  };

const createPasswordResetToken =
  (user) =>
    jwt.sign(
      {
        userId:
          user._id,

        type:
          "PASSWORD_RESET",

        // Makes the reset token single-use in practice:
        // after password changes, this fingerprint no
        // longer matches.
        pwd:
          passwordFingerprint(
            user.password
          ),

        jti:
          crypto.randomUUID(),
      },

      process.env.JWT_SECRET,

      {
        algorithm:
          "HS256",

        expiresIn:
          "10m",

        issuer:
          JWT_ISSUER,

        audience:
          JWT_AUDIENCE,

        subject:
          String(
            user._id
          ),
      }
    );

const publicUser =
  (user) => ({
    id:
      user._id ||
      user.id,

    name:
      user.name,

    email:
      user.email,

    role:
      user.role,

    emailVerified:
      user.emailVerified !==
      false,
  });

const validationError =
  (
    req,
    res
  ) => {
    const errors =
      validationResult(
        req
      );

    if (
      errors.isEmpty()
    ) {
      return false;
    }

    res
      .status(400)
      .json({
        errors:
          errors.array({
            onlyFirstError:
              true,
          }),
      });

    return true;
  };

const genericResetResponse =
  () => ({
    message:
      "If an account exists, a reset code has been sent.",

    resendAfterSeconds:
      OTP_RESEND_SECONDS,
  });

// =====================================================
// REGISTER
// =====================================================

router.post(
  "/register",

  otpSendLimiter,

  [
    body("name")
      .trim()
      .isLength({
        min: 2,
        max: 80,
      })
      .withMessage(
        "Name must be between 2 and 80 characters."
      ),

    body("email")
      .trim()
      .isEmail()
      .withMessage(
        "Valid email is required."
      )
      .normalizeEmail(),

    body("password")
      .isString()
      .isLength({
        min: 8,
        max: 128,
      })
      .withMessage(
        "Password must be between 8 and 128 characters."
      ),
  ],

  async (
    req,
    res
  ) => {
    try {
      if (
        validationError(
          req,
          res
        )
      ) {
        return;
      }

      const name =
        req.body.name.trim();

      const email =
        normalizeEmail(
          req.body.email
        );

      const password =
        req.body.password;

      const existing =
        await User.findOne({
          email,
        });

      if (
        existing &&
        existing.emailVerified !==
          false
      ) {
        return res
          .status(409)
          .json({
            error:
              "Email already registered.",
          });
      }

      if (
        existing
          ?.emailVerification
          ?.lastSentAt
      ) {
        const elapsed =
          Math.floor(
            (
              Date.now() -
              new Date(
                existing
                  .emailVerification
                  .lastSentAt
              ).getTime()
            ) /
              1000
          );

        if (
          elapsed <
          OTP_RESEND_SECONDS
        ) {
          return res
            .status(429)
            .json({
              error:
                "Please wait before requesting another code.",

              retryAfterSeconds:
                OTP_RESEND_SECONDS -
                elapsed,
            });
        }
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );

      const otp =
        generateOtp();

      const now =
        new Date();

      const expiresAt =
        new Date(
          now.getTime() +
            OTP_EXPIRY_MINUTES *
              60 *
              1000
        );

      let user =
        existing;

      if (user) {
        user.name =
          name;

        user.password =
          hashedPassword;

        user.emailVerified =
          false;
      } else {
        user =
          new User({
            name,
            email,

            password:
              hashedPassword,

            emailVerified:
              false,
          });
      }

      user.emailVerification = {
        otpHash:
          hashOtp(otp),

        expiresAt,

        lastSentAt:
          now,

        attempts:
          0,
      };

      await user.save();

      try {
        await sendVerificationOtp({
          email,
          name,
          otp,
        });
      } catch (error) {
        console.error(
          "Verification email error:",
          error
        );

        return res
          .status(500)
          .json({
            error:
              "Account created, but the verification email could not be sent. Please request another code.",
          });
      }

      return res.json({
        message:
          "Verification code sent.",

        email,

        expiresInSeconds:
          OTP_EXPIRY_MINUTES *
          60,

        resendAfterSeconds:
          OTP_RESEND_SECONDS,
      });
    } catch (error) {
      console.error(
        "Register error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Registration failed.",
        });
    }
  }
);

// =====================================================
// VERIFY EMAIL
// =====================================================

router.post(
  "/verify-email",

  otpVerifyLimiter,

  [
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail(),

    body("otp")
      .isString()
      .matches(
        /^\d{6}$/
      ),
  ],

  async (
    req,
    res
  ) => {
    try {
      if (
        validationError(
          req,
          res
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Enter a valid email and 6-digit code.",
          });
      }

      const email =
        normalizeEmail(
          req.body.email
        );

      const otp =
        String(
          req.body.otp
        ).trim();

      const user =
        await User.findOne({
          email,
        });

      // Avoid giving an attacker useful account state.
      if (!user) {
        return res
          .status(400)
          .json({
            error:
              "Invalid or expired verification code.",
          });
      }

      if (
        user.emailVerified !==
        false
      ) {
        return res.json({
          message:
            "Email already verified.",
        });
      }

      const verification =
        user.emailVerification;

      if (
        !verification
          ?.otpHash ||
        !verification
          ?.expiresAt
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid or expired verification code.",
          });
      }

      if (
        new Date(
          verification.expiresAt
        ).getTime() <
        Date.now()
      ) {
        return res
          .status(400)
          .json({
            error:
              "Verification code expired.",
          });
      }

      if (
        Number(
          verification.attempts ||
            0
        ) >=
        MAX_OTP_ATTEMPTS
      ) {
        return res
          .status(429)
          .json({
            error:
              "Too many incorrect attempts. Request a new code.",
          });
      }

      if (
        !otpMatches(
          otp,
          verification.otpHash
        )
      ) {
        user.emailVerification.attempts =
          Number(
            user.emailVerification
              .attempts ||
              0
          ) + 1;

        await user.save();

        return res
          .status(400)
          .json({
            error:
              "Incorrect verification code.",
          });
      }

      user.emailVerified =
        true;

      user.emailVerification = {
        otpHash:
          null,

        expiresAt:
          null,

        lastSentAt:
          null,

        attempts:
          0,
      };

      await user.save();

      return res.json({
        message:
          "Email verified successfully.",
      });
    } catch (error) {
      console.error(
        "Verify email error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Email verification failed.",
        });
    }
  }
);

// =====================================================
// RESEND VERIFICATION
// =====================================================

router.post(
  "/resend-verification",

  otpSendLimiter,

  [
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail(),
  ],

  async (
    req,
    res
  ) => {
    try {
      if (
        validationError(
          req,
          res
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Valid email is required.",
          });
      }

      const email =
        normalizeEmail(
          req.body.email
        );

      const user =
        await User.findOne({
          email,
        });

      // Generic response reduces account enumeration.
      if (
        !user ||
        user.emailVerified !==
          false
      ) {
        return res.json({
          message:
            "If verification is required, a new code has been sent.",

          resendAfterSeconds:
            OTP_RESEND_SECONDS,
        });
      }

      const lastSent =
        user.emailVerification
          ?.lastSentAt;

      if (lastSent) {
        const elapsed =
          Math.floor(
            (
              Date.now() -
              new Date(
                lastSent
              ).getTime()
            ) /
              1000
          );

        if (
          elapsed <
          OTP_RESEND_SECONDS
        ) {
          return res
            .status(429)
            .json({
              error:
                "Please wait before requesting another code.",

              retryAfterSeconds:
                OTP_RESEND_SECONDS -
                elapsed,
            });
        }
      }

      const otp =
        generateOtp();

      const now =
        new Date();

      user.emailVerification = {
        otpHash:
          hashOtp(otp),

        expiresAt:
          new Date(
            now.getTime() +
              OTP_EXPIRY_MINUTES *
                60 *
                1000
          ),

        lastSentAt:
          now,

        attempts:
          0,
      };

      await user.save();

      await sendVerificationOtp({
        email:
          user.email,

        name:
          user.name,

        otp,
      });

      return res.json({
        message:
          "New code sent.",

        resendAfterSeconds:
          OTP_RESEND_SECONDS,
      });
    } catch (error) {
      console.error(
        "Resend verification error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to resend verification code.",
        });
    }
  }
);

// =====================================================
// FORGOT PASSWORD
//
// Always returns a generic account-existence response.
// =====================================================

router.post(
  "/forgot-password",

  otpSendLimiter,

  [
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail(),
  ],

  async (
    req,
    res
  ) => {
    try {
      if (
        validationError(
          req,
          res
        )
      ) {
        // Still use a generic message.
        return res.json(
          genericResetResponse()
        );
      }

      const email =
        normalizeEmail(
          req.body.email
        );

      const user =
        await User.findOne({
          email,
        });

      if (!user) {
        return res.json(
          genericResetResponse()
        );
      }

      const lastSent =
        user.passwordReset
          ?.lastSentAt;

      if (lastSent) {
        const elapsed =
          Math.floor(
            (
              Date.now() -
              new Date(
                lastSent
              ).getTime()
            ) /
              1000
          );

        // Keep response generic so it does not reveal
        // whether the account actually exists.
        if (
          elapsed <
          OTP_RESEND_SECONDS
        ) {
          return res.json(
            genericResetResponse()
          );
        }
      }

      const otp =
        generateOtp();

      const now =
        new Date();

      user.passwordReset = {
        otpHash:
          hashOtp(otp),

        expiresAt:
          new Date(
            now.getTime() +
              OTP_EXPIRY_MINUTES *
                60 *
                1000
          ),

        lastSentAt:
          now,

        attempts:
          0,
      };

      await user.save();

      try {
        await sendPasswordResetOtp({
          email:
            user.email,

          name:
            user.name,

          otp,
        });
      } catch (error) {
        // Do not reveal that this particular email exists.
        console.error(
          "Password reset email error:",
          error
        );
      }

      return res.json(
        genericResetResponse()
      );
    } catch (error) {
      console.error(
        "Forgot password error:",
        error
      );

      // Still avoid leaking account state.
      return res.json(
        genericResetResponse()
      );
    }
  }
);

// =====================================================
// VERIFY RESET OTP
// =====================================================

router.post(
  "/verify-reset-otp",

  otpVerifyLimiter,

  [
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail(),

    body("otp")
      .isString()
      .matches(
        /^\d{6}$/
      ),
  ],

  async (
    req,
    res
  ) => {
    try {
      if (
        validationError(
          req,
          res
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid or expired code.",
          });
      }

      const email =
        normalizeEmail(
          req.body.email
        );

      const otp =
        String(
          req.body.otp
        ).trim();

      const user =
        await User.findOne({
          email,
        }).select(
          "+password"
        );

      if (!user) {
        return res
          .status(400)
          .json({
            error:
              "Invalid or expired code.",
          });
      }

      const reset =
        user.passwordReset;

      if (
        !reset?.otpHash ||
        !reset?.expiresAt
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid or expired code.",
          });
      }

      if (
        new Date(
          reset.expiresAt
        ).getTime() <
        Date.now()
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid or expired code.",
          });
      }

      if (
        Number(
          reset.attempts ||
            0
        ) >=
        MAX_OTP_ATTEMPTS
      ) {
        return res
          .status(429)
          .json({
            error:
              "Too many incorrect attempts. Request a new code.",
          });
      }

      if (
        !otpMatches(
          otp,
          reset.otpHash
        )
      ) {
        user.passwordReset.attempts =
          Number(
            user.passwordReset
              .attempts ||
              0
          ) + 1;

        await user.save();

        return res
          .status(400)
          .json({
            error:
              "Invalid or expired code.",
          });
      }

      const resetToken =
        createPasswordResetToken(
          user
        );

      // OTP cannot be reused.
      user.passwordReset.otpHash =
        null;

      user.passwordReset.expiresAt =
        null;

      user.passwordReset.attempts =
        0;

      await user.save();

      return res.json({
        message:
          "Code verified.",

        resetToken,
      });
    } catch (error) {
      console.error(
        "Reset verification error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Could not verify code.",
        });
    }
  }
);

// =====================================================
// RESET PASSWORD
// =====================================================

router.post(
  "/reset-password",

  otpVerifyLimiter,

  [
    body("resetToken")
      .isString()
      .notEmpty(),

    body("password")
      .isString()
      .isLength({
        min: 8,
        max: 128,
      })
      .withMessage(
        "Password must be between 8 and 128 characters."
      ),
  ],

  async (
    req,
    res
  ) => {
    try {
      if (
        validationError(
          req,
          res
        )
      ) {
        return;
      }

      const {
        resetToken,
        password,
      } =
        req.body;

      let payload;

      try {
        payload =
          jwt.verify(
            resetToken,
            process.env.JWT_SECRET,
            {
              algorithms: [
                "HS256",
              ],

              issuer:
                JWT_ISSUER,

              audience:
                JWT_AUDIENCE,
            }
          );
      } catch {
        return res
          .status(400)
          .json({
            error:
              "Reset session expired or invalid.",
          });
      }

      if (
        payload.type !==
        "PASSWORD_RESET" ||
        !payload.userId ||
        !payload.pwd
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid reset request.",
          });
      }

      const user =
        await User.findById(
          payload.userId
        ).select(
          "+password"
        );

      if (!user) {
        return res
          .status(400)
          .json({
            error:
              "Invalid reset request.",
          });
      }

      // If this reset token has already been used,
      // user.password is different and the fingerprint
      // no longer matches.
      if (
        passwordFingerprint(
          user.password
        ) !==
        payload.pwd
      ) {
        return res
          .status(400)
          .json({
            error:
              "Reset session has already been used or is no longer valid.",
          });
      }

      user.password =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );

      user.passwordReset = {
        otpHash:
          null,

        expiresAt:
          null,

        lastSentAt:
          null,

        attempts:
          0,
      };

      await user.save();

      return res.json({
        message:
          "Password changed successfully. Please sign in again.",
      });
    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Could not reset password.",
        });
    }
  }
);

// =====================================================
// GOOGLE LOGIN
// =====================================================

router.post(
  "/google",

  googleLimiter,

  [
    body("credential")
      .isString()
      .notEmpty()
      .withMessage(
        "Google credential is required."
      ),
  ],

  async (
    req,
    res
  ) => {
    try {
      if (
        validationError(
          req,
          res
        )
      ) {
        return;
      }

      if (
        !process.env
          .GOOGLE_CLIENT_ID
      ) {
        throw new Error(
          "Google authentication is not configured."
        );
      }

      const ticket =
        await googleClient.verifyIdToken({
          idToken:
            req.body.credential,

          audience:
            process.env
              .GOOGLE_CLIENT_ID,
        });

      const googleUser =
        ticket.getPayload();

      if (
        !googleUser ||
        !googleUser.sub ||
        !googleUser.email ||
        !googleUser.email_verified
      ) {
        return res
          .status(401)
          .json({
            error:
              "Google account could not be verified.",
          });
      }

      const email =
        normalizeEmail(
          googleUser.email
        );

      let user =
        await User.findOne({
          email,
        }).select(
          "+password"
        );

      if (user) {
        if (
          user.googleId &&
          user.googleId !==
            googleUser.sub
        ) {
          return res
            .status(409)
            .json({
              error:
                "This email is already linked to another Google account.",
            });
        }

        user.googleId =
          googleUser.sub;

        user.emailVerified =
          true;

        if (
          !user.name &&
          googleUser.name
        ) {
          user.name =
            googleUser.name;
        }

        user.emailVerification = {
          otpHash:
            null,

          expiresAt:
            null,

          lastSentAt:
            null,

          attempts:
            0,
        };

        await user.save();
      } else {
        // User model currently requires a password.
        // Google users receive an inaccessible random
        // password and may later set their own through
        // Forgot Password.
        const randomPassword =
          crypto
            .randomBytes(
              32
            )
            .toString(
              "hex"
            );

        const hashedPassword =
          await bcrypt.hash(
            randomPassword,
            BCRYPT_ROUNDS
          );

        user =
          await User.create({
            name:
              googleUser.name ||
              email.split(
                "@"
              )[0],

            email,

            password:
              hashedPassword,

            googleId:
              googleUser.sub,

            emailVerified:
              true,
          });
      }

      const token =
        createAccessToken(
          user
        );

      return res.json({
        message:
          "Google sign-in successful.",

        token,

        user:
          publicUser(
            user
          ),
      });
    } catch (error) {
      console.error(
        "Google login error:",
        error
      );

      return res
        .status(401)
        .json({
          error:
            "Google sign-in failed. Please try again.",
        });
    }
  }
);

// =====================================================
// PASSWORD LOGIN
// =====================================================

router.post(
  "/login",

  loginLimiter,

  [
    body("email")
      .trim()
      .isEmail()
      .normalizeEmail(),

    body("password")
      .isString()
      .isLength({
        min: 1,
        max: 128,
      }),
  ],

  async (
    req,
    res
  ) => {
    try {
      if (
        validationError(
          req,
          res
        )
      ) {
        return res
          .status(401)
          .json({
            error:
              "Invalid email or password.",
          });
      }

      const email =
        normalizeEmail(
          req.body.email
        );

      const user =
        await User.findOne({
          email,
        }).select(
          "+password"
        );

      // Use the same response for both "email missing"
      // and "wrong password".
      if (!user) {
        return res
          .status(401)
          .json({
            error:
              "Invalid email or password.",
          });
      }

      const valid =
        await bcrypt.compare(
          req.body.password,
          user.password
        );

      if (!valid) {
        return res
          .status(401)
          .json({
            error:
              "Invalid email or password.",
          });
      }

      if (
        user.emailVerified ===
        false
      ) {
        return res
          .status(403)
          .json({
            error:
              "Please verify your email before signing in.",

            code:
              "EMAIL_NOT_VERIFIED",
          });
      }

      const token =
        createAccessToken(
          user
        );

      return res.json({
        message:
          "Login successful.",

        token,

        user:
          publicUser(
            user
          ),
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Login failed.",
        });
    }
  }
);

// =====================================================
// CURRENT USER
// =====================================================

router.get(
  "/me",

  auth,

  (
    req,
    res
  ) => {
    return res.json({
      user:
        publicUser(
          req.user
        ),
    });
  }
);

module.exports =
  router;