const crypto = require('crypto');
const TheatreOwner = require('../models/TheatreOwner');
const TheatreOwnerApplication = require('../models/TheatreOwnerApplication');

class AccountService {
  /**
   * Normalize theatre type from application to match TheatreOwner enum
   * @param {string} theatreType
   * @returns {string} One of: 'Single Screen' | 'Multiplex' | 'Drive-in' | 'IMAX' | 'Other'
   */
  normalizeTheatreType(theatreType) {
    if (!theatreType) return 'Other';
    const value = String(theatreType)
      .toLowerCase()
      .trim()
      .replace(/[_-]+/g, ' ');

    if (value === 'single screen' || value === 'single') return 'Single Screen';
    if (value === 'multiplex' || value === 'multi plex') return 'Multiplex';
    if (value === 'drive in' || value === 'drivein') return 'Drive-in';
    if (value === 'imax' || value === 'i max') return 'IMAX';
    return 'Other';
  }
  
  /**
   * Generate a secure random password
   * @param {number} length - Password length (default: 12)
   * @returns {string} Generated password
   */
  generatePassword(length = 12) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each category
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    // Add one character from each category
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate a unique username based on theatre name
   * @param {string} theatreName - Name of the theatre
   * @param {string} ownerName - Name of the owner (fallback)
   * @returns {Promise<string>} Generated username
   */
  async generateUsername(theatreName, ownerName) {
    // Clean and format the theatre name
    let baseUsername = theatreName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove special characters
      .substring(0, 15); // Limit length
    
    // If theatre name is too short, use owner name
    if (baseUsername.length < 3) {
      baseUsername = ownerName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 15);
    }
    
    // If still too short, add default prefix
    if (baseUsername.length < 3) {
      baseUsername = 'theatre' + baseUsername;
    }
    
    let username = baseUsername;
    let counter = 1;
    
    // Check if username exists and increment counter if needed
    while (await TheatreOwner.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
      
      // Prevent infinite loop
      if (counter > 999) {
        username = `${baseUsername}${Date.now()}`;
        break;
      }
    }
    
    return username;
  }

  /**
   * Create a theatre owner account from approved application
   * @param {Object} application - The approved theatre application
   * @returns {Promise<Object>} Created account with credentials
   */
  async createTheatreOwnerAccount(application) {
    try {
      // If an account already exists for this email, reuse it
      const existingAccountByEmail = await TheatreOwner.findOne({ email: application.email });
      if (existingAccountByEmail) {
        console.log('ℹ️ Theatre owner account already exists for email. Reusing existing account:', {
          id: existingAccountByEmail._id,
          email: existingAccountByEmail.email,
          username: existingAccountByEmail.username
        });
        return {
          account: existingAccountByEmail,
          credentials: null // Do not generate new credentials for existing account
        };
      }

      // Generate credentials
      const username = await this.generateUsername(application.theatreName, application.ownerName);
      const password = this.generatePassword(12);
      
      // Parse location if it's a string
      let locationData = {};
      if (typeof application.location === 'string') {
        locationData = {
          address: application.locationText || application.location,
          city: 'Not specified',
          state: 'Not specified',
          pincode: 'Not specified'
        };
      } else if (application.location && typeof application.location === 'object') {
        locationData = application.location;
      }
      
      // Create theatre owner account
      const theatreOwner = new TheatreOwner({
        username,
        email: application.email,
        password, // Will be hashed by the pre-save middleware
        ownerName: application.ownerName,
        phone: application.phone,
        theatreName: application.theatreName,
        theatreType: this.normalizeTheatreType(application.theatreType),
        location: locationData,
        screenCount: parseInt(application.screenCount) || 1,
        seatingCapacity: parseInt(application.seatingCapacity) || 100,
        applicationId: application._id,
        isActive: true,
        isEmailVerified: false, // They can verify later
        preferences: {
          notifications: {
            email: true,
            sms: false
          },
          timezone: 'Asia/Kolkata'
        }
      });
      
      // Save the account
      let savedAccount;
      try {
        savedAccount = await theatreOwner.save();
      } catch (saveError) {
        // Handle rare race-condition duplicate username/email
        if (saveError && saveError.code === 11000) {
          console.warn('⚠️ Duplicate key on save, regenerating username and retrying...', saveError.keyValue);
          const retryUsername = await this.generateUsername(application.theatreName + Date.now(), application.ownerName);
          theatreOwner.username = retryUsername;
          savedAccount = await theatreOwner.save();
        } else {
          throw saveError;
        }
      }
      
      console.log('✅ Theatre owner account created:', {
        id: savedAccount._id,
        username: savedAccount.username,
        email: savedAccount.email,
        theatreName: savedAccount.theatreName
      });
      
      return {
        account: savedAccount,
        credentials: {
          username,
          password // Return plain password for email
        }
      };
      
    } catch (error) {
      console.error('❌ Error creating theatre owner account:', error);
      throw new Error(`Failed to create theatre owner account: ${error.message}`);
    }
  }

  /**
   * Update application status and create account if approved
   * @param {string} applicationId - Application ID
   * @param {string} status - New status ('approved' or 'rejected')
   * @param {string} reason - Rejection reason (if rejected)
   * @returns {Promise<Object>} Result with account info if approved
   */
  async processApplicationApproval(applicationId, status, reason = null) {
    try {
      // Find the application
      const application = await TheatreOwnerApplication.findById(applicationId);
      if (!application) {
        throw new Error('Application not found');
      }
      
      // Check if already processed
      if (application.status !== 'pending') {
        throw new Error(`Application is already ${application.status}`);
      }
      
      let result = {
        application: null,
        account: null,
        credentials: null
      };
      
      if (status === 'approved') {
        // Create theatre owner account
        const accountResult = await this.createTheatreOwnerAccount(application);
        
        // Update application status
        application.status = 'approved';
        application.approvedAt = new Date();
        application.updatedAt = new Date();
        
        result.account = accountResult.account;
        result.credentials = accountResult.credentials;
        
      } else if (status === 'rejected') {
        // Update application status
        application.status = 'rejected';
        application.rejectionReason = reason;
        application.rejectedAt = new Date();
        application.updatedAt = new Date();
      }
      
      // Save the updated application
      result.application = await application.save();
      
      return result;
      
    } catch (error) {
      console.error('❌ Error processing application approval:', error);
      throw error;
    }
  }

  /**
   * Generate a temporary password reset token
   * @returns {string} Reset token
   */
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate password strength
   * @param {string} password - Password to validate
   * @returns {Object} Validation result
   */
  validatePassword(password) {
    const minLength = 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }
    
    if (!hasUppercase) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!hasLowercase) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!hasNumbers) {
      errors.push('Password must contain at least one number');
    }
    
    if (!hasSpecialChar) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: this.calculatePasswordStrength(password)
    };
  }

  /**
   * Calculate password strength score
   * @param {string} password - Password to evaluate
   * @returns {string} Strength level
   */
  calculatePasswordStrength(password) {
    let score = 0;
    
    // Length
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character types
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Complexity
    if (password.length >= 16) score += 1;
    
    if (score < 3) return 'weak';
    if (score < 5) return 'medium';
    return 'strong';
  }
}

module.exports = new AccountService();
