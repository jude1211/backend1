const Razorpay = require('razorpay');
const crypto = require('crypto');

/**
 * Simple wrapper around Razorpay SDK for order creation and signature verification.
 */
class PaymentService {
  /**
   * @param {{ keyId: string; keySecret: string }} config
   */
  constructor(config) {
    if (!config?.keyId || !config?.keySecret) {
      throw new Error('Razorpay credentials are required');
    }
    this.instance = new Razorpay({ key_id: config.keyId, key_secret: config.keySecret });
  }

  /**
   * Create a Razorpay order
   * @param {{ amountInPaise: number; currency?: string; receipt?: string; notes?: any }} params
   */
  async createOrder(params) {
    const { amountInPaise, currency = 'INR', receipt, notes } = params;
    if (!amountInPaise || amountInPaise <= 0) {
      throw new Error('amountInPaise must be > 0');
    }
    return await this.instance.orders.create({ amount: amountInPaise, currency, receipt, notes });
  }

  /**
   * Verify Razorpay signature after payment
   * @param {{ orderId: string; paymentId: string; signature: string }} payload
   */
  verifySignature(payload) {
    const { orderId, paymentId, signature } = payload;
    const generated = crypto
      .createHmac('sha256', this.instance.key_secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return generated === signature;
  }
}

module.exports = PaymentService;


