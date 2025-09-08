const mongoose = require('mongoose');
const TheatreOwnerApplication = require('./models/TheatreOwnerApplication');
require('dotenv').config();

async function testTheatreOwnerApplication() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('📍 Database:', mongoose.connection.name);
    console.log('🏠 Host:', mongoose.connection.host);
    
    // Test data for theatre owner application
    const testApplication = {
      ownerName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      theatreName: 'Grand Cinema',
      theatreType: 'Multiplex',
      locationText: '123 Main Street, Downtown',
      description: 'A modern multiplex cinema with state-of-the-art facilities',
      screenCount: '5',
      seatingCapacity: '1200',
      internetConnectivity: 'High Speed WiFi',
      termsAccepted: true,
      documents: {
        businessLicense: [],
        nocPermission: [],
        seatingLayout: [],
        ticketPricing: []
      }
    };

    // Create new application
    const application = new TheatreOwnerApplication(testApplication);
    const savedApplication = await application.save();
    
    console.log('✅ Theatre owner application created successfully!');
    console.log('📄 Application ID:', savedApplication._id);
    console.log('🎭 Theatre Name:', savedApplication.theatreName);
    console.log('👤 Owner Name:', savedApplication.ownerName);
    console.log('📧 Email:', savedApplication.email);
    console.log('📅 Created At:', savedApplication.createdAt);
    console.log('📊 Status:', savedApplication.status);
    
    // Verify the application was saved to the correct collection
    const count = await TheatreOwnerApplication.countDocuments();
    console.log('📊 Total applications in collection:', count);
    
    // List all applications
    const applications = await TheatreOwnerApplication.find({}, 'ownerName theatreName email status createdAt').limit(5);
    console.log('\n📋 Recent applications:');
    applications.forEach((app, index) => {
      console.log(`${index + 1}. ${app.ownerName} - ${app.theatreName} (${app.status}) - ${app.createdAt.toLocaleDateString()}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure MongoDB is running on localhost:27017');
    }
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the test
testTheatreOwnerApplication();
