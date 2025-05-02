// sms.js - SMS service for OTP delivery
const twilio = require('twilio');
const config = require('../config/config');

// Initialize Twilio client if credentials are provided
let twilioClient = null;

if (config.twilio.accountSid && config.twilio.authToken) {
  try {
    twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
    console.log("configured", twilioClient)
  } catch (error) {
    console.log("Error configuring twilio", error.message)
  }
  
  
}

/**
 * Sends an OTP via SMS
 * @param {string} phoneNumber - The phone number to send the OTP to
 * @param {string} otp - The OTP to send
 * @returns {Promise} A promise that resolves with the message SID if successful
 */
async function sendOTP(phoneNumber, otp) {
  // Check if Twilio is configured
  if (!twilioClient) {
    console.warn('Twilio not configured. Would send OTP:', otp, 'to:', phoneNumber);
    
    // For development/testing, return a mock successful response
    return {
      sid: 'DEV_MODE_' + Date.now(),
      status: 'delivered',
      to: phoneNumber
    };
  }
  
  try {
    // Format message
    const message = `ACM community code is: ${otp}. This code will expire in 10 minutes.`;
    
    // Send SMS via Twilio
    const result = await twilioClient.messages.create({
      body: message,
      to: phoneNumber,
      from: config.twilio.phoneNumber
    });
    
    console.log(`OTP sent to ${phoneNumber}, SID: ${result.sid}`);
    return result;
  } catch (err) {
    console.error('Error sending OTP via Twilio:', err);
    throw err;
  }
}

/**
 * Sends a notification message via SMS
 * @param {string} phoneNumber - The phone number to send the message to
 * @param {string} message - The message to send
 * @returns {Promise} A promise that resolves with the message SID if successful
 */
async function sendNotification(phoneNumber, message) {
  // Check if Twilio is configured
  if (!twilioClient) {
    console.warn('Twilio not configured. Would send notification:', message, 'to:', phoneNumber);
    
    // For development/testing, return a mock successful response
    return {
      sid: 'DEV_MODE_' + Date.now(),
      status: 'delivered',
      to: phoneNumber
    };
  }
  
  try {
    // Send SMS via Twilio
    const result = await twilioClient.messages.create({
      body: message,
      to: phoneNumber,
      from: config.twilio.phoneNumber
    });
    
    console.log(`Notification sent to ${phoneNumber}, SID: ${result.sid}`);
    return result;
  } catch (err) {
    console.error('Error sending notification via Twilio:', err);
    throw err;
  }
}

module.exports = {
  sendOTP,
  sendNotification
};