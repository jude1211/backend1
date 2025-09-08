const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

// Import the theatre routes
const theatreRoutes = require('./routes/theatres');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/v1/theatres', theatreRoutes);

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Test server is running!' });
});

async function startTestServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const PORT = 3001;
    app.listen(PORT, () => {
      console.log(`🚀 Test server running on http://localhost:${PORT}`);
      console.log(`📋 Test the API endpoint:`);
      console.log(`   POST http://localhost:${PORT}/api/v1/theatres/owner-applications`);
      console.log(`\n📝 Sample payload:`);
      console.log(JSON.stringify({
        name: "Jane Smith",
        email: "jane.smith@example.com",
        phone: "+1987654321",
        theatreName: "Star Cinema",
        theatreType: "Single Screen",
        location: "456 Oak Avenue, Uptown",
        description: "A cozy single-screen cinema with vintage charm",
        screenCount: "1",
        seatingCapacity: "200",
        internetConnectivity: "Standard WiFi",
        termsAccepted: true
      }, null, 2));
    });
    
  } catch (error) {
    console.error('❌ Error starting test server:', error);
  }
}

startTestServer();
