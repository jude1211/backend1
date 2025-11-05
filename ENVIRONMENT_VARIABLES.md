# Backend Environment Variables

This document lists all environment variables used in the backend with their exact values from the `.env` file.

## Server Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `PORT` | `5000` | Server port number |
| `NODE_ENV` | `development` | Node environment (development/production/test) |
| `API_VERSION` | `v1` | API version prefix |

## MongoDB Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://jude:Jude%402002@booknview-cluster.xzpi8e0.mongodb.net/?appName=booknview-cluster` | Primary MongoDB connection string (MongoDB Atlas) |
| `MONGODB_TEST_URI` | `mongodb://localhost:27017/booknview_test` | Test database connection string (used when NODE_ENV=test) |
| `MONGO_URI` | *(not set, fallback for MONGODB_URI)* | Alternative MongoDB URI variable name |

## JWT Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `JWT_SECRET` | `booknview_super_secret_jwt_key_for_development_only_change_in_production` | Secret key for JWT token signing |
| `JWT_EXPIRE` | `7d` | JWT token expiration time |

## Email Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `EMAIL_USER` | `judinmathew2002@gmail.com` | Gmail address for sending emails |
| `EMAIL_PASS` | `lilo uplk ujni xfcn` | Gmail app password for SMTP authentication |

## Firebase Admin SDK Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `FIREBASE_PROJECT_ID` | `booknview-d2c04` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY_ID` | *(empty)* | Firebase private key ID |
| `FIREBASE_PRIVATE_KEY` | *(empty)* | Firebase private key (should be in format: `"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`) |
| `FIREBASE_CLIENT_EMAIL` | *(empty)* | Firebase service account client email |
| `FIREBASE_CLIENT_ID` | *(empty)* | Firebase client ID |
| `FIREBASE_AUTH_URI` | `https://accounts.google.com/o/oauth2/auth` | Firebase OAuth2 authentication URI |
| `FIREBASE_TOKEN_URI` | `https://oauth2.googleapis.com/token` | Firebase OAuth2 token URI |

## API Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin for frontend |
| `FRONTEND_URL` | `http://localhost:5175` | Frontend application URL (used for Socket.IO and email links) |

## File Upload Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `MAX_FILE_SIZE` | `5242880` | Maximum file size in bytes (5MB) |
| `UPLOAD_PATH` | `uploads/` | Local directory path for file uploads |

## Cloudinary Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `CLOUDINARY_CLOUD_NAME` | `dslj1txvj` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | `931738837518615` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | `zfPmslDpPzTcrOwUdjn0oFFtL1c` | Cloudinary API secret |
| `CLOUDINARY_URL` | `cloudinary://931738837518615:zfPmslDpPzTcrOwUdjn0oFFtL1c@dslj1txvj` | Complete Cloudinary URL (alternative to individual config) |

## Rate Limiting Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds (15 minutes) |
| `RATE_LIMIT_MAX_REQUESTS` | `5000` | Maximum requests allowed per window |

## Logging Configuration

| Variable | Value | Description |
|----------|-------|-------------|
| `LOG_LEVEL` | `info` | Logging level (info/error/debug/warn) |

## Additional Environment Variables (Used in Code but Not in .env)

These variables are referenced in the code but not currently set in the `.env` file. They use hardcoded fallback values:

| Variable | Current Value (from code) | Description | Used In |
|----------|---------------------------|-------------|---------|
| `RAZORPAY_KEY_ID` | `rzp_test_RL5vMta3bKvRd4` | Razorpay payment gateway key ID (hardcoded test value) | `routes/payments.js` (line 11) |
| `RAZORPAY_KEY_SECRET` | `9qxxugjEleGtcqcOjWFmCB2n` | Razorpay payment gateway key secret (hardcoded test value) | `routes/payments.js` (line 12) |
| `TMDB_API_KEY` | *(not set - returns empty string)* | The Movie Database (TMDB) API key - if not set, trailer fetching is disabled | `routes/movies.js` (line 662) |
| `MAX_ADVANCE_DAYS` | `3` | Maximum days in advance for booking (defaults to 3 if not set) | `routes/screens.js` (line 168) |
| `npm_package_version` | *(from package.json)* | Package version (auto-set by npm) | `server.js` (health check) |

### Razorpay Variable Priority Order

The code checks environment variables in this order (from `routes/payments.js` lines 11-12):

**For Key ID:**
1. `RAZORPAY_KEY_ID`
2. `RZP_KEY_ID` (fallback)
3. `RAZORPAY_ID` (fallback)
4. Hardcoded: `rzp_test_RL5vMta3bKvRd4` (final fallback - **currently in use**)

**For Key Secret:**
1. `RAZORPAY_KEY_SECRET`
2. `RZP_KEY_SECRET` (fallback)
3. `RAZORPAY_SECRET` (fallback)
4. Hardcoded: `9qxxugjEleGtcqcOjWFmCB2n` (final fallback - **currently in use**)

### TMDB_API_KEY Behavior

From `routes/movies.js` (line 662-663):
- If `TMDB_API_KEY` is not set, the `fetchTrailerUrl` function returns an empty string
- Movie trailer fetching functionality is disabled
- No error is thrown, the feature simply doesn't work

### MAX_ADVANCE_DAYS Behavior

From `routes/screens.js` (line 168):
- Default value: `3` (parsed as integer)
- Formula: `parseInt(process.env.MAX_ADVANCE_DAYS || '3', 10)`
- Hard cap safety limit: Maximum 14 days (enforced in code regardless of this setting)
- Currently using default value of `3` days since variable is not set in `.env`

## Notes

- Password in `MONGODB_URI` is URL-encoded (`@` is encoded as `%40`)
- Empty Firebase variables indicate Firebase Admin SDK is not fully configured
- Razorpay credentials use hardcoded test values as fallback if not set in environment
- CORS is configured to allow multiple localhost ports (5173, 5174, 5175) in addition to `CORS_ORIGIN`

## Environment Variable Usage Summary

### By Category:
- **Server**: 3 variables (PORT, NODE_ENV, API_VERSION)
- **Database**: 2 variables (MONGODB_URI, MONGODB_TEST_URI)
- **Authentication**: 2 variables (JWT_SECRET, JWT_EXPIRE)
- **Email**: 2 variables (EMAIL_USER, EMAIL_PASS)
- **Firebase**: 7 variables (6 required, 1 optional)
- **API**: 2 variables (CORS_ORIGIN, FRONTEND_URL)
- **File Upload**: 2 variables (MAX_FILE_SIZE, UPLOAD_PATH)
- **Cloudinary**: 4 variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_URL)
- **Rate Limiting**: 2 variables (RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS)
- **Logging**: 1 variable (LOG_LEVEL)

**Total: 27 environment variables configured in .env file**

