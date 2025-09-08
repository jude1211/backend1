require('dotenv').config();
const emailService = require('../services/emailService');

async function testEmailSetup() {
  console.log('🧪 Testing Email Configuration...\n');
  
  // Check environment variables
  console.log('📋 Configuration Check:');
  console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Not set');
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Not set');
  
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER.includes('your_')) {
    console.log('\n❌ EMAIL_USER not configured properly');
    console.log('Please update EMAIL_USER in .env file with your Gmail address');
    return;
  }
  
  if (!process.env.EMAIL_PASS || process.env.EMAIL_PASS.includes('your_')) {
    console.log('\n❌ EMAIL_PASS not configured properly');
    console.log('Please update EMAIL_PASS in .env file with your Gmail App Password');
    return;
  }
  
  console.log('\n📧 Sending test email...');
  
  try {
    // Test sending to a real email address
    const testEmail = 'judinmathew2002@gmail.com'; // Send to your own email for testing
    console.log(`\n📧 Testing real email sending to: ${testEmail}`);

    // Send a test OTP
    const result = await emailService.sendOTP(
      testEmail, // Send to test email, not the configured Gmail
      '123456',
      'verification'
    );
    
    if (result.success) {
      console.log('✅ Test email sent successfully!');
      console.log('📬 Check your inbox for the test OTP email');
      console.log('🎉 Gmail SMTP is working correctly');
    } else {
      console.log('❌ Test email failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.log('\n🔧 Common issues:');
    console.log('1. Make sure 2-Factor Authentication is enabled on your Google account');
    console.log('2. Use App Password, not your regular Gmail password');
    console.log('3. Check that the App Password is correct (16 characters)');
    console.log('4. Ensure your Gmail address is correct');
  }
}

// Run the test
testEmailSetup();
