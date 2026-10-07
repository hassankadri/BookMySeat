const express = require("express");
const { Resend } = require("resend");
const {
  body,
  validationResult,
} = require("express-validator");

const router = express.Router();

// =====================================================
// SIMPLE ANTI-SPAM RATE LIMIT
// =====================================================

const attempts = new Map();

const RATE_WINDOW_MS =
  10 * 60 * 1000;

const MAX_MESSAGES = 5;

const contactRateLimit = (
  req,
  res,
  next
) => {
  const key =
    req.ip ||
    req.socket
      ?.remoteAddress ||
    "unknown";

  const now =
    Date.now();

  const current =
    attempts.get(key) || {
      count: 0,
      resetAt:
        now +
        RATE_WINDOW_MS,
    };

  if (
    now >
    current.resetAt
  ) {
    current.count = 0;

    current.resetAt =
      now +
      RATE_WINDOW_MS;
  }

  current.count += 1;

  attempts.set(
    key,
    current
  );

  if (
    current.count >
    MAX_MESSAGES
  ) {
    return res
      .status(429)
      .json({
        error:
          "Too many messages. Please try again later.",
      });
  }

  next();
};

// =====================================================
// CONTACT FORM
// =====================================================

router.post(
  "/",

  contactRateLimit,

  [
    body("fullName")
      .trim()
      .isLength({
        min: 2,
        max: 80,
      })
      .withMessage(
        "Please enter your name."
      ),

    body("email")
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage(
        "Please enter a valid email."
      ),

    body("phone")
      .optional({
        checkFalsy: true,
      })
      .trim()
      .isLength({
        max: 25,
      }),

    body("subject")
      .trim()
      .isLength({
        min: 2,
        max: 100,
      })
      .withMessage(
        "Please select a subject."
      ),

    body("message")
      .trim()
      .isLength({
        min: 5,
        max: 3000,
      })
      .withMessage(
        "Message must be between 5 and 3000 characters."
      ),
  ],

  async (
    req,
    res
  ) => {
    try {
      // Honeypot bot field.
      if (
        req.body.website
      ) {
        return res.json({
          success: true,
        });
      }

      const errors =
        validationResult(
          req
        );

      if (
        !errors.isEmpty()
      ) {
        return res
          .status(400)
          .json({
            error:
              errors.array()[0]
                .msg,
          });
      }

      if (
        !process.env
          .RESEND_API_KEY
      ) {
        throw new Error(
          "RESEND_API_KEY is missing."
        );
      }

      if (
        !process.env
          .CONTACT_EMAIL
      ) {
        throw new Error(
          "CONTACT_EMAIL is missing."
        );
      }

      const {
        fullName,
        email,
        phone,
        subject,
        message,
      } = req.body;

      const resend =
        new Resend(
          process.env
            .RESEND_API_KEY
        );

      const from =
        process.env
          .EMAIL_FROM ||
        "BookMySeat <onboarding@resend.dev>";

      const {
        error,
      } =
        await resend.emails.send({
          from,

          to: [
            process.env
              .CONTACT_EMAIL,
          ],

          replyTo:
            email,

          subject:
            `[BookMySeat] ${subject}`,

          text: `
New BookMySeat contact message

Name: ${fullName}
Email: ${email}
Phone: ${phone || "Not provided"}
Subject: ${subject}

Message:
${message}
          `,

          html: `
            <div
              style="
                font-family:Arial,sans-serif;
                background:#09090b;
                padding:40px 20px;
                color:#fff;
              "
            >
              <div
                style="
                  max-width:600px;
                  margin:auto;
                  background:#18181b;
                  border:1px solid #27272a;
                  border-radius:18px;
                  padding:32px;
                "
              >

                <div
                  style="
                    color:#ef4444;
                    font-size:22px;
                    font-weight:700;
                    margin-bottom:24px;
                  "
                >
                  BookMySeat
                </div>

                <h2>
                  New Contact Message
                </h2>

                <div
                  style="
                    margin-top:24px;
                    line-height:1.8;
                    color:#d4d4d8;
                  "
                >
                  <strong>Name:</strong>
                  ${fullName}
                  <br />

                  <strong>Email:</strong>
                  ${email}
                  <br />

                  <strong>Phone:</strong>
                  ${phone || "Not provided"}
                  <br />

                  <strong>Subject:</strong>
                  ${subject}
                </div>

                <div
                  style="
                    margin-top:24px;
                    padding:20px;
                    background:#09090b;
                    border-radius:12px;
                    color:#e4e4e7;
                    line-height:1.7;
                  "
                >
                  ${message}
                </div>

                <p
                  style="
                    margin-top:24px;
                    color:#71717a;
                    font-size:13px;
                  "
                >
                  Reply directly to this email to respond to ${fullName}.
                </p>

              </div>
            </div>
          `,
        });

      if (error) {
        console.error(
          "Contact email error:",
          error
        );

        return res
          .status(500)
          .json({
            error:
              "Message could not be sent.",
          });
      }

      return res.json({
        success: true,

        message:
          "Message sent successfully.",
      });
    } catch (error) {
      console.error(
        "Contact route error:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Message could not be sent.",
        });
    }
  }
);

module.exports = router;