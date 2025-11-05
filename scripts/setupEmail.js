const fs = require('fs');
const path = require('path');

console.log('🔧 BookNView Email Setup Helper');
console.log('='.repeat(50));

console.log('\n📋 Current Email Configuration:');
console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '✅ Set' : '❌ Not set');
console.log('SENDGRID_FROM_EMAIL:', process.env.SENDGRID_FROM_EMAIL ? `✅ Set (${process.env.SENDGRID_FROM_EMAIL})` : '⚠️  Not set (will use default: noreply@booknview.com)');

if (!process.env.SENDGRID_API_KEY) {
  console.log('\n❌ Email configuration is incomplete!');
  console.log('\n🔧 To fix this:');
  console.log('1. Sign up for a free SendGrid account at https://sendgrid.com');
  console.log('2. Verify your email address');
  console.log('3. Create an API Key:');
  console.log('   - Go to Settings → API Keys in SendGrid dashboard');
  console.log('   - Click "Create API Key"');
  console.log('   - Give it a name and select "Full Access" or "Mail Send" permissions');
  console.log('   - Copy the API key (starts with SG.)');
  console.log('4. (Optional) Verify a sender email:');
  console.log('   - Go to Settings → Sender Authentication');
  console.log('   - Verify a Single Sender or use Domain Authentication');
  console.log('5. Create a .env file in the backend directory with:');
  console.log('\n   SENDGRID_API_KEY=SG.your_api_key_here');
  console.log('   SENDGRID_FROM_EMAIL=your-verified-email@yourdomain.com');
  console.log('\n📖 See email-setup-guide.md for detailed instructions');
} else {
  console.log('\n✅ Email configuration looks good!');
  console.log('🧪 Test email sending through your application (e.g., OTP verification)');
}

console.log('\n📧 Current Status:');
const isConfigured = process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.length > 10;
console.log('- Password reset emails: ' + (isConfigured ? '✅ Will send real emails via SendGrid' : '❌ Development mode (console only)'));
console.log('- Email verification: ' + (isConfigured ? '✅ Will send real emails via SendGrid' : '❌ Development mode (console only)'));

console.log('\n💡 Tip: Even in development mode, the forgot password functionality works!');
console.log('   Emails are logged to the console for testing purposes.');
console.log('\n📦 SendGrid Benefits:');
console.log('   ✅ Works on cloud platforms (Render, Heroku, etc.) without port blocking');
console.log('   ✅ Better deliverability and analytics');
console.log('   ✅ More reliable API-based delivery'); 