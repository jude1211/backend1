require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function checkUserAccount() {
  try {
    console.log('🔍 User Account Checker...\n');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/booknview');
    console.log('📊 Connected to MongoDB');

    // Get email from command line argument
    const email = process.argv[2];
    if (!email) {
      console.log('❌ Please provide an email address');
      console.log('Usage: node scripts/checkUserAccount.js <email>');
      console.log('Example: node scripts/checkUserAccount.js user@example.com');
      return;
    }

    console.log(`🔍 Checking account for: ${email}\n`);

    // Search for user (case insensitive)
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('❌ No account found with this email address');
      console.log('\n📧 Suggestions:');
      console.log('1. Check if the email is spelled correctly');
      console.log('2. Try signing up if you don\'t have an account');
      console.log('3. Check if you signed up with Google instead');
      
      // Search for similar emails
      const similarUsers = await User.find({
        email: { $regex: email.split('@')[0], $options: 'i' }
      }, 'email authProvider').limit(5);
      
      if (similarUsers.length > 0) {
        console.log('\n🔍 Similar email addresses found:');
        similarUsers.forEach(u => {
          console.log(`  - ${u.email} (${u.authProvider})`);
        });
      }
    } else {
      console.log('✅ Account found!');
      console.log('\n👤 Account Details:');
      console.log(`📧 Email: ${user.email}`);
      console.log(`👤 Name: ${user.displayName || 'Not set'}`);
      console.log(`🔐 Auth Provider: ${user.authProvider}`);
      console.log(`✅ Email Verified: ${user.isEmailVerified}`);
      console.log(`📅 Created: ${user.createdAt}`);
      console.log(`🕐 Last Login: ${user.lastLoginAt || 'Never'}`);
      console.log(`🔑 Has Password: ${user.password ? 'Yes' : 'No'}`);

      if (user.authProvider === 'google') {
        console.log('\n🔍 Login Instructions:');
        console.log('⚠️  This account uses Google Sign-In');
        console.log('🔐 Please use the "Sign in with Google" button instead of email/password');
        console.log('❌ Email/password login will not work for Google accounts');
      } else if (user.authProvider === 'email') {
        console.log('\n🔍 Login Instructions:');
        console.log('✅ This account uses email/password login');
        console.log('🔐 Use your email and password to sign in');
        if (!user.password) {
          console.log('⚠️  Warning: No password set for this account');
          console.log('🔧 You may need to reset your password');
        }
      }

      if (!user.isEmailVerified) {
        console.log('\n⚠️  Email not verified');
        console.log('📧 You may need to verify your email before logging in');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n📊 Disconnected from MongoDB');
  }
}

checkUserAccount();
