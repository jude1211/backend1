# Firebase Admin SDK Setup Guide

## 🔥 Getting Firebase Admin Credentials

### Step 1: Go to Firebase Console
1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **booknview-d2c04**

### Step 2: Generate Service Account Key
1. Click the **gear icon** (⚙️) → **Project Settings**
2. Go to the **Service accounts** tab
3. Click **Generate new private key**
4. Click **Generate key** to download the JSON file

### Step 3: Extract Credentials from JSON
Open the downloaded JSON file and copy these values to your `.env` file:

```json
{
  "type": "service_account",
  "project_id": "booknview-d2c04",           ← Copy this
  "private_key_id": "abc123...",             ← Copy this  
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n", ← Copy this
  "client_email": "firebase-adminsdk-xxxxx@booknview-d2c04.iam.gserviceaccount.com", ← Copy this
  "client_id": "123456789012345678901",      ← Copy this
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

### Step 4: Update .env File
Replace the empty values in your `.env` file:

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=booknview-d2c04
FIREBASE_PRIVATE_KEY_ID=abc123def456ghi789  
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@booknview-d2c04.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=123456789012345678901
```

### ⚠️ Important Notes:

1. **Private Key Format**: Keep the quotes around the private key and include `\n` for line breaks
2. **Security**: Never commit the `.env` file to version control
3. **Permissions**: The service account automatically has the necessary permissions

### Step 5: Test the Setup
After updating `.env`, restart your server:
```bash
npm run dev
```

You should see:
```
✅ Firebase Admin SDK initialized successfully
```

Instead of:
```
❌ Firebase initialization error: Failed to parse private key
```

## 🔧 Alternative: Development Mode

If you want to test without Firebase Admin SDK, the backend will run in development mode with mock authentication. This is useful for:
- Testing API endpoints
- Database operations
- Development without Firebase setup

## 🚨 Troubleshooting

### "Failed to parse private key"
- Check that private key is properly formatted with `\n` characters
- Ensure the private key is wrapped in quotes
- Verify no extra spaces or characters

### "Invalid project ID"
- Confirm `FIREBASE_PROJECT_ID` matches your Firebase project
- Check for typos in the project ID

### "Service account not found"
- Verify the service account email is correct
- Ensure the service account key was generated recently

## ✅ Quick Test

Once configured, you can test the Firebase integration by making a request to:
```
GET http://localhost:5001/health
```

This should return server status without Firebase errors.
