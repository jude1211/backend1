require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');

async function testPasswordResetFlow() {
  try {
    console.log('🧪 Testing Complete Password Reset Flow...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booknview');
    console.log('📊 Connected to MongoDB');

    // Test email
    const testEmail = 'testuser@example.com';
    console.log(`📧 Testing with email: ${testEmail}`);

    // Step 1: Create test user if doesn't exist
    let user = await User.findOne({ email: testEmail });
    if (!user) {
      console.log('👤 Creating test user...');
      const hashedPassword = await bcrypt.hash('oldpassword123', 12);
      
      user = new User({
        email: testEmail,
        displayName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        password: hashedPassword,
        authProvider: 'email',
        isEmailVerified: true
      });
      
      await user.save();
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user exists');
    }

    // Step 2: Request password reset
    console.log('\n📧 Step 1: Requesting password reset...');
    const forgotResponse = await fetch('http://localhost:5002/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });

    const forgotResult = await forgotResponse.json();
    console.log('📧 Forgot password response:', forgotResult);

    if (!forgotResult.success) {
      console.log('❌ Failed to request password reset');
      return;
    }

    // Step 3: Get the OTP from database (simulating email)
    console.log('\n🔍 Step 2: Getting OTP from database...');
    const otpRecord = await OTP.findOne({ 
      email: testEmail, 
      type: 'password_reset',
      isUsed: false 
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      console.log('❌ No OTP found in database');
      return;
    }

    console.log('✅ OTP found:', otpRecord.otp);
    console.log('⏰ Expires at:', otpRecord.expiresAt);

    // Step 4: Verify the OTP
    console.log('\n🔐 Step 3: Verifying OTP...');
    const verifyResponse = await fetch('http://localhost:5002/api/v1/auth/verify-reset-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: testEmail,
        otp: otpRecord.otp
      })
    });

    const verifyResult = await verifyResponse.json();
    console.log('🔐 Verify OTP response:', verifyResult);

    if (!verifyResult.success) {
      console.log('❌ OTP verification failed');
      return;
    }

    // Step 5: Reset password
    console.log('\n🔑 Step 4: Resetting password...');
    const resetResponse = await fetch('http://localhost:5002/api/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: testEmail,
        otp: otpRecord.otp,
        newPassword: 'NewPassword123!'
      })
    });

    const resetResult = await resetResponse.json();
    console.log('🔑 Reset password response:', resetResult);

    if (resetResult.success) {
      console.log('✅ Password reset successful!');
      
      // Verify the password was actually changed
      const updatedUser = await User.findOne({ email: testEmail });
      const newPasswordMatch = await bcrypt.compare('NewPassword123!', updatedUser.password);
      const oldPasswordMatch = await bcrypt.compare('oldpassword123', updatedUser.password);

      console.log('✅ Password verification:');
      console.log('  - New password works:', newPasswordMatch);
      console.log('  - Old password blocked:', !oldPasswordMatch);
      console.log('  - Password hash changed:', updatedUser.password !== user.password);
      
      // Check if OTP was marked as used
      const usedOtp = await OTP.findById(otpRecord._id);
      console.log('✅ OTP status:', usedOtp.isUsed ? 'Marked as used' : 'Still active');
      
    } else {
      console.log('❌ Password reset failed');
    }

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('❌ Full error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📊 Disconnected from MongoDB');
  }
}

testPasswordResetFlow();
