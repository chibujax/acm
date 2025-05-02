// auth.js - Authentication middleware
const authService = require('../services/auth');

/**
 * Middleware to authenticate user sessions
 * Verifies session token from cookies and attaches the session to the request
 */
async function authenticateUser(req, res, next) {
  try {
    // Get session token from cookies
    const sessionToken = req.cookies.session_token;
    
    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Validate session
    const session = await authService.validateSession(sessionToken);
    
    if (!session) {
      // Clear invalid session cookie
      res.clearCookie('session_token');
      
      return res.status(401).json({
        success: false,
        message: 'Session expired or invalid'
      });
    }
    
    // Attach session to request
    req.session = session;
    
    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Middleware to authenticate admin sessions
 * Verifies admin token from cookies and attaches admin status to the request
 */
async function authenticateAdmin(req, res, next) {
  try {
    // Get admin token from cookies
    const adminToken = req.cookies.admin_token;
    
    console.log(`Admin authentication check - token present: ${!!adminToken}`);
    
    if (!adminToken) {
      console.log('No admin token found in cookies');
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }
    
    // Validate admin session
    const isValidAdmin = await authService.validateAdminSession(adminToken);
    
    console.log(`Admin token validation result: ${isValidAdmin}`);
    
    if (!isValidAdmin) {
      // Clear invalid admin token cookie
      res.clearCookie('admin_token');
      console.log('Invalid admin token - cookie cleared');
      
      return res.status(401).json({
        success: false,
        message: 'Admin session expired or invalid'
      });
    }
    
    // Attach admin status to request
    req.isAdmin = true;
    console.log('Admin authenticated successfully');
    
    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    console.error('Admin authentication error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Middleware to check if user has already voted
 * Requires authenticateUser middleware to run first
 */
async function checkVotingEligibility(req, res, next) {
  try {
    if (!req.session) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Check if user has already voted
    if (req.session.hasVoted) {
      return res.status(403).json({
        success: false,
        message: 'You have already cast your vote in this election',
        voteId: req.session.voteId
      });
    }
    
    // User is eligible to vote, proceed
    next();
  } catch (err) {
    console.error('Voting eligibility check error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Optional middleware to attach user session if available
 * Does not return an error if no session is found
 */
async function attachUserIfAuthenticated(req, res, next) {
  try {
    // Get session token from cookies
    const sessionToken = req.cookies.session_token;
    
    if (sessionToken) {
      // Validate session
      const session = await authService.validateSession(sessionToken);
      
      if (session) {
        // Attach session to request
        req.session = session;
      }
    }
    
    // Proceed to the next middleware or route handler regardless
    next();
  } catch (err) {
    console.error('Error attaching user session:', err);
    // Proceed anyway, this is an optional middleware
    next();
  }
}

module.exports = {
  authenticateUser,
  authenticateAdmin,
  checkVotingEligibility,
  attachUserIfAuthenticated
};