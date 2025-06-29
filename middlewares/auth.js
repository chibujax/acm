// auth.js - Authentication middleware
const authService = require('../services/auth');
const fileDb = require('../services/fileDb');
const logger = require('../services/logger');

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
    logger.error('Authentication error:', err);
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
    
    logger.info(`Admin authentication check - token present: ${!!adminToken}`);
    
    if (!adminToken) {
      logger.info('No admin token found in cookies');
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }
    
    // Validate admin session
    const isValidAdmin = await authService.validateAdminSession(adminToken);
    
    logger.info(`Admin token validation result: ${isValidAdmin}`);
    
    if (!isValidAdmin) {
      // Clear invalid admin token cookie
      res.clearCookie('admin_token');
      logger.info('Invalid admin token - cookie cleared');
      
      return res.status(401).json({
        success: false,
        message: 'Admin session expired or invalid'
      });
    }
    
    // Attach admin status to request
    req.isAdmin = true;
    logger.info('Admin authenticated successfully');
    
    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    logger.error('Admin authentication error:', err);
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
    logger.error('Voting eligibility check error:', err);
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
    logger.error('Error attaching user session:', err);
    // Proceed anyway, this is an optional middleware
    next();
  }
}

// In middlewares/auth.js - Update authenticateAdmin

async function authenticateAdmin(req, res, next) {
  try {
    // Get admin token from cookies
    const adminToken = req.cookies.admin_token;
    
    if (!adminToken) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }
    
    // Get session details (now with admin ID)
    const session = await fileDb.findBy('sessions', 'id', adminToken);
    
    if (!session || !session.isAdmin || Date.now() > session.expiresAt) {
      // Clear invalid admin token cookie
      res.clearCookie('admin_token');
      
      return res.status(401).json({
        success: false,
        message: 'Admin session expired or invalid'
      });
    }
    
    // Attach admin info to request
    req.isAdmin = true;
    req.adminId = session.adminId;
    req.adminUsername = session.adminUsername;
    
    // Proceed to the next middleware or route handler
    next();
  } catch (err) {
    logger.error('Admin authentication error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

// In middlewares/auth.js - Replace your checkPermission function with this:

/**
 * Middleware to check admin permissions
 */
function checkPermission(req, res, next) {
  try {
    // This middleware should run after authenticateAdmin
    if (!req.isAdmin || !req.adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }
    
    // Get admin details
    fileDb.findBy('admins', 'id', req.adminId)
      .then(admin => {
        if (!admin) {
          return res.status(404).json({
            success: false,
            message: 'Admin not found'
          });
        }
        
        // Store permissions in request object for later use
        req.adminPermissions = admin.permissions || [];
        
        // Admin has been found, proceed
        next();
      })
      .catch(err => {
        logger.error('Error getting admin details:', err);
        return res.status(500).json({
          success: false,
          message: 'Internal server error'
        });
      });
  } catch (err) {
    logger.error('Permission check error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Middleware to check if admin has a specific permission
 * @param {string} permission - The permission to check
 */
function hasPermission(permission) {
  return function(req, res, next) {
    // Check if the required permission exists in admin's permissions
    if (!req.adminPermissions || !req.adminPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    
    // Admin has the permission, proceed
    next();
  };
}


module.exports = {
  authenticateUser,
  authenticateAdmin,
  checkVotingEligibility,
  attachUserIfAuthenticated,
  checkPermission,
  hasPermission 
};