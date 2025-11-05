# Fix for "Gmail SMTP connection failed" on Render

## Problem
If you're seeing `❌ Gmail SMTP connection failed: Connection timeout` in your Render logs, it means:
1. The code hasn't been deployed yet, OR
2. The `SENDGRID_API_KEY` environment variable is not set on Render

## Solution Steps

### Step 1: Set Environment Variables on Render

1. Go to your Render Dashboard: https://dashboard.render.com
2. Click on your backend service
3. Go to **Environment** tab
4. Click **Add Environment Variable**

**Add these variables:**
```
Key: SENDGRID_API_KEY
Value: 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
```

**Optional (recommended):**
```
Key: SENDGRID_FROM_EMAIL
Value: noreply@booknview.com
```

### Step 2: Remove Old Gmail Variables (if they exist)

If you see these variables in Render, **DELETE them**:
- `EMAIL_USER`
- `EMAIL_PASS`

### Step 3: Deploy Updated Code

**Option A: Auto-deploy (if enabled)**
- Just commit and push your changes to GitHub
- Render will automatically deploy

**Option B: Manual deploy**
1. Go to your service in Render Dashboard
2. Click **Manual Deploy** → **Deploy latest commit**

### Step 4: Verify Deployment

After deployment, check your Render logs. You should see:
```
✅ SendGrid email service initialized successfully
📧 Email service ready: noreply@booknview.com
```

**If you still see Gmail SMTP errors:**
1. Make sure you've committed and pushed all changes to GitHub
2. Check that the deployment actually completed successfully
3. Verify `SENDGRID_API_KEY` is set correctly in Render Environment tab
4. Try manually restarting the service

## Quick Checklist

- [ ] `SENDGRID_API_KEY` is set in Render Environment variables
- [ ] Old `EMAIL_USER` and `EMAIL_PASS` variables are removed (if they existed)
- [ ] Code changes are committed and pushed to GitHub
- [ ] New deployment completed successfully on Render
- [ ] Service restarted (happens automatically after deploy)

## Testing

After deployment, try sending an email (e.g., password reset or OTP). Check the logs - you should see:
- `📧 Attempting to send real email via SendGrid to: [email]`
- `✅ Real email sent successfully`

If you see `📧 EMAIL SERVICE - DEVELOPMENT MODE (No SendGrid)`, it means `SENDGRID_API_KEY` is not set correctly.

