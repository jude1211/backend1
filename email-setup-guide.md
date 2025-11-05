# Email Setup Guide for BookNView

## 🔧 Setting up SendGrid for Email Sending

SendGrid is now used instead of Gmail SMTP to avoid "Render blocked SMTP ports" issues. SendGrid uses HTTPS API instead of SMTP, which works reliably on cloud platforms like Render.

### Step 1: Get SendGrid API Key

1. Sign up for a free SendGrid account at [https://sendgrid.com](https://sendgrid.com)
2. Verify your email address
3. Navigate to **Settings** → **API Keys** in the SendGrid dashboard
4. Click **Create API Key**
5. Give it a name (e.g., "BookNView Production")
6. Select **Full Access** permissions (or at minimum: **Mail Send** permissions)
7. Click **Create & View**
8. **Copy the API key immediately** - you won't be able to see it again!

### Step 2: Verify Sender Email (Recommended)

1. In SendGrid dashboard, go to **Settings** → **Sender Authentication**
2. Click **Verify a Single Sender** (or use Domain Authentication for production)
3. Enter your email address and complete verification
4. This email will be used as the "from" address in emails

### Step 3: Configure Environment Variables

Create or update your `.env` file in the backend directory:

```env
# SendGrid Email Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@booknview.com

# Example:
# SENDGRID_API_KEY=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
# SENDGRID_FROM_EMAIL=your-verified-email@yourdomain.com
```

**Important Notes:**
- `SENDGRID_API_KEY` is **required** - the API key you copied from SendGrid
- `SENDGRID_FROM_EMAIL` is **optional** - defaults to `noreply@booknview.com` if not set
- The `SENDGRID_FROM_EMAIL` must be verified in your SendGrid account

### Step 4: Test Email Configuration

1. Start the backend server:
   ```bash
   npm start
   ```

2. Look for the initialization message:
   ```
   ✅ SendGrid email service initialized successfully
   📧 Email service ready: your-email@domain.com
   ```

3. Test sending an email through your application (e.g., OTP verification, password reset)

## 🔍 Troubleshooting

### Common Issues:

1. **"SendGrid API key not configured" error:**
   - Make sure `SENDGRID_API_KEY` is set in your `.env` file
   - Check that the API key starts with `SG.` and is the full key
   - Restart your server after adding the environment variable

2. **"Unauthorized" error (401):**
   - Your API key is invalid or has been revoked
   - Generate a new API key in SendGrid dashboard
   - Make sure the API key has "Mail Send" permissions

3. **"Forbidden" error (403):**
   - Your API key doesn't have sufficient permissions
   - Create a new API key with "Full Access" or at minimum "Mail Send" permissions

4. **"Sender email not verified" error:**
   - Verify your sender email in SendGrid dashboard
   - Go to **Settings** → **Sender Authentication** → **Verify a Single Sender**
   - Or set `SENDGRID_FROM_EMAIL` to a verified email address

5. **Emails not being received:**
   - Check spam/junk folder
   - Verify recipient email is valid
   - Check SendGrid Activity Feed in dashboard for delivery status
   - Review SendGrid error logs in the console output

### SendGrid Free Tier Limits:

- **100 emails/day** on the free tier
- For production, consider upgrading to a paid plan
- Monitor usage in SendGrid dashboard

### Security Notes:

- ✅ API keys are secure and designed for server-side use
- ✅ Never commit API keys to version control
- ✅ API keys can be revoked anytime from SendGrid dashboard
- ✅ Each API key can have different permissions
- ✅ Use environment variables to store API keys securely

## 📧 Email Templates

The system sends beautiful HTML emails for:
- Email verification codes (OTP)
- Password reset codes (OTP)
- Booking confirmations
- Theatre application approvals/rejections

All emails include:
- BookNView branding
- Clear instructions
- Security warnings
- Professional styling

## 🚀 Migration from Gmail SMTP

If you're migrating from Gmail SMTP:

1. Remove old Gmail environment variables (`EMAIL_USER`, `EMAIL_PASS`)
2. Add `SENDGRID_API_KEY` to your `.env` file
3. Optionally set `SENDGRID_FROM_EMAIL` to a verified email
4. Restart your server
5. The system will automatically use SendGrid instead of Gmail SMTP

**Benefits of SendGrid over Gmail SMTP:**
- ✅ Works on cloud platforms (Render, Heroku, etc.) without port blocking issues
- ✅ Better deliverability and reputation management
- ✅ Built-in analytics and tracking
- ✅ More reliable API-based delivery
- ✅ No need for app passwords or 2FA setup
