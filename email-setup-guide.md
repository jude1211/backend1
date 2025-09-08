# Email Setup Guide for BookNView

## 🔧 Setting up Gmail for Password Reset Emails

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Navigate to "Security" → "2-Step Verification"
3. Enable 2-Factor Authentication if not already enabled

### Step 2: Generate App Password
1. In Google Account Settings, go to "Security" → "2-Step Verification"
2. Scroll down and click "App passwords"
3. Select "Mail" from the dropdown
4. Click "Generate"
5. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 3: Configure Environment Variables

Create or update your `.env` file in the backend directory:

```env
# Email Configuration
EMAIL_USER=your.email@gmail.com
EMAIL_PASS=your_16_character_app_password

# Example:
# EMAIL_USER=booknview@gmail.com
# EMAIL_PASS=abcd efgh ijkl mnop
```

### Step 4: Test Email Configuration

Run the email test script:
```bash
node scripts/testEmail.js
```

### Step 5: Verify Password Reset Emails

1. Start the backend server:
   ```bash
   npm start
   ```

2. Test the forgot password functionality:
   ```bash
   node scripts/testForgotPassword.js
   ```

## 🔍 Troubleshooting

### Common Issues:

1. **"Invalid credentials" error:**
   - Make sure you're using the App Password, not your regular Gmail password
   - Ensure the App Password is exactly 16 characters

2. **"Less secure app access" error:**
   - This is normal - App Passwords are designed for this purpose
   - Make sure 2-Factor Authentication is enabled

3. **"Connection timeout" error:**
   - Check your internet connection
   - Try again in a few minutes

### Security Notes:

- ✅ App Passwords are secure and designed for this use case
- ✅ Never use your regular Gmail password
- ✅ App Passwords can be revoked anytime from Google Account settings
- ✅ Each app password is unique and can be deleted individually

## 📧 Email Templates

The system sends beautiful HTML emails for:
- Password reset requests
- Password reset confirmations
- Email verification codes

All emails include:
- BookNView branding
- Clear instructions
- Security warnings
- Professional styling 