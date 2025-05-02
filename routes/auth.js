// auth.js - Authentication routes
const express = require('express');
const router = express.Router();
const authService = require('../services/auth');
const authMiddleware = require('../middlewares/auth');
const config = require('../config/config');
const fileDb = require('../services/fileDb');

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


// Check if admin needs to change password
router.get('/admin/check-password', authMiddleware.authenticateAdmin, async (req, res) => {
    try {
      // Get admin information from the session
      const adminId = req.adminId;
      const admin = await fileDb.findBy('admins', 'id', adminId);
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      res.json({
        success: true,
        isUsingDefaultPassword: admin.isDefaultPassword === true
      });
    } catch (err) {
      console.error('Error checking admin password status:', err);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });
  
  // Route to change admin password
  router.post('/admin/change-password', authMiddleware.authenticateAdmin, async (req, res) => {
    try {
      const { newPassword, confirmPassword } = req.body;
      
      // Basic validation
      if (!newPassword || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password and confirmation are required'
        });
      }
      
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match'
        });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long'
        });
      }
      
      // Get admin information from the session
      const adminId = req.adminId;
      const admin = await fileDb.findBy('admins', 'id', adminId);
      
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'Admin not found'
        });
      }
      
      // Hash the new password
      const passwordHash = await authService.hashPassword(newPassword);
      
      // Update the admin record
      const updates = {
        passwordHash,
        isDefaultPassword: false,
        updatedAt: Date.now()
      };
      
      await fileDb.update('admins', 'id', adminId, updates);
      
      // Log the password change
      const loggingService = require('../services/logging');
      await loggingService.logAdminAction(
        adminId,
        admin.username,
        'password_change',
        { message: 'Admin changed their password' }
      );
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (err) {
      console.error('Error changing admin password:', err);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  });

module.exports = router;