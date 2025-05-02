// auth.js - Authentication routes
const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const authMiddleware = require('../middlewares/auth');
const config = require('../config/config');

/**
 * Login route - Verify member and send OTP
 */
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    // Basic validation
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    // Verify member and send OTP
    const result = await authService.verifyMember(phoneNumber);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error in login route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Verify OTP route
 */
router.post('/verify', async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    
    // Basic validation
    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and verification code are required'
      });
    }
    
    // Verify OTP
    const result = await authService.verifyOTP(phoneNumber, otp);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // Set session cookie
    res.cookie('session_token', result.sessionToken, {
      maxAge: config.session.duration,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Set to true in production
      sameSite: 'strict'
    });
    
    // Remove sensitive data before sending response
    delete result.sessionToken;
    
    res.json(result);
  } catch (err) {
    console.error('Error in verify route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Resend OTP route
 */
router.post('/resend-otp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    // Basic validation
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }
    
    // Resend OTP
    const result = await authService.resendOTP(phoneNumber);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error in resend OTP route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get current session information
 */
router.get('/session', authMiddleware.authenticateUser, async (req, res) => {
  try {
    // Session data is attached by the authenticateUser middleware
    res.json({
      success: true,
      member: req.session.member,
      hasVoted: req.session.hasVoted,
      voteId: req.session.voteId
    });
  } catch (err) {
    console.error('Error in session route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Logout route
 */
router.post('/logout', async (req, res) => {
  try {
    // Get session token from cookies
    const sessionToken = req.cookies.session_token;
    
    if (sessionToken) {
      // End session
      await authService.endSession(sessionToken);
      
      // Clear session cookie
      res.clearCookie('session_token');
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('Error in logout route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Admin login route
 */
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Basic validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    // Log admin login attempt
    console.log(`Admin login attempt: username=${username}`);
    
    // Verify admin credentials
    const result = await authService.verifyAdmin(username, password);
    
    if (!result.success) {
      console.log(`Admin login failed: ${result.message}`);
      return res.status(401).json(result);
    }
    
    console.log(`Admin login successful for: ${username}`);
    
    // Set admin session cookie
    res.cookie('admin_token', result.adminToken, {
      maxAge: config.session.duration,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Set to true in production
      sameSite: 'strict'
    });
    
    // Remove sensitive data before sending response
    delete result.adminToken;
    
    res.json(result);
  } catch (err) {
    console.error('Error in admin login route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Verify admin session
 */
router.get('/admin/session', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      isAdmin: true
    });
  } catch (err) {
    console.error('Error in admin session route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Admin logout route
 */
router.post('/admin/logout', async (req, res) => {
  try {
    // Get admin token from cookies
    const adminToken = req.cookies.admin_token;
    
    if (adminToken) {
      // End session
      await authService.endSession(adminToken);
      
      // Clear admin cookie
      res.clearCookie('admin_token');
    }
    
    res.json({
      success: true,
      message: 'Admin logged out successfully'
    });
  } catch (err) {
    console.error('Error in admin logout route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;