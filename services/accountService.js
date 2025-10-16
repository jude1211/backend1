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
  async generateUsername(theatreName, ownerName, email) {
    // Generate username in format: theatrename@booknview.com
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
    
    let username = `${baseUsername}@booknview.com`;
    let counter = 1;
    
    // Check if username exists and increment counter if needed
    while (await TheatreOwner.findOne({ username })) {
      username = `${baseUsername}${counter}@booknview.com`;
      counter++;
      
      // Prevent infinite loop
      if (counter > 999) {
        username = `${baseUsername}${Date.now()}@booknview.com`;
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
      const username = await this.generateUsername(application.theatreName, application.ownerName, application.email);
      const password = this.generatePassword(12);
      
      console.log('🔐 Generated credentials for theatre owner:', {
        username,
        passwordLength: password.length,
        theatreName: application.theatreName,
        email: application.email
      });
      
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
          const retryUsername = await this.generateUsername(application.theatreName + Date.now(), application.ownerName, application.email);
          theatreOwner.username = retryUsername;
          savedAccount = await theatreOwner.save();
        } else {
          throw saveError;
        }
      }
      
      console.log('✅ Theatre owner account created and stored in MongoDB Atlas:', {
        id: savedAccount._id,
        username: savedAccount.username,
        email: savedAccount.email,
        theatreName: savedAccount.theatreName,
        passwordGenerated: true,
        credentialsStored: true,
        collection: 'theatreowners',
        database: savedAccount.constructor.db.name
      });

      // Create screen layouts from application data
      if (application.screens && application.screens.length > 0) {
        try {
          const ScreenLayout = require('../models/ScreenLayout');
          const screenLayouts = [];
          
          for (const screen of application.screens) {
            if (screen.rows && screen.columns) {
              // Parse aisle columns
              const aisleColumns = screen.aisleColumns 
                ? screen.aisleColumns.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
                : [];
              
              // Create seat classes from application data
              const seatClasses = screen.seatClasses ? screen.seatClasses.map(sc => ({
                className: sc.label,
                price: parseInt(sc.price) || 200,
                color: this.getColorForSeatClass(sc.label),
                tier: this.getTierForSeatClass(sc.label),
                rows: this.getRowRangeForSeatClass(sc.label, parseInt(screen.rows))
              })) : [];
              
              const screenLayout = new ScreenLayout({
                screenId: screen.screenNumber.toString(),
                theatreId: savedAccount._id,
                screenName: `Screen ${screen.screenNumber}`,
                meta: {
                  rows: parseInt(screen.rows),
                  columns: parseInt(screen.columns),
                  aisles: aisleColumns
                },
                seatClasses: seatClasses,
                seats: [], // Will be populated when owner configures layout
                updatedBy: savedAccount._id.toString()
              });
              
              await screenLayout.save();
              screenLayouts.push(screenLayout);
              
              console.log(`✅ Screen layout created for Screen ${screen.screenNumber}:`, {
                screenId: screen.screenNumber,
                rows: screen.rows,
                columns: screen.columns,
                aisles: aisleColumns,
                seatClasses: seatClasses.length
              });
            }
          }
          
          console.log(`✅ Created ${screenLayouts.length} screen layouts for theatre owner`);
        } catch (layoutError) {
          console.error('⚠️ Error creating screen layouts (non-critical):', layoutError);
          // Don't fail the entire process for layout creation errors
        }
      }
      
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

  /**
   * Get color for seat class
   * @param {string} className - Seat class name
   * @returns {string} Hex color code
   */
  getColorForSeatClass(className) {
    const colors = {
      'Gold': '#f59e0b',
      'Silver': '#9ca3af', 
      'Balcony': '#22c55e',
      'Premium': '#8b5cf6',
      'VIP': '#ef4444'
    };
    return colors[className] || '#6b7280';
  }

  /**
   * Get tier for seat class
   * @param {string} className - Seat class name
   * @returns {string} Tier level
   */
  getTierForSeatClass(className) {
    const tiers = {
      'Gold': 'Premium',
      'Silver': 'Base',
      'Balcony': 'VIP',
      'Premium': 'Premium',
      'VIP': 'VIP'
    };
    return tiers[className] || 'Base';
  }

  /**
   * Get row range for seat class
   * @param {string} className - Seat class name
   * @param {number} totalRows - Total number of rows
   * @returns {string} Row range (e.g., "A-C")
   */
  getRowRangeForSeatClass(className, totalRows) {
    if (totalRows <= 0) return 'A';
    
    // Updated distribution: Gold gets more seats (50%), Silver and Balcony get fewer (25% each)
    const ranges = {
      'Gold': { start: 0, end: Math.floor(totalRows * 0.5) - 1 },
      'Silver': { start: Math.floor(totalRows * 0.5), end: Math.floor(totalRows * 0.75) - 1 },
      'Balcony': { start: Math.floor(totalRows * 0.75), end: totalRows - 1 },
      'Premium': { start: 0, end: Math.floor(totalRows * 0.5) - 1 }, // Same as Gold
      'VIP': { start: Math.floor(totalRows * 0.75), end: totalRows - 1 } // Same as Balcony
    };
    
    const range = ranges[className] || { start: 0, end: totalRows - 1 };
    const startRow = String.fromCharCode('A'.charCodeAt(0) + Math.max(0, range.start));
    const endRow = String.fromCharCode('A'.charCodeAt(0) + Math.min(totalRows - 1, range.end));
    
    return startRow === endRow ? startRow : `${startRow}-${endRow}`;
  }
}

module.exports = new AccountService();
