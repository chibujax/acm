// Authentication functionality for the voting system

// Handle the current page functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname;
    
    if (currentPath === '/') {
      initLoginPage();
    } else if (currentPath === '/verify') {
      initVerifyPage();
    }
  });
  
  /**
   * Initialize the login page functionality
   */
  function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loginForm) {
      loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear any previous error messages
        errorMessage.textContent = '';
        
        // Get form values
        //const membershipNumber = document.getElementById('membershipNumber').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        
        // Basic validation
        if (!phoneNumber) {
          showError('Please enter both membership number and phone number');
          return;
        }
        
        // Display loading state
        const submitButton = loginForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Sending...';
        submitButton.disabled = true;
        
        try {
          // Send login request
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phoneNumber
            })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.message || 'Failed to send verification code');
          }
          
          // Redirect to verification page
          window.location.href = `/verify?phone=${encodeURIComponent(phoneNumber)}`;
          
        } catch (error) {
          showError(error.message || 'An error occurred. Please try again later.');
          
          // Reset the button
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
        }
      });
    }
  }
  
  /**
   * Initialize the verification page functionality
   */
  function initVerifyPage() {
    const verifyForm = document.getElementById('verifyForm');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const otpInputs = document.querySelectorAll('.otp-input');
    const completeOtpInput = document.getElementById('completeOtp');
    const resendBtn = document.getElementById('resendBtn');
    const resendCountdownElement = document.getElementById('resendCountdown');
    const otpTimerElement = document.getElementById('otpTimer');
    
    // Get phone from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const phoneNumber = urlParams.get('phone');
    
    if (!phoneNumber) {
      showError('Invalid verification request. Please start again.');
      return;
    }
    
    // Handle OTP input functionality
    if (otpInputs && otpInputs.length) {
      otpInputs.forEach(function(input, index) {
        // Auto-focus next input when a digit is entered
        input.addEventListener('input', function() {
          if (this.value.length >= 1) {
            // Update value to only keep first character and ensure it's a number
            this.value = this.value.substr(0, 1).replace(/[^0-9]/g, '');
            
            // Focus next input if available
            if (index < otpInputs.length - 1) {
              otpInputs[index + 1].focus();
            }
            
            // Update the combined OTP value
            updateCompleteOtp();
          }
        });
        
        // Handle backspace to go back to previous input
        input.addEventListener('keydown', function(e) {
          if (e.key === 'Backspace' && this.value === '' && index > 0) {
            otpInputs[index - 1].focus();
          }
        });
      });
    }
    
    // Initialize OTP expiry timer (10 minutes)
    let otpExpiryTime = 10 * 60; // 10 minutes in seconds
    const otpTimer = setInterval(function() {
      otpExpiryTime--;
      
      if (otpExpiryTime <= 0) {
        clearInterval(otpTimer);
        otpTimerElement.textContent = 'Code expired. Please request a new one.';
        otpTimerElement.style.color = '#e74c3c';
      } else {
        const minutes = Math.floor(otpExpiryTime / 60);
        const seconds = otpExpiryTime % 60;
        otpTimerElement.textContent = `Code expires in: ${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    }, 1000);
    
    // Initialize resend countdown (60 seconds)
    let resendCountdown = 60;
    const resendTimer = setInterval(function() {
      resendCountdown--;
      
      if (resendCountdown <= 0) {
        clearInterval(resendTimer);
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend Code';
      } else {
        resendCountdownElement.textContent = resendCountdown;
      }
    }, 1000);
    
    // Handle resend button click
    if (resendBtn) {
      resendBtn.addEventListener('click', async function() {
        if (!this.disabled) {
          try {
            // Display loading state
            const originalButtonText = resendBtn.textContent;
            resendBtn.textContent = 'Sending...';
            resendBtn.disabled = true;
            
            // Send request to resend OTP
            const response = await fetch('/api/auth/resend-otp', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ phoneNumber })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
              throw new Error(data.message || 'Failed to resend verification code');
            }
            
            // Reset countdown
            resendCountdown = 60;
            resendBtn.textContent = `Resend Code (${resendCountdown}s)`;
            
            // Reset OTP expiry timer
            otpExpiryTime = 10 * 60;
            otpTimerElement.textContent = `Code expires in: 10:00`;
            otpTimerElement.style.color = '';
            
            // Start the countdown again
            const newResendTimer = setInterval(function() {
              resendCountdown--;
              
              if (resendCountdown <= 0) {
                clearInterval(newResendTimer);
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend Code';
              } else {
                resendBtn.textContent = `Resend Code (${resendCountdown}s)`;
              }
            }, 1000);
            
            // Show success message
            showSuccess('New verification code sent to your phone');
            
            // Clear current OTP inputs
            otpInputs.forEach(input => {
              input.value = '';
            });
            otpInputs[0].focus();
            
          } catch (error) {
            showError(error.message || 'Failed to resend code. Please try again.');
            resendBtn.textContent = 'Resend Code';
            resendBtn.disabled = false;
          }
        }
      });
    }
    
    // Handle verify form submission
    if (verifyForm) {
      verifyForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Clear any previous messages
        errorMessage.textContent = '';
        successMessage.textContent = '';
        
        // Get the complete OTP
        const otp = completeOtpInput.value;
        
        // Basic validation
        if (!otp || otp.length !== 6) {
          showError('Please enter the complete 6-digit verification code');
          return;
        }
        
        // Display loading state
        const submitButton = verifyForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Verifying...';
        submitButton.disabled = true;
        
        try {
          // Send verification request
          const response = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              phoneNumber,
              otp
            })
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.message || 'Verification failed');
          }
          
          // Show success message
          showSuccess('Verification successful! Redirecting to voting page...');
          
          // Redirect to voting page after a short delay
          setTimeout(function() {
            window.location.href = '/voting';
          }, 1500);
          
        } catch (error) {
          showError(error.message || 'Verification failed. Please try again.');
          
          // Reset the button
          submitButton.textContent = originalButtonText;
          submitButton.disabled = false;
        }
      });
    }
  }
  
  /**
   * Combines individual OTP inputs into a single value
   */
  function updateCompleteOtp() {
    const otpInputs = document.querySelectorAll('.otp-input');
    const completeOtpInput = document.getElementById('completeOtp');
    
    if (otpInputs && completeOtpInput) {
      let otpValue = '';
      
      otpInputs.forEach(function(input) {
        otpValue += input.value;
      });
      
      completeOtpInput.value = otpValue;
    }
  }
  
  /**
   * Display an error message
   * @param {string} message - The error message to display
   */
  function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorMessage) {
      errorMessage.textContent = message;
      errorMessage.style.display = 'block';
    }
  }
  
  /**
   * Display a success message
   * @param {string} message - The success message to display
   */
  function showSuccess(message) {
    const successMessage = document.getElementById('successMessage');
    
    if (successMessage) {
      successMessage.textContent = message;
      successMessage.style.display = 'block';
    }
  }