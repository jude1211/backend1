const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const PaymentService = require('../services/paymentService');
const Booking = require('../models/Booking');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Initialize PaymentService with env or provided test credentials (fallback)
const keyId = process.env.RAZORPAY_KEY_ID || process.env.RZP_KEY_ID || process.env.RAZORPAY_ID || 'rzp_test_RL5vMta3bKvRd4';
const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RZP_KEY_SECRET || process.env.RAZORPAY_SECRET || '9qxxugjEleGtcqcOjWFmCB2n';
const paymentService = new PaymentService({ keyId, keySecret });

// POST /api/v1/payments/order
// Create a Razorpay order for a booking
router.post(
  '/order',
  authenticateUser,
  [
    body('bookingId').notEmpty().withMessage('bookingId is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      }

      const { bookingId } = req.body;
      const booking = await Booking.findOne({
        $or: [
          { bookingId },
          ...(mongoose.Types.ObjectId.isValid(bookingId) ? [{ _id: bookingId }] : [])
        ],
        firebaseUid: req.user.firebaseUid
      });

      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }

      const amountInPaise = Math.round(Number(booking.pricing.totalAmount) * 100);
      const order = await paymentService.createOrder({
        amountInPaise,
        currency: 'INR',
        receipt: booking.bookingId,
        notes: { bookingId: booking.bookingId, user: req.user.firebaseUid }
      });

      // Mark booking payment as pending with provider reference
      booking.payment = booking.payment || {};
      booking.payment.method = 'upi';
      booking.payment.provider = 'Razorpay';
      booking.payment.status = 'pending';
      booking.payment.transactionId = order.id; // store order id as transaction reference
      await booking.save();

      return res.json({ success: true, data: { order, keyId } });
    } catch (error) {
      console.error('Create order error:', error);
      res.status(500).json({ success: false, error: 'Failed to create payment order' });
    }
  }
);

// POST /api/v1/payments/verify
// Verify Razorpay signature and mark booking as paid
router.post(
  '/verify',
  authenticateUser,
  [
    body('razorpay_order_id').notEmpty(),
    body('razorpay_payment_id').notEmpty(),
    body('razorpay_signature').notEmpty(),
    body('bookingId').notEmpty()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
      }

      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

      const isValid = paymentService.verifySignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature
      });

      if (!isValid) {
        return res.status(400).json({ success: false, error: 'Payment signature verification failed' });
      }

      const booking = await Booking.findOne({
        $or: [
          { bookingId },
          ...(mongoose.Types.ObjectId.isValid(bookingId) ? [{ _id: bookingId }] : [])
        ],
        firebaseUid: req.user.firebaseUid
      });

      if (!booking) {
        return res.status(404).json({ success: false, error: 'Booking not found' });
      }

      booking.payment = booking.payment || {};
      booking.payment.status = 'completed';
      booking.payment.provider = 'Razorpay';
      booking.payment.paymentId = razorpay_payment_id;
      booking.payment.transactionId = razorpay_order_id;
      booking.payment.paidAt = new Date();

      // Ensure booking status remains confirmed and QR/tickets available
      if (!booking.tickets || booking.tickets.length === 0) {
        booking.tickets = (booking.seats || []).map((seat, index) => ({
          ticketNumber: `${booking.bookingId}-${index + 1}`,
          qrCode: `${booking.bookingId}-${seat.seatNumber}`,
          downloadUrl: null,
          isUsed: false
        }));
      }

      await booking.save();
      return res.json({ success: true, data: { bookingId: booking.bookingId } });
    } catch (error) {
      console.error('Verify payment error:', error);
      res.status(500).json({ success: false, error: 'Failed to verify payment' });
    }
  }
);

module.exports = router;


