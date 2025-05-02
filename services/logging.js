const fileDb = require('./fileDb');

async function logAdminAction(adminId, adminUsername, action, details) {
  try {
    const now = Date.now();
    const logEntry = {
      id: `log_${now}_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: now,
      adminId,
      adminUsername,
      action,
      details,
      ipAddress: null, // Can be set by the controller
      userAgent: null, // Can be set by the controller
    };
    
    await fileDb.create('adminLogs', logEntry);
    return true;
  } catch (err) {
    console.error('Error logging admin action:', err);
    return false;
  }
}

module.exports = {
  logAdminAction
};