// security.js - Security utilities
const crypto = require('crypto');
const config = require('../config/config');

/**
 * Generates a random session token
 * @returns {string} A random session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generates a random OTP (One-Time Password)
 * @returns {string} A numeric OTP of specified length
 */
function generateOTP() {
  const { length } = config.otp;
  
  // Generate a random number with the specified number of digits
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  
  return otp.toString();
}

/**
 * Hashes a value using SHA-256
 * @param {string} value - The value to hash
 * @returns {string} The hashed value
 */
function hashValue(value) {
  return crypto
    .createHash('sha256')
    .update(value.toString())
    .digest('hex');
}

/**
 * Creates an anonymous identifier for a member's vote
 * @param {string} memberId - The member's ID
 * @param {string} secret - A secret value to make the hash unique
 * @returns {string} An anonymized identifier
 */
function anonymizeVoter(memberId, secret) {
  return crypto
    .createHash('sha256')
    .update(`${memberId}-${secret}`)
    .digest('hex');
}

/**
 * Validates that a request has proper CSRF protection
 * @param {Object} req - Express request object
 * @returns {boolean} True if CSRF token is valid
 */
function validateCSRF(req) {
  const token = req.body._csrf || req.query._csrf || req.headers['x-csrf-token'];
  const storedToken = req.cookies.csrf_token;
  
  // Both tokens must exist and match
  return token && storedToken && token === storedToken;
}

/**
 * Generates a CSRF token
 * @returns {string} A CSRF token
 */
function generateCSRFToken() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  generateSessionToken,
  generateOTP,
  hashValue,
  anonymizeVoter,
  validateCSRF,
  generateCSRFToken
};