const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendSuccess, sendError } = require('../utils/helpers');

const getRazorpay = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

// POST /api/payment/create-order
const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body; // amount in rupees

    if (!amount || amount <= 0) {
      return sendError(res, 'Valid amount is required', 400);
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay keys not configured in .env');
      return sendError(res, 'Payment gateway not configured', 500);
    }

    const razorpay = getRazorpay();

    const options = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `order_${Date.now()}`,
    };

    console.log('[Razorpay] Creating order:', { amount: options.amount, currency: options.currency });
    const order = await razorpay.orders.create(options);
    console.log('[Razorpay] Order created:', order.id);

    return sendSuccess(res, {
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
      },
    }, 'Razorpay order created');
  } catch (err) {
    const errorMsg = err?.error?.description || err?.description || err?.message || 'Unknown error';
    console.error('Razorpay create order error:', errorMsg);
    console.error('Razorpay error details:', JSON.stringify(err?.error || err));
    return sendError(res, `Failed to create payment order: ${errorMsg}`, 500);
  }
};

// POST /api/payment/verify
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return sendError(res, 'Missing payment details', 400);
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return sendError(res, 'Payment verification failed — invalid signature', 400);
    }

    return sendSuccess(res, {
      data: {
        verified: true,
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
      },
    }, 'Payment verified successfully');
  } catch (err) {
    console.error('Razorpay verify error:', err.message);
    return sendError(res, 'Payment verification failed', 500);
  }
};

module.exports = { createRazorpayOrder, verifyPayment };
