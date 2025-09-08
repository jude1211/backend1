require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function testLogin() {
  try {
    console.log('🧪 Testing Login Functionality...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booknview');
    console.log('📊 Connected to MongoDB');

    // List all users in database
    console.log('\n👥 Users in database:');
    const users = await User.find({}, 'email authProvider isEmailVerified').limit(10);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.authProvider}) - Verified: ${user.isEmailVerified}`);
    });

    if (users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }

    // Test login with the first email user
    const emailUser = users.find(u => u.authProvider === 'email');
    if (!emailUser) {
      console.log('❌ No email users found for testing');
      return;
    }

    console.log(`\n🔐 Testing login with: ${emailUser.email}`);

    // Test login API
    const loginResponse = await fetch('http://localhost:5002/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailUser.email,
        password: 'NewPassword123!' // Using the password we set in password reset test
      })
    });

    const loginResult = await loginResponse.json();
    console.log('🔐 Login API Response Status:', loginResponse.status);
    console.log('🔐 Login API Response:', loginResult);

    if (loginResult.success) {
      console.log('✅ Login successful!');
      console.log('👤 User data:', loginResult.data.user);
      console.log('🔑 Token received:', loginResult.data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ Login failed:', loginResult.message);
    }

    // Test with wrong password
    console.log('\n🔐 Testing with wrong password...');
    const wrongPasswordResponse = await fetch('http://localhost:5002/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailUser.email,
        password: 'wrongpassword'
      })
    });

    const wrongPasswordResult = await wrongPasswordResponse.json();
    console.log('🔐 Wrong password response:', wrongPasswordResult);

    // Test with non-existent email
    console.log('\n🔐 Testing with non-existent email...');
    const nonExistentResponse = await fetch('http://localhost:5002/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        password: 'anypassword'
      })
    });

    const nonExistentResult = await nonExistentResponse.json();
    console.log('🔐 Non-existent email response:', nonExistentResult);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('❌ Full error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📊 Disconnected from MongoDB');
  }
}

testLogin();
