const Stripe = require("stripe");

let stripeClient = null;

// =====================================================
// STRIPE CLIENT
// =====================================================

const getStripe = () => {
  const apiKey =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Stripe secret key is missing."
    );
  }

  const proxyUrl =
    process.env.INTEGRATION_PROXY_URL;

  const config = {};

  /**
   * Keep old Emergent proxy support temporarily
   * while we migrate the existing project.
   */
  if (
    proxyUrl &&
    apiKey === "sk_test_emergent"
  ) {
    config.host =
      new URL(proxyUrl).hostname;

    config.protocol = "https";
    config.port = 443;
    config.apiVersion =
      "2023-10-16";
  }

  if (!stripeClient) {
    stripeClient =
      new Stripe(
        apiKey,
        config
      );
  }

  return stripeClient;
};

// =====================================================
// LEGACY CHECKOUT
// =====================================================

const createCheckoutSession =
  async ({
    bookingId,
    amount,
    movieTitle,
    seats,
    originUrl,
  }) => {
    try {
      const stripe =
        getStripe();

      const frontendUrl =
        originUrl ||
        process.env.FRONTEND_URL ||
        "http://localhost:3000";

      const currency = (
        process.env.STRIPE_CURRENCY ||
        "inr"
      ).toLowerCase();

      const unitAmount =
        Math.round(
          Number(amount) * 100
        );

      if (
        !Number.isInteger(
          unitAmount
        ) ||
        unitAmount <= 0
      ) {
        throw new Error(
          "Checkout amount must be greater than zero."
        );
      }

      return await stripe
        .checkout
        .sessions
        .create({
          payment_method_types: [
            "card",
          ],

          line_items: [
            {
              price_data: {
                currency,

                product_data: {
                  name:
                    `${movieTitle} - Movie Tickets`,

                  description:
                    `Seats: ${seats}`,
                },

                unit_amount:
                  unitAmount,
              },

              quantity: 1,
            },
          ],

          mode: "payment",

          success_url:
            `${frontendUrl}/booking-success` +
            "?session_id={CHECKOUT_SESSION_ID}",

          cancel_url:
            `${frontendUrl}/booking-cancel`,

          metadata: {
            bookingId:
              String(
                bookingId
              ),
          },
        });
    } catch (error) {
      console.error(
        "Stripe Checkout error:",
        error
      );

      throw error;
    }
  };

// =====================================================
// LEGACY PAYMENT VERIFICATION
// =====================================================

const verifyPayment =
  async (sessionId) => {
    try {
      const stripe =
        getStripe();

      const session =
        await stripe
          .checkout
          .sessions
          .retrieve(
            sessionId
          );

      return {
        status:
          session.payment_status ===
          "paid"
            ? "complete"
            : "pending",

        amount:
          session.amount_total !==
          null
            ? session.amount_total /
              100
            : 0,

        currency:
          session.currency
            ?.toUpperCase() ||
          null,

        paymentIntentId:
          session.payment_intent ||
          null,
      };
    } catch (error) {
      console.error(
        "Stripe payment verification error:",
        error
      );

      throw error;
    }
  };

// =====================================================
// V2 PAYMENT INTENT
// =====================================================

const createPaymentIntent =
  async ({
    bookingId,
    bookingCode,
    userId,
    showId,
    lockId,
    seatIds,
    amount,
  }) => {
    try {
      const stripe =
        getStripe();

      const amountInPaise =
        Math.round(
          Number(amount) * 100
        );

      if (
        !Number.isInteger(
          amountInPaise
        ) ||
        amountInPaise <= 0
      ) {
        throw new Error(
          "Payment amount must be greater than zero."
        );
      }

      return await stripe
        .paymentIntents
        .create(
          {
            amount:
              amountInPaise,

            currency: "inr",

            automatic_payment_methods:
              {
                enabled: true,
              },

            /**
             * Stripe returns metadata to us in the webhook.
             *
             * This connects the payment to our MongoDB booking.
             */
            metadata: {
              bookingId:
                String(
                  bookingId
                ),

              bookingCode:
                String(
                  bookingCode
                ),

              userId:
                String(userId),

              showId:
                String(showId),

              lockId:
                String(lockId),

              seatIds:
                seatIds.join(","),
            },

            description:
              `BookMySeat ${bookingCode}`,
          },

          {
            /**
             * Retry-safe payment creation.
             */
            idempotencyKey:
              `bookmyseat-${bookingId}`,
          }
        );
    } catch (error) {
      console.error(
        "Stripe PaymentIntent error:",
        error
      );

      throw error;
    }
  };

// =====================================================
// RETRIEVE PAYMENT INTENT
// =====================================================

const retrievePaymentIntent =
  async (
    paymentIntentId
  ) => {
    const stripe =
      getStripe();

    return stripe
      .paymentIntents
      .retrieve(
        paymentIntentId
      );
  };

// =====================================================
// WEBHOOK SIGNATURE VERIFICATION
// =====================================================

/**
 * Stripe signs every webhook request.
 *
 * Without verifying this signature, anybody could send:
 *
 * POST /api/webhooks/stripe
 *
 * and pretend that they paid.
 *
 * constructEvent() proves that the request genuinely came
 * from Stripe.
 */
const constructWebhookEvent =
  ({
    rawBody,
    signature,
  }) => {
    const webhookSecret =
      process.env
        .STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error(
        "STRIPE_WEBHOOK_SECRET is missing."
      );
    }

    const stripe =
      getStripe();

    return stripe
      .webhooks
      .constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
  };

// =====================================================
// REFUND
// =====================================================

/**
 * Automatic safety refund.
 *
 * Example rare situation:
 *
 * User pays
 *      ↓
 * seat lock already expired
 *      ↓
 * seat cannot safely be confirmed
 *      ↓
 * refund payment automatically
 *
 * Idempotency prevents duplicate refunds if Stripe retries
 * the same webhook.
 */
const refundPaymentIntent =
  async ({
    paymentIntentId,
    bookingId,
  }) => {
    const stripe =
      getStripe();

    return stripe.refunds.create(
      {
        payment_intent:
          paymentIntentId,

        reason:
          "requested_by_customer",
      },

      {
        idempotencyKey:
          `bookmyseat-refund-${bookingId}`,
      }
    );
  };

module.exports = {
  getStripe,

  // V2
  createPaymentIntent,
  retrievePaymentIntent,
  constructWebhookEvent,
  refundPaymentIntent,

  // Legacy
  createCheckoutSession,
  verifyPayment,
};