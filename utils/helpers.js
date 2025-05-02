// helpers.js - Helper functions
const path = require('path');

/**
 * Validates a phone number format
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} True if the phone number is valid
 */
function isValidPhoneNumber(phoneNumber) {
  // Basic validation for demonstration purposes
  // In production, use a proper phone validation library or regex
  // This accepts numbers with optional + prefix and 10-15 digits
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  return phoneRegex.test(phoneNumber);
}

/**
 * Formats a phone number for display
 * @param {string} phoneNumber - The phone number to format
 * @returns {string} The formatted phone number
 */
function formatPhoneNumber(phoneNumber) {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Format US numbers as (XXX) XXX-XXXX
  // This is a simple example - adjust for your region/requirements
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
  }
  
  // Return as-is if we can't format it
  return phoneNumber;
}

/**
 * Gets the time elapsed since a given timestamp
 * @param {number} timestamp - The timestamp in milliseconds
 * @returns {string} A human-readable time difference
 */
function getTimeElapsed(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  // Convert to seconds
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  }
  
  // Convert to minutes
  const minutes = Math.floor(seconds / 60);
  
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  
  // Convert to hours
  const hours = Math.floor(minutes / 60);
  
  if (hours < 24) {
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  
  // Convert to days
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

/**
 * Validates that an email address has a valid format
 * @param {string} email - The email address to validate
 * @returns {boolean} True if the email is valid
 */
function isValidEmail(email) {
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Creates a safe filename from a string
 * @param {string} str - The string to convert to a filename
 * @returns {string} A safe filename
 */
function safeFilename(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

/**
 * Generates a random alphanumeric code
 * @param {number} length - The length of the code
 * @returns {string} A random alphanumeric code
 */
function generateRandomCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

module.exports = {
  isValidPhoneNumber,
  formatPhoneNumber,
  getTimeElapsed,
  isValidEmail,
  safeFilename,
  generateRandomCode
};