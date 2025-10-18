const mongoose = require('mongoose');
const ScreenShow = require('../models/ScreenShow');
const Booking = require('../models/Booking');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booknview', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected for cleanup');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Clean up past show times and related data
const cleanupPastShows = async () => {
  try {
    console.log('Starting cleanup of past show times...');
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    console.log('Today\'s date:', today);
    
    // 1. Find all show records with past dates
    const pastShows = await ScreenShow.find({
      bookingDate: { $lt: today },
      status: 'Active'
    });
    
    console.log(`Found ${pastShows.length} past show records to clean up`);
    
    if (pastShows.length === 0) {
      console.log('No past shows found. Cleanup complete.');
      return;
    }
    
    // 2. Deactivate past shows instead of deleting them (for historical data)
    const updateResult = await ScreenShow.updateMany(
      { bookingDate: { $lt: today }, status: 'Active' },
      { 
        $set: { 
          status: 'Inactive',
          updatedAt: new Date()
        }
      }
    );
    
    console.log(`Deactivated ${updateResult.modifiedCount} past show records`);
    
    // 3. Optional: Clean up old booking records (older than 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oldBookings = await Booking.find({
      'showtime.date': { $lt: thirtyDaysAgo },
      status: 'confirmed'
    });
    
    console.log(`Found ${oldBookings.length} old booking records (older than 30 days)`);
    
    // You can uncomment this to actually delete old bookings
    // const deleteResult = await Booking.deleteMany({
    //   'showtime.date': { $lt: thirtyDaysAgo },
    //   status: 'confirmed'
    // });
    // console.log(`Deleted ${deleteResult.deletedCount} old booking records`);
    
    console.log('Cleanup completed successfully!');
    
  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

// Run cleanup if this script is executed directly
if (require.main === module) {
  connectDB().then(() => {
    cleanupPastShows();
  });
}

module.exports = { cleanupPastShows };

