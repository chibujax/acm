// auth.js - Authentication service
const crypto = require('crypto');
const fileDb = require('./fileDb');
const smsService = require('./sms');
const security = require('../utils/security');
const config = require('../config/config');
const bcrypt = require('bcrypt');

// Store active OTPs in memory (in production, use a proper database or Redis)
const activeOTPs = new Map();

/**
 * Verify member credentials and send OTP
 * @param {string} phoneNumber - The member's phone number
 * @returns {Object} Result indicating success or failure
 */
async function verifyMember(phoneNumber) {
  try {
    // Find member by membership number
    const member = await fileDb.findBy('members', 'phoneNumber', phoneNumber);
    
    if (!member) {
      return {
        success: false,
        message: 'Invalid membership number. Please check and try again.'
      };
    }
    
    // Generate OTP
    const otp = security.generateOTP();
    
    // Store OTP with expiry
    const now = Date.now();
    const expiryTime = now + config.otp.expiry;
    
    activeOTPs.set(phoneNumber, {
      otp,
      expiryTime,
      memberId: member.id,
      attempts: 0
    });
    
    // Send OTP via SMS
    await smsService.sendOTP(phoneNumber, otp);
    
    return {
      success: true,
      message: 'Verification code sent to your phone.'
    };
  } catch (err) {
    console.error('Error verifying member:', err);
    throw err;
  }
}

/**
 * Verify OTP and create session
 * @param {string} phoneNumber - The phone number the OTP was sent to
 * @param {string} otp - The OTP to verify
 * @returns {Object} Result with session token if successful
 */
async function verifyOTP(phoneNumber, otp) {
  try {
    // Check if there's an active OTP for this phone number
    const otpData = activeOTPs.get(phoneNumber);
    
    if (!otpData) {
      return {
        success: false,
        message: 'Verification code has expired or was never sent. Please request a new code.'
      };
    }
    
    // Check if OTP has expired
    const now = Date.now();
    if (now > otpData.expiryTime) {
      // Remove expired OTP
      activeOTPs.delete(phoneNumber);
      
      return {
        success: false,
        message: 'Verification code has expired. Please request a new code.'
      };
    }
    
    // Increment attempts
    otpData.attempts += 1;
    
    // Check if too many attempts
    if (otpData.attempts >= 5) {
      // Remove OTP data
      activeOTPs.delete(phoneNumber);
      
      return {
        success: false,
        message: 'Too many failed attempts. Please request a new verification code.'
      };
    }
    
    // Check if OTP matches
    if (otpData.otp !== otp) {
      return {
        success: false,
        message: 'Invalid verification code. Please try again.'
      };
    }
    
    // OTP is valid, get member details
    const member = await fileDb.findBy('members', 'id', otpData.memberId);
    
    if (!member) {
      return {
        success: false,
        message: 'Member account not found. Please contact the administrator.'
      };
    }
    
    // Generate session token
    const sessionToken = security.generateSessionToken();
    
    // Create session record
    const sessionRecord = {
      id: sessionToken,
      memberId: member.id,
      createdAt: now,
      expiresAt: now + config.session.duration,
      ipAddress: null, // Will be set by the controller
      userAgent: null, // Will be set by the controller
    };
    
    // Store session
    await fileDb.create('sessions', sessionRecord);
    
    // Remove OTP data
    activeOTPs.delete(phoneNumber);
    
    // Check if member has already voted
    const vote = await fileDb.findBy('votes', 'memberId', member.id);
    
    return {
      success: true,
      message: 'Verification successful',
      sessionToken,
      member: {
        id: member.id,
        name: member.name,
      },
      hasVoted: !!vote,
      voteId: vote ? vote.id : null
    };
  } catch (err) {
    console.error('Error verifying OTP:', err);
    throw err;
  }
}

/**
 * Resend OTP to member
 * @param {string} phoneNumber - The phone number to send the OTP to
 * @returns {Object} Result indicating success or failure
 */
async function resendOTP(phoneNumber) {
  try {
    // Find member by phone number
    const member = await fileDb.findBy('members', 'phoneNumber', phoneNumber);
    
    if (!member) {
      return {
        success: false,
        message: 'Invalid phone number. Please check and try again.'
      };
    }
    
    // Generate new OTP
    const otp = security.generateOTP();
    
    // Store OTP with expiry
    const now = Date.now();
    const expiryTime = now + config.otp.expiry;
    
    activeOTPs.set(phoneNumber, {
      otp,
      expiryTime,
      memberId: member.id,
      attempts: 0
    });
    
    // Send OTP via SMS
    await smsService.sendOTP(phoneNumber, otp);
    
    return {
      success: true,
      message: 'New verification code sent to your phone.'
    };
  } catch (err) {
    console.error('Error resending OTP:', err);
    throw err;
  }
}

/**
 * Validate an active session
 * @param {string} sessionToken - The session token to validate
 * @returns {Object} Session details if valid, null if invalid
 */
async function validateSession(sessionToken) {
  try {
    if (!sessionToken) {
      return null;
    }
    
    // Find session
    const session = await fileDb.findBy('sessions', 'id', sessionToken);
    
    if (!session) {
      return null;
    }
    
    // Check if session has expired
    const now = Date.now();
    if (now > session.expiresAt) {
      // Remove expired session
      await fileDb.remove('sessions', 'id', sessionToken);
      return null;
    }
    
    // Get member details
    const member = await fileDb.findBy('members', 'id', session.memberId);
    
    if (!member) {
      return null;
    }
    
    // Check if member has already voted
    const vote = await fileDb.findBy('votes', 'memberId', member.id);
    
    // Extend session expiry
    session.expiresAt = now + config.session.duration;
    await fileDb.update('sessions', 'id', sessionToken, { expiresAt: session.expiresAt });
    
    return {
      sessionToken,
      member: {
        id: member.id,
        name: member.name,
      },
      hasVoted: !!vote,
      voteId: vote ? vote.id : null
    };
  } catch (err) {
    console.error('Error validating session:', err);
    throw err;
  }
}

/**
 * End a user session
 * @param {string} sessionToken - The session token to end
 * @returns {boolean} True if successful
 */
async function endSession(sessionToken) {
  try {
    if (!sessionToken) {
      return false;
    }
    
    // Remove session
    const result = await fileDb.remove('sessions', 'id', sessionToken);
    return result;
  } catch (err) {
    console.error('Error ending session:', err);
    throw err;
  }
}

async function hashPassword(plainPassword) {
  const saltRounds = 10;
  return await bcrypt.hash(plainPassword, saltRounds);
}

/**
 * Verify admin credentials
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 * @returns {Object} Result with admin token if successful
 */
async function verifyAdmin(username, password) {
  try {
    // Get admin accounts
    const admins = await fileDb.read('admins');
    
    // Find the admin by username
    const admin = admins.find(admin => admin.username === username);
    
    if (!admin) {
      return {
        success: false,
        message: 'Invalid admin credentials'
      };
    }
    
    // Compare the provided password with the stored hash
    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    
    if (!passwordMatch) {
      return {
        success: false,
        message: 'Invalid admin credentials'
      };
    }
    
    // Check if the admin is using the default password
    const isUsingDefaultPassword = admin.isDefaultPassword === true;
    
    // Generate admin token
    const adminToken = security.generateSessionToken();
    
    // Create admin session record with admin ID
    const now = Date.now();
    const sessionRecord = {
      id: adminToken,
      isAdmin: true,
      adminId: admin.id,
      adminUsername: admin.username,
      createdAt: now,
      expiresAt: now + config.session.duration,
      ipAddress: null, // Will be set by the controller
      userAgent: null, // Will be set by the controller
    };
    
    // Store admin session
    await fileDb.create('sessions', sessionRecord);
    
    return {
      success: true,
      message: 'Admin login successful',
      adminToken,
      isUsingDefaultPassword
    };
  } catch (err) {
    console.error('Error verifying admin:', err);
    throw err;
  }
}
/**
 * Validate an admin session
 * @param {string} adminToken - The admin token to validate
 * @returns {boolean} True if valid
 */
async function validateAdminSession(adminToken) {
  try {
    if (!adminToken) {
      return false;
    }
    
    // Find session
    const session = await fileDb.findBy('sessions', 'id', adminToken);
    
    if (!session || !session.isAdmin) {
      return false;
    }
    
    // Check if session has expired
    const now = Date.now();
    if (now > session.expiresAt) {
      // Remove expired session
      await fileDb.remove('sessions', 'id', adminToken);
      return false;
    }
    
    // Extend session expiry
    session.expiresAt = now + config.session.duration;
    await fileDb.update('sessions', 'id', adminToken, { expiresAt: session.expiresAt });
    
    return true;
  } catch (err) {
    console.error('Error validating admin session:', err);
    throw err;
  }
}

module.exports = {
  verifyMember,
  verifyOTP,
  resendOTP,
  validateSession,
  endSession,
  verifyAdmin,
  validateAdminSession,
  hashPassword
};