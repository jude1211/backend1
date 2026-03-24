const Booking = require('../models/Booking');
const Snack = require('../models/Snack');

const releaseExpiredReservations = async () => {
  try {
    const expired = await Booking.find({
      status: 'pending',
      reservationExpiresAt: { $lt: new Date() }
    });

    if (expired.length > 0) {
      console.log(`[Job] Found ${expired.length} expired reservations. Releasing...`);
    }

    for (const booking of expired) {
      if (booking.snackOrder && booking.snackOrder.length > 0) {
        for (const item of booking.snackOrder) {
          if (item.snackId) {
            await Snack.findByIdAndUpdate(item.snackId, {
              $inc: { reservedStock: -item.quantity }
            });
          }
        }
      }
      
      // Since unconfirmed reservations also lock seats up via socket without db confirmation sometimes,
      // destroying the pending booking cleanly restores inventory.
      await Booking.deleteOne({ _id: booking._id });
    }
  } catch (err) {
    console.error('[Job Error] releaseExpiredReservations failed:', err);
  }
};

module.exports = releaseExpiredReservations;
