const fs = require('fs');
const path = require('path');

console.log('🔧 BookNView Environment Setup');
console.log('==============================\n');

// Check if .env file already exists
const envPath = path.join(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('⚠️  .env file already exists');
  console.log('📝 If you want to recreate it, delete the existing .env file first\n');
} else {
  console.log('📝 Creating .env file...\n');
  
  const envContent = `# Server Configuration
NODE_ENV=development
PORT=5001
API_VERSION=v1

# MongoDB Configuration
MONGODB_URI=mongodb+srv://jude:Jude%402002@booknview-cluster.xzpi8e0.mongodb.net/?appName=booknview-cluster
MONGODB_TEST_URI=mongodb://localhost:27017/booknview_test

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# Firebase Admin SDK Configuration
# Get these values from Firebase Console > Project Settings > Service Accounts
FIREBASE_PROJECT_ID=booknview-d2c04
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYour private key here\\n-----END PRIVATE KEY-----\\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@booknview-d2c04.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# CORS Configuration
CORS_ORIGIN=http://localhost:5174

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Frontend URL
FRONTEND_URL=http://localhost:5174
`;

  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env file created successfully!');
    console.log('📝 Please update the values in the .env file with your actual configuration');
    console.log('📖 See FIREBASE_ADMIN_SETUP.md for Firebase setup instructions');
    console.log('📖 See email-setup-guide.md for email setup instructions');
    console.log('📖 See CLOUDINARY_INTEGRATION.md for Cloudinary setup instructions\n');
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
    console.log('📝 Please create a .env file manually in the backend directory');
  }
}

console.log('🚀 Next steps:');
console.log('1. Update the .env file with your actual configuration values');
console.log('2. Run: npm run dev');
console.log('3. The server will start in development mode with mock Firebase authentication');
console.log('4. For full Firebase functionality, complete the Firebase setup in FIREBASE_ADMIN_SETUP.md\n'); 