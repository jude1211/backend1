const fs = require('fs');
const path = require('path');

console.log('🔧 BookNView Email Setup Helper');
console.log('='.repeat(50));

console.log('\n📋 Current Email Configuration:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Not set');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set' : '❌ Not set');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.log('\n❌ Email configuration is incomplete!');
  console.log('\n🔧 To fix this:');
  console.log('1. Enable 2-Factor Authentication on your Google account');
  console.log('2. Generate an App Password:');
  console.log('   - Go to https://myaccount.google.com/');
  console.log('   - Security → 2-Step Verification → App passwords');
  console.log('   - Select "Mail" and generate a 16-character password');
  console.log('3. Create a .env file in the backend directory with:');
  console.log('\n   EMAIL_USER=your.email@gmail.com');
  console.log('   EMAIL_PASS=your_16_character_app_password');
  console.log('\n📖 See email-setup-guide.md for detailed instructions');
} else {
  console.log('\n✅ Email configuration looks good!');
  console.log('🧪 Run "node scripts/testEmail.js" to test email sending');
}

console.log('\n📧 Current Status:');
console.log('- Password reset emails: ' + (process.env.EMAIL_USER && process.env.EMAIL_PASS ? '✅ Will send real emails' : '❌ Development mode (console only)'));
console.log('- Email verification: ' + (process.env.EMAIL_USER && process.env.EMAIL_PASS ? '✅ Will send real emails' : '❌ Development mode (console only)'));

console.log('\n💡 Tip: Even in development mode, the forgot password functionality works!');
console.log('   Emails are logged to the console for testing purposes.'); 