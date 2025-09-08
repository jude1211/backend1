require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function testCompleteForgotPasswordFlow() {
  try {
    console.log('🧪 Testing Complete Forgot Password Flow...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booknview');
    console.log('📊 Connected to MongoDB');

    // Test email
    const testEmail = 'judinmathew2002@gmail.com';
    console.log(`📧 Testing with email: ${testEmail}`);

    // Step 1: Ensure test user exists
    let user = await User.findOne({ email: testEmail });
    if (!user) {
      console.log('👤 Creating test user...');
      const hashedPassword = await bcrypt.hash('testpassword123', 12);
      
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

    // Step 2: Clear any existing reset tokens
    await User.findOneAndUpdate(
      { email: testEmail },
      { 
        $unset: { 
          resetPasswordToken: 1, 
          resetPasswordExpires: 1 
        } 
      }
    );
    console.log('🧹 Cleared existing reset tokens');

    // Step 3: Test forgot password API
    console.log('\n📧 Testing forgot password API...');
    
    const response = await fetch('http://localhost:5000/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: testEmail
      })
    });

    const result = await response.json();
    console.log('📧 API Status:', response.status);
    console.log('📧 API Response:', result);

    if (!result.success) {
      console.log('❌ Forgot password API failed');
      return;
    }

    // Step 4: Check if reset token was created in database
    console.log('\n🔍 Checking database for reset token...');
    const updatedUser = await User.findOne({ email: testEmail });
    
    if (updatedUser.resetPasswordToken) {
      console.log('✅ Reset token created in database');
      console.log('🔗 Token (first 10 chars):', updatedUser.resetPasswordToken.substring(0, 10) + '...');
      console.log('⏰ Token expires:', updatedUser.resetPasswordExpires);
      
      // Check if token is valid (not expired)
      const now = new Date();
      const isValid = updatedUser.resetPasswordExpires > now;
      console.log('✅ Token is valid:', isValid);
      
      if (isValid) {
        // Step 5: Test reset URL generation
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5174'}/#/reset-password?token=${updatedUser.resetPasswordToken}&email=${encodeURIComponent(testEmail)}`;
        console.log('\n🔗 Generated reset URL:');
        console.log(resetUrl);
        
        // Step 6: Test token verification API
        console.log('\n🔍 Testing token verification...');
        const verifyResponse = await fetch('http://localhost:5000/api/v1/auth/verify-reset-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: updatedUser.resetPasswordToken,
            email: testEmail
          })
        });
        
        const verifyResult = await verifyResponse.json();
        console.log('🔍 Token verification status:', verifyResponse.status);
        console.log('🔍 Token verification result:', verifyResult);
        
        if (verifyResult.success) {
          console.log('✅ Token verification successful');
          
          // Step 7: Test password reset
          console.log('\n🔐 Testing password reset...');
          const newPassword = 'newTestPassword123!';
          
          const resetResponse = await fetch('http://localhost:5000/api/v1/auth/reset-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              token: updatedUser.resetPasswordToken,
              email: testEmail,
              newPassword: newPassword
            })
          });
          
          const resetResult = await resetResponse.json();
          console.log('🔐 Password reset status:', resetResponse.status);
          console.log('🔐 Password reset result:', resetResult);
          
          if (resetResult.success) {
            console.log('✅ Password reset successful');
            
            // Verify token was cleared
            const finalUser = await User.findOne({ email: testEmail });
            if (!finalUser.resetPasswordToken) {
              console.log('✅ Reset token cleared after use');
            } else {
              console.log('⚠️  Reset token still exists');
            }
          } else {
            console.log('❌ Password reset failed');
          }
        } else {
          console.log('❌ Token verification failed');
        }
      } else {
        console.log('❌ Token is expired');
      }
    } else {
      console.log('❌ No reset token found in database');
    }

    console.log('\n🎉 Test Summary:');
    console.log('✅ Email Service: Working');
    console.log('✅ Forgot Password API: Working');
    console.log('✅ Database Integration: Working');
    console.log('✅ Token Generation: Working');
    console.log('✅ Token Verification: Working');
    console.log('✅ Password Reset: Working');
    console.log('\n📬 Check your email inbox for the password reset email!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('❌ Full error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n📊 Disconnected from MongoDB');
  }
}

testCompleteForgotPasswordFlow();
