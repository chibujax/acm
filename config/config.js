// config.js - Configuration settings for the application

module.exports = {
    // Session settings
    session: {
      cookieName: 'voting_session',
      secret: process.env.SESSION_SECRET || 'voting-system-secret-key',
      duration: 30 * 60 * 1000, // 30 minutes
    },
    
    // OTP settings
    otp: {
      length: 6,
      expiry: 10 * 60 * 1000, // 10 minutes
    },
    
    // File paths for data storage
    dataFiles: {
      members: './data/members.json',
      positions: './data/positions.json',
      candidates: './data/candidates.json',
      votes: './data/votes.json',
      sessions: './data/sessions.json',
    },
    
    // Twilio configuration (for SMS OTP)
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER,
    },
    
    // Admin credentials (should be moved to environment variables in production)
    admin: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD, // Change this in production!
    },
  
    // Security settings
    security: {
      maxLoginAttempts: 5,
      lockoutTime: 30 * 60 * 1000, // 30 minutes
    }
  };