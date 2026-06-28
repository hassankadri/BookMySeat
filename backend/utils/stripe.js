const Stripe = require('stripe');

const getStripe = () => {
  const apiKey = process.env.STRIPE_API_KEY;
  const proxyUrl = process.env.INTEGRATION_PROXY_URL;
  
  const config = {};
  if (proxyUrl && apiKey === 'sk_test_emergent') {
    config.host = new URL(proxyUrl).hostname;
    config.protocol = 'https';
    config.port = 443;
    config.apiVersion = '2023-10-16';
  }
  
  return new Stripe(apiKey, config);
};

const createCheckoutSession = async ({ bookingId, amount, movieTitle, seats, originUrl }) => {
  try {
    const stripe = getStripe();
    const frontendUrl = originUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${movieTitle} - Movie Tickets`,
              description: `Seats: ${seats}`
            },
            unit_amount: Math.max(Math.round(amount * 100), 50)
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/booking-cancel`,
      metadata: {
        bookingId
      }
    });

    return session;
  } catch (error) {
    console.error('Stripe session creation error:', error);
    throw error;
  }
};

const verifyPayment = async (sessionId) => {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      status: session.payment_status === 'paid' ? 'complete' : 'pending',
      amount: session.amount_total / 100
    };
  } catch (error) {
    console.error('Payment verification error:', error);
    throw error;
  }
};

module.exports = { createCheckoutSession, verifyPayment };