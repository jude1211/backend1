const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      message,
      statusCode: 404
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field} already exists`;
    error = {
      message,
      statusCode: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message,
      statusCode: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      message,
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = {
      message,
      statusCode: 401
    };
  }

  // Firebase errors
  if (err.code && err.code.startsWith('auth/')) {
    const message = getFirebaseErrorMessage(err.code);
    error = {
      message,
      statusCode: 401
    };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const getFirebaseErrorMessage = (errorCode) => {
  const errorMessages = {
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'User account has been disabled',
    'auth/user-not-found': 'User not found',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'Email is already registered',
    'auth/weak-password': 'Password is too weak',
    'auth/operation-not-allowed': 'Operation not allowed',
    'auth/invalid-credential': 'Invalid credentials',
    'auth/credential-already-in-use': 'Credential is already in use',
    'auth/invalid-verification-code': 'Invalid verification code',
    'auth/invalid-verification-id': 'Invalid verification ID',
    'auth/missing-verification-code': 'Missing verification code',
    'auth/missing-verification-id': 'Missing verification ID',
    'auth/code-expired': 'Verification code has expired',
    'auth/invalid-phone-number': 'Invalid phone number',
    'auth/missing-phone-number': 'Missing phone number',
    'auth/quota-exceeded': 'Quota exceeded',
    'auth/captcha-check-failed': 'Captcha check failed',
    'auth/invalid-app-credential': 'Invalid app credential',
    'auth/invalid-app-id': 'Invalid app ID',
    'auth/invalid-user-token': 'Invalid user token',
    'auth/network-request-failed': 'Network request failed',
    'auth/requires-recent-login': 'Recent login required',
    'auth/too-many-requests': 'Too many requests',
    'auth/unauthorized-domain': 'Unauthorized domain',
    'auth/user-token-expired': 'User token expired',
    'auth/web-storage-unsupported': 'Web storage unsupported',
    'auth/invalid-api-key': 'Invalid API key',
    'auth/app-not-authorized': 'App not authorized',
    'auth/keychain-error': 'Keychain error',
    'auth/internal-error': 'Internal error',
    'auth/invalid-custom-token': 'Invalid custom token',
    'auth/custom-token-mismatch': 'Custom token mismatch'
  };

  return errorMessages[errorCode] || 'Authentication error';
};

module.exports = errorHandler;
