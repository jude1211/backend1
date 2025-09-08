const admin = require('firebase-admin');

let firebaseApp = null;

const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (firebaseApp) {
      return firebaseApp;
    }

    // Check if required environment variables are set
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PRIVATE_KEY_ID', 
      'FIREBASE_PRIVATE_KEY',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_CLIENT_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('⚠️ Missing Firebase environment variables:', missingVars.join(', '));
      console.log('🔧 Running in development mode without Firebase Admin SDK');
      console.log('📝 To enable Firebase, create a .env file with the required variables');
      console.log('📖 See FIREBASE_ADMIN_SETUP.md for setup instructions');
      return null;
    }

    // For development, you can use a service account key file
    // For production, use environment variables
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
      token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: `https://www.googleapis.com/oauth2/v1/certs`,
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL)}`
    };

    // Initialize Firebase Admin SDK
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    return firebaseApp;

  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    
    // For development, create a mock Firebase instance
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Running in development mode without Firebase Admin SDK');
      console.log('📝 To enable Firebase, configure the required environment variables');
      return null;
    }
    
    throw error;
  }
};

const getFirebaseApp = () => {
  if (!firebaseApp) {
    return initializeFirebase();
  }
  return firebaseApp;
};

const verifyFirebaseToken = async (idToken) => {
  try {
    const app = getFirebaseApp();
    
    if (!app) {
      // Development mode - return mock user for testing
      if (process.env.NODE_ENV === 'development') {
        return {
          uid: 'dev-user-123',
          email: 'dev@example.com',
          name: 'Development User',
          email_verified: true
        };
      }
      throw new Error('Firebase not initialized');
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
    
  } catch (error) {
    console.error('Firebase token verification error:', error.message);
    throw new Error('Invalid or expired token');
  }
};

const getUserByUid = async (uid) => {
  try {
    const app = getFirebaseApp();
    
    if (!app) {
      // Development mode
      if (process.env.NODE_ENV === 'development') {
        return {
          uid: uid,
          email: 'dev@example.com',
          displayName: 'Development User',
          emailVerified: true
        };
      }
      throw new Error('Firebase not initialized');
    }

    const userRecord = await admin.auth().getUser(uid);
    return userRecord;
    
  } catch (error) {
    console.error('Get user error:', error.message);
    throw new Error('User not found');
  }
};

const createCustomToken = async (uid, additionalClaims = {}) => {
  try {
    const app = getFirebaseApp();
    
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
    return customToken;
    
  } catch (error) {
    console.error('Create custom token error:', error.message);
    throw new Error('Failed to create custom token');
  }
};

const setCustomUserClaims = async (uid, customClaims) => {
  try {
    const app = getFirebaseApp();
    
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    await admin.auth().setCustomUserClaims(uid, customClaims);
    return true;
    
  } catch (error) {
    console.error('Set custom claims error:', error.message);
    throw new Error('Failed to set custom claims');
  }
};

const deleteUser = async (uid) => {
  try {
    const app = getFirebaseApp();
    
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    await admin.auth().deleteUser(uid);
    return true;
    
  } catch (error) {
    console.error('Delete user error:', error.message);
    throw new Error('Failed to delete user');
  }
};

const listUsers = async (maxResults = 1000, pageToken = null) => {
  try {
    const app = getFirebaseApp();
    
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    const listUsersResult = await admin.auth().listUsers(maxResults, pageToken);
    return listUsersResult;
    
  } catch (error) {
    console.error('List users error:', error.message);
    throw new Error('Failed to list users');
  }
};

const sendPasswordResetEmail = async (email) => {
  try {
    const app = getFirebaseApp();
    
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    const link = await admin.auth().generatePasswordResetLink(email);
    return link;
    
  } catch (error) {
    console.error('Send password reset error:', error.message);
    throw new Error('Failed to send password reset email');
  }
};

const sendEmailVerification = async (uid) => {
  try {
    const app = getFirebaseApp();
    
    if (!app) {
      throw new Error('Firebase not initialized');
    }

    const user = await admin.auth().getUser(uid);
    const link = await admin.auth().generateEmailVerificationLink(user.email);
    return link;
    
  } catch (error) {
    console.error('Send email verification error:', error.message);
    throw new Error('Failed to send email verification');
  }
};

module.exports = {
  initializeFirebase,
  getFirebaseApp,
  verifyFirebaseToken,
  getUserByUid,
  createCustomToken,
  setCustomUserClaims,
  deleteUser,
  listUsers,
  sendPasswordResetEmail,
  sendEmailVerification,
  admin
};
