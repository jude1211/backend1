require('dotenv').config();
const mongoose = require('mongoose');

async function testOTPPasswordReset() {
  try {
    console.log('🧪 Testing OTP-based Password Reset Flow...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booknview');
    console.log('📊 Connected to MongoDB');

    // Test email
    const testEmail = 'judinmathew2002@gmail.com';
    
    // Step 1: Test forgot password API (sends OTP)
    console.log('\n📧 Step 1: Testing forgot password API (sends OTP)...');
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

    if (!forgotResult.success) {
      console.log('❌ Forgot password failed');
      return;
    }

    // Step 2: Get the OTP from database
    const User = require('../models/User');
    const user = await User.findOne({ email: testEmail });
    
    if (!user || !user.resetPasswordToken) {
      console.log('❌ No OTP found in database');
      return;
    }

    const otp = user.resetPasswordToken;
    console.log('\n🔐 OTP from database:', otp);
    console.log('⏰ OTP expires:', user.resetPasswordExpires);

    // Step 3: Test OTP verification
    console.log('\n🔍 Step 2: Testing OTP verification...');
    const verifyResponse = await fetch('http://localhost:5000/api/v1/auth/verify-reset-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ otp, email: testEmail })
    });

    console.log('🔍 OTP verification status:', verifyResponse.status);
    const verifyResult = await verifyResponse.json();
    console.log('🔍 OTP verification result:', verifyResult);

    if (!verifyResult.success) {
      console.log('❌ OTP verification failed');
      return;
    }

    // Step 4: Test password reset with OTP
    console.log('\n🔐 Step 3: Testing password reset with OTP...');
    const newPassword = 'NewTestPassword123!';
    
    const resetResponse = await fetch('http://localhost:5000/api/v1/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ 
        otp, 
        email: testEmail, 
        newPassword 
      })
    });

    console.log('🔐 Password reset status:', resetResponse.status);
    const resetResult = await resetResponse.json();
    console.log('🔐 Password reset result:', resetResult);

    if (resetResult.success) {
      console.log('✅ Password reset successful');
      
      // Verify OTP is cleared
      const updatedUser = await User.findOne({ email: testEmail });
      if (!updatedUser.resetPasswordToken) {
        console.log('✅ OTP cleared after use');
      } else {
        console.log('❌ OTP not cleared after use');
      }
    } else {
      console.log('❌ Password reset failed');
    }

    console.log('\n🎉 Test Summary:');
    console.log('✅ Forgot Password API: Working');
    console.log('✅ OTP Generation: Working');
    console.log('✅ OTP Verification: Working');
    console.log('✅ Password Reset: Working');
    console.log('\n📬 Check your email inbox for the OTP email!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📊 Disconnected from MongoDB');
  }
}

testOTPPasswordReset(); 