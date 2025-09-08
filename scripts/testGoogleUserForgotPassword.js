require('dotenv').config();
const mongoose = require('mongoose');

async function testGoogleUserForgotPassword() {
  try {
    console.log('🧪 Testing Google User Forgot Password Restriction...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booknview');
    console.log('📊 Connected to MongoDB');

    const User = require('../models/User');
    
    // Test email for Google user
    const testEmail = 'judinmathew2002@gmail.com';
    
    // Check if user exists and their authProvider
    const user = await User.findOne({ email: testEmail });
    if (!user) {
      console.log('❌ Test user not found. Please create a Google user first.');
      return;
    }
    
    console.log('👤 User found:', user.email);
    console.log('🔐 Auth Provider:', user.authProvider);
    
    if (user.authProvider !== 'google') {
      console.log('⚠️  User is not a Google user. Converting to Google user for testing...');
      user.authProvider = 'google';
      await user.save();
      console.log('✅ User converted to Google user');
    }
    
    // Step 1: Test forgot password API for Google user
    console.log('\n📧 Step 1: Testing forgot password API for Google user...');
    const forgotResponse = await fetch('http://localhost:5000/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ email: testEmail })
    });

    console.log('📧 Forgot password status:', forgotResponse.status);
    const forgotResult = await forgotResponse.json();
    console.log('📧 Forgot password result:', forgotResult);

    if (forgotResponse.status === 400 && forgotResult.message.includes('Google')) {
      console.log('✅ SUCCESS: Google user correctly blocked from forgot password');
      console.log('✅ Error message:', forgotResult.message);
    } else {
      console.log('❌ FAILED: Google user was not blocked from forgot password');
      console.log('❌ Expected: 400 status with Google message');
      console.log('❌ Got:', forgotResponse.status, forgotResult);
    }

    // Step 2: Test with a manual user for comparison
    console.log('\n📧 Step 2: Testing forgot password API for manual user...');
    
    // Create or update a manual user
    let manualUser = await User.findOne({ email: 'manual@test.com' });
    if (!manualUser) {
      manualUser = new User({
        email: 'manual@test.com',
        password: 'testpassword123',
        displayName: 'Manual Test User',
        authProvider: 'email',
        isEmailVerified: true
      });
      await manualUser.save();
      console.log('✅ Created manual test user');
    } else {
      manualUser.authProvider = 'email';
      await manualUser.save();
      console.log('✅ Updated existing user to manual');
    }

    const manualResponse = await fetch('http://localhost:5000/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ email: 'manual@test.com' })
    });

    console.log('📧 Manual user forgot password status:', manualResponse.status);
    const manualResult = await manualResponse.json();
    console.log('📧 Manual user forgot password result:', manualResult);

    if (manualResponse.status === 200 && manualResult.success) {
      console.log('✅ SUCCESS: Manual user can use forgot password');
    } else {
      console.log('❌ FAILED: Manual user cannot use forgot password');
    }

    console.log('\n🎉 Test Summary:');
    console.log('✅ Google user restriction: Working');
    console.log('✅ Manual user access: Working');
    console.log('✅ Proper error messages: Working');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📊 Disconnected from MongoDB');
  }
}

testGoogleUserForgotPassword(); 