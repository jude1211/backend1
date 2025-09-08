require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function testLoginWithCorrectPassword() {
  try {
    console.log('🧪 Testing Login with Correct Password...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booknview');
    console.log('📊 Connected to MongoDB');

    // Create a test user with known password
    const testEmail = 'logintest@example.com';
    const testPassword = 'TestPassword123!';
    
    console.log(`👤 Creating test user: ${testEmail}`);
    
    // Remove existing test user if exists
    await User.deleteOne({ email: testEmail });
    
    // Create new test user
    const testUser = new User({
      email: testEmail,
      displayName: 'Login Test User',
      firstName: 'Login',
      lastName: 'Test',
      password: testPassword, // This will be hashed by pre-save middleware
      authProvider: 'email',
      isEmailVerified: true
    });
    
    await testUser.save();
    console.log('✅ Test user created successfully');

    // Test login with correct password
    console.log(`\n🔐 Testing login with correct password...`);
    const loginResponse = await fetch('http://localhost:5002/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });

    const loginResult = await loginResponse.json();
    console.log('🔐 Login Response Status:', loginResponse.status);
    console.log('🔐 Login Response:', loginResult);

    if (loginResult.success) {
      console.log('✅ Login successful!');
      console.log('👤 User ID:', loginResult.data.user.id);
      console.log('📧 Email:', loginResult.data.user.email);
      console.log('👤 Display Name:', loginResult.data.user.displayName);
      console.log('🔑 Token received:', loginResult.data.token ? 'Yes' : 'No');
      console.log('🔐 Auth Method:', loginResult.data.authMethod);
    } else {
      console.log('❌ Login failed:', loginResult.message);
      console.log('❌ Error:', loginResult.error);
    }

    // Test with wrong password
    console.log(`\n🔐 Testing with wrong password...`);
    const wrongResponse = await fetch('http://localhost:5002/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword123!'
      })
    });

    const wrongResult = await wrongResponse.json();
    console.log('🔐 Wrong password response:', wrongResult);

    // Test with Google account (should fail)
    console.log(`\n🔐 Testing with Google account...`);
    const googleResponse = await fetch('http://localhost:5002/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'judinmathew2002@gmail.com', // This is a Google account
        password: 'anypassword'
      })
    });

    const googleResult = await googleResponse.json();
    console.log('🔐 Google account response:', googleResult);

    // Clean up test user
    await User.deleteOne({ email: testEmail });
    console.log('🧹 Test user cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('❌ Full error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📊 Disconnected from MongoDB');
  }
}

testLoginWithCorrectPassword();
