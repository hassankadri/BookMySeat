import React, {
  useState,
} from "react";

import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import toast from "react-hot-toast";

const StripePaymentForm = ({
  amount,
  onPaymentSucceeded,
}) => {
  const stripe =
    useStripe();

  const elements =
    useElements();

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      if (
        !stripe ||
        !elements
      ) {
        return;
      }

      setSubmitting(true);

      try {
        const {
          error,
          paymentIntent,
        } =
          await stripe.confirmPayment(
            {
              elements,

              confirmParams: {
                return_url:
                  `${window.location.origin}/my-bookings`,
              },

              /**
               * Normal cards stay on this page.
               *
               * Stripe only redirects when the payment
               * method actually requires it, such as 3DS.
               */
              redirect:
                "if_required",
            }
          );

        if (error) {
          toast.error(
            error.message ||
              "Payment failed."
          );

          return;
        }

        if (
          paymentIntent
            ?.status ===
          "succeeded"
        ) {
          onPaymentSucceeded(
            paymentIntent
          );

          return;
        }

        if (
          paymentIntent
            ?.status ===
          "processing"
        ) {
          toast(
            "Payment is processing."
          );

          return;
        }

        toast(
          "Payment requires additional confirmation."
        );
      } catch (error) {
        console.error(
          "Stripe payment error:",
          error
        );

        toast.error(
          "Unable to complete payment."
        );
      } finally {
        setSubmitting(false);
      }
    };

  return (
    <form
      onSubmit={
        handleSubmit
      }
      className="space-y-5"
    >
      <PaymentElement />

      <button
        type="submit"
        disabled={
          !stripe ||
          submitting
        }
        className="w-full rounded-full bg-red-600 px-8 py-4 font-semibold text-white transition-all hover:bg-red-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Processing payment..."
          : `Pay ₹${amount}`}
      </button>
    </form>
  );
};

export default StripePaymentForm;