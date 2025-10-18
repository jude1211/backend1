const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      // Check if email credentials are configured
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || 
          process.env.EMAIL_USER.includes('your_') || 
          process.env.EMAIL_PASS.includes('your_')) {
        console.log('📧 Email credentials not configured - using development mode');
        console.log('🔧 To enable real emails, update EMAIL_USER and EMAIL_PASS in .env file');
        this.transporter = null;
        return;
      }

      // Configure Gmail SMTP with timeout
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 5000,    // 5 seconds
        socketTimeout: 10000      // 10 seconds
      });

      // Test the connection
      this.transporter.verify((error, success) => {
        if (error) {
          console.error('❌ Gmail SMTP connection failed:', error.message);
          console.log('🔧 Falling back to development mode');
          this.transporter = null;
        } else {
          console.log('✅ Gmail SMTP connected successfully');
          console.log(`📧 Email service ready: ${process.env.EMAIL_USER}`);
        }
      });

    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      console.log('🔧 Running without email service - OTPs will be logged to console');
      this.transporter = null;
    }
  }

  async sendOTP(email, otp, type = 'verification') {
    const subject = type === 'verification'
      ? 'BookNView - Email Verification Code'
      : 'BookNView - Password Reset Code';

    const htmlContent = this.getOTPEmailTemplate(otp, type);

    console.log(`📧 Sending ${type} OTP to:`, email);

    // If no transporter is configured, fall back to console logging
    if (!this.transporter) {
      // Development mode - log OTP to console
      console.log('\n' + '='.repeat(60));
      console.log('📧 EMAIL SERVICE - DEVELOPMENT MODE (No SMTP)');
      console.log('='.repeat(60));
      console.log('📧 TO:', email);
      console.log('📧 FROM:', process.env.EMAIL_USER || 'noreply@booknview.com');
      console.log('📧 SUBJECT:', subject);
      console.log('📧 OTP CODE:', otp);
      console.log('📧 TYPE:', type);
      console.log('='.repeat(60));
      console.log('⚠️  COPY THIS OTP CODE FOR TESTING ⚠️');
      console.log('⚠️  EMAIL WOULD BE SENT TO: ' + email + ' ⚠️');
      console.log('='.repeat(60));
      console.log('🔧 To enable real emails, configure EMAIL_USER and EMAIL_PASS in .env file');
      console.log('📖 See email-setup-guide.md for detailed instructions');
      console.log('='.repeat(60) + '\n');
      return {
        success: true,
        message: `OTP logged to console (no SMTP configured) - would send to ${email}`,
        otp: otp, // Include OTP in response for development
        recipientEmail: email
      };
    }

    try {
      const mailOptions = {
        from: `"BookNView" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: htmlContent
      };

      console.log('📧 Attempting to send real email to:', email);

      // Set a timeout for email sending
      const emailPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout')), 15000)
      );

      const result = await Promise.race([emailPromise, timeoutPromise]);

      console.log('✅ Real email sent successfully to:', email);
      console.log('📧 Message ID:', result.messageId);
      console.log('📬 Check your email inbox for the OTP!');

      return {
        success: true,
        messageId: result.messageId,
        message: `OTP sent to ${email}. Check your inbox!`
      };
    } catch (error) {
      console.error('❌ Real email sending failed:', error.message);

      // Fall back to console logging with clear indication
      console.log('\n' + '='.repeat(60));
      console.log('📧 EMAIL FALLBACK - CONSOLE MODE');
      console.log('='.repeat(60));
      console.log('📧 TO:', email);
      console.log('📧 FROM:', process.env.EMAIL_USER);
      console.log('📧 SUBJECT:', subject);
      console.log('📧 OTP CODE:', otp);
      console.log('📧 TYPE:', type);
      console.log('📧 REASON: Real email failed, using console fallback');
      console.log('='.repeat(60));
      console.log('⚠️  COPY THIS OTP CODE FOR TESTING ⚠️');
      console.log('⚠️  REAL EMAIL FAILED - USING CONSOLE FALLBACK ⚠️');
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        message: `Email sending failed, OTP logged to console: ${otp}`,
        otp: otp,
        fallback: true
      };
    }
  }

  getOTPEmailTemplate(otp, type) {
    const title = type === 'verification' ? 'Verify Your Email' : 'Reset Your Password';
    const message = type === 'verification' 
      ? 'Please use the following code to verify your email address:'
      : 'Please use the following code to reset your password:';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">BookNView</h1>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #ddd;">
          <h2 style="color: #333; margin-top: 0;">${title}</h2>
          <p style="font-size: 16px; margin-bottom: 20px;">${message}</p>
          
          <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h3 style="margin: 0; color: #667eea; font-size: 32px; letter-spacing: 5px; font-family: 'Courier New', monospace;">${otp}</h3>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #999; text-align: center;">
            This is an automated message from BookNView. Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;
  }

  // General email sending method for custom emails (like password reset)
  async sendEmail(email, subject, htmlContent) {
    console.log(`📧 Sending email to: ${email}`);
    console.log(`📧 Subject: ${subject}`);

    // If no transporter is configured, fall back to console logging
    if (!this.transporter) {
      // Development mode - log email to console
      console.log('\n' + '='.repeat(60));
      console.log('📧 EMAIL SERVICE - DEVELOPMENT MODE (No SMTP)');
      console.log('='.repeat(60));
      console.log('📧 TO:', email);
      console.log('📧 FROM:', process.env.EMAIL_USER || 'noreply@booknview.com');
      console.log('📧 SUBJECT:', subject);
      console.log('📧 CONTENT TYPE: HTML');
      console.log('='.repeat(60));
      console.log('⚠️  EMAIL WOULD BE SENT TO: ' + email + ' ⚠️');
      console.log('⚠️  CHECK CONSOLE FOR EMAIL CONTENT ⚠️');
      console.log('='.repeat(60));
      console.log('📧 EMAIL CONTENT:');
      console.log(htmlContent.replace(/<[^>]*>/g, '')); // Strip HTML for console
      console.log('='.repeat(60));
      console.log('🔧 To enable real emails, configure EMAIL_USER and EMAIL_PASS in .env file');
      console.log('📖 See email-setup-guide.md for detailed instructions');
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        message: `Email logged to console (no SMTP configured) - would send to ${email}`,
        recipientEmail: email
      };
    }

    try {
      const mailOptions = {
        from: `"BookNView" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: subject,
        html: htmlContent
      };

      console.log('📧 Attempting to send real email to:', email);

      // Set a timeout for email sending
      const emailPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email timeout')), 15000)
      );

      const result = await Promise.race([emailPromise, timeoutPromise]);

      console.log('✅ Real email sent successfully to:', email);
      console.log('📧 Message ID:', result.messageId);

      return {
        success: true,
        message: `Email sent successfully to ${email}`,
        messageId: result.messageId,
        recipientEmail: email
      };

    } catch (error) {
      console.error('❌ Failed to send email to:', email);
      console.error('❌ Email error:', error.message);

      // Return error details for debugging
      return {
        success: false,
        message: `Failed to send email: ${error.message}`,
        error: error.message,
        recipientEmail: email
      };
    }
  }

  async sendApplicationApprovalEmail(theatreOwner, credentials) {
    const subject = '🎉 Your Theatre Application has been Approved!';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Approved</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .credentials-box { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .credential-item { margin: 10px 0; padding: 10px; background: #f0f4ff; border-radius: 5px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Congratulations!</h1>
            <h2>Your Theatre Application has been Approved</h2>
          </div>

          <div class="content">
            <p>Dear <strong>${theatreOwner.ownerName}</strong>,</p>

            <p>We are excited to inform you that your theatre application for <strong>"${theatreOwner.theatreName}"</strong> has been approved!</p>

            <p>Your theatre is now part of the BookNView platform, and you can start managing your shows, bookings, and more.</p>

            <div class="credentials-box">
              <h3>🔐 Your Login Credentials</h3>
              <p>Use these credentials to access your Theatre Owner Dashboard through the general BookNView login page:</p>

              <div class="credential-item">
                <strong>Username:</strong> ${credentials.username}
              </div>

              <div class="credential-item">
                <strong>Password:</strong> ${credentials.password}
              </div>

              <div class="credential-item">
                <strong>Login URL:</strong> <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}">BookNView General Login</a>
              </div>
            </div>

            <div class="warning">
              <strong>⚠️ Important Security Notice:</strong><br>
              Please change your password after your first login for security purposes. Keep your credentials safe and do not share them with anyone.
            </div>

            <h3>🎬 What's Next?</h3>
            <ul>
              <li>Log in to your dashboard using the credentials above</li>
              <li>Complete your theatre profile setup</li>
              <li>Add your movie screens and seating arrangements</li>
              <li>Start listing your shows and movies</li>
              <li>Begin accepting bookings from customers</li>
            </ul>

            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="button">
              Login to BookNView
            </a>

            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

            <p>Welcome to BookNView!</p>

            <p>Best regards,<br>
            <strong>The BookNView Team</strong></p>
          </div>

          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
            <p>© 2024 BookNView. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Congratulations! Your Theatre Application has been Approved

      Dear ${theatreOwner.ownerName},

      We are excited to inform you that your theatre application for "${theatreOwner.theatreName}" has been approved!

      Your Login Credentials:
      Username: ${credentials.username}
      Password: ${credentials.password}
      Login URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/theatre-owner/login

      Please change your password after your first login for security purposes.

      What's Next:
      - Log in to your dashboard using the credentials above
      - Complete your theatre profile setup
      - Add your movie screens and seating arrangements
      - Start listing your shows and movies
      - Begin accepting bookings from customers

      Welcome to BookNView!

      Best regards,
      The BookNView Team
    `;

    return await this.sendEmail(theatreOwner.email, subject, html);
  }

  async sendApplicationRejectionEmail(applicationData, reason) {
    const subject = '❌ Theatre Application Status Update';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .reason-box { background: #fff; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Application Status Update</h1>
          </div>

          <div class="content">
            <p>Dear <strong>${applicationData.ownerName}</strong>,</p>

            <p>Thank you for your interest in joining the BookNView platform. After careful review, we regret to inform you that your theatre application for <strong>"${applicationData.theatreName}"</strong> has not been approved at this time.</p>

            <div class="reason-box">
              <h3>📝 Reason for Rejection:</h3>
              <p>${reason}</p>
            </div>

            <p>We encourage you to address the mentioned concerns and reapply in the future. Our team is always here to help you meet our requirements.</p>

            <p>If you have any questions about this decision or need clarification on our requirements, please feel free to contact our support team.</p>

            <p>Thank you for your understanding.</p>

            <p>Best regards,<br>
            <strong>The BookNView Team</strong></p>
          </div>

          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
            <p>© 2024 BookNView. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail(applicationData.email, subject, html);
  }

  async sendBookingConfirmationEmail(bookingData) {
    const subject = '🎬 Your Movie Tickets are Confirmed!';

    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const formatTime = (time) => {
      return time; // Already in readable format like "2:30 PM"
    };

    const seatsList = bookingData.seats.map(seat => 
      `${seat.row}${seat.number} (₹${seat.price})`
    ).join(', ');

    const totalAmount = bookingData.pricing?.totalAmount || bookingData.seats.reduce((sum, seat) => sum + seat.price, 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .ticket-box { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .movie-info { display: flex; align-items: center; margin: 20px 0; }
          .movie-poster { width: 80px; height: 120px; object-fit: cover; border-radius: 8px; margin-right: 20px; }
          .movie-details h3 { margin: 0 0 10px 0; color: #333; }
          .movie-details p { margin: 5px 0; color: #666; }
          .booking-details { background: #f0f4ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .detail-row { display: flex; justify-content: space-between; margin: 8px 0; }
          .detail-label { font-weight: bold; color: #333; }
          .detail-value { color: #666; }
          .seats-list { background: #e8f2ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .qr-code { text-align: center; margin: 20px 0; }
          .qr-placeholder { background: #f0f0f0; border: 2px dashed #ccc; padding: 20px; border-radius: 8px; color: #666; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          .important { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎬 Booking Confirmed!</h1>
            <h2>Your Movie Tickets are Ready</h2>
          </div>

          <div class="content">
            <p>Dear <strong>${bookingData.contactInfo?.name || 'Valued Customer'}</strong>,</p>

            <p>Thank you for choosing BookNView! Your movie ticket booking has been confirmed successfully.</p>

            <div class="ticket-box">
              <h3>🎫 Booking Details</h3>
              
              <div class="movie-info">
                ${bookingData.movie?.poster ? `<img src="${bookingData.movie.poster}" alt="${bookingData.movie.title}" class="movie-poster">` : ''}
                <div class="movie-details">
                  <h3>${bookingData.movie?.title || 'Movie'}</h3>
                  <p><strong>Duration:</strong> ${bookingData.movie?.duration || 'N/A'}</p>
                  <p><strong>Language:</strong> ${bookingData.movie?.language || 'English'}</p>
                </div>
              </div>

              <div class="booking-details">
                <div class="detail-row">
                  <span class="detail-label">Booking ID:</span>
                  <span class="detail-value">${bookingData.bookingId}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Theatre:</span>
                  <span class="detail-value">${bookingData.theatre?.name || 'Theatre'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Screen:</span>
                  <span class="detail-value">Screen ${bookingData.theatre?.screen?.screenNumber || 'N/A'} (${bookingData.theatre?.screen?.screenType || '2D'})</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${formatDate(bookingData.showtime?.date)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Show Time:</span>
                  <span class="detail-value">${formatTime(bookingData.showtime?.time)}</span>
                </div>
              </div>

              <div class="seats-list">
                <h4>🎫 Selected Seats:</h4>
                <p><strong>${seatsList}</strong></p>
                <p><strong>Total Amount: ₹${totalAmount}</strong></p>
              </div>

              <div class="qr-code">
                <h4>📱 Your QR Code:</h4>
                <div class="qr-placeholder">
                  <p>QR Code: ${bookingData.bookingId}</p>
                  <p><small>Show this at the theatre entrance</small></p>
                </div>
              </div>
            </div>

            <div class="important">
              <strong>⚠️ Important Instructions:</strong><br>
              • Please arrive at the theatre at least 15 minutes before showtime<br>
              • Bring a valid ID and this booking confirmation<br>
              • Show the QR code at the entrance for easy entry<br>
              • Seats are non-refundable and non-transferable<br>
              • In case of any issues, contact the theatre directly
            </div>

            <h3>🎬 Enjoy Your Movie!</h3>
            <p>We hope you have a wonderful time watching <strong>${bookingData.movie?.title || 'the movie'}</strong>!</p>

            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>

            <p>Thank you for choosing BookNView!</p>

            <p>Best regards,<br>
            <strong>The BookNView Team</strong></p>
          </div>

          <div class="footer">
            <p>This is an automated email. Please do not reply to this email.</p>
            <p>© 2024 BookNView. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Booking Confirmation - ${bookingData.movie?.title || 'Movie'}

      Dear ${bookingData.contactInfo?.name || 'Valued Customer'},

      Thank you for choosing BookNView! Your movie ticket booking has been confirmed successfully.

      Booking Details:
      Booking ID: ${bookingData.bookingId}
      Movie: ${bookingData.movie?.title || 'Movie'}
      Theatre: ${bookingData.theatre?.name || 'Theatre'}
      Screen: Screen ${bookingData.theatre?.screen?.screenNumber || 'N/A'} (${bookingData.theatre?.screen?.screenType || '2D'})
      Date: ${formatDate(bookingData.showtime?.date)}
      Show Time: ${formatTime(bookingData.showtime?.time)}
      
      Selected Seats: ${seatsList}
      Total Amount: ₹${totalAmount}

      Important Instructions:
      • Please arrive at the theatre at least 15 minutes before showtime
      • Bring a valid ID and this booking confirmation
      • Show the QR code at the entrance for easy entry
      • Seats are non-refundable and non-transferable
      • In case of any issues, contact the theatre directly

      Enjoy your movie!

      Best regards,
      The BookNView Team
    `;

    return await this.sendEmail(bookingData.contactInfo?.email, subject, html);
  }
}

module.exports = new EmailService();
