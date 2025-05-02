// Voting interface functionality

// Handle the voting page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initVotingPage();
});

/**
 * Initialize the voting page functionality
 */
async function initVotingPage() {
  const votingForm = document.getElementById('votingForm');
  const positionsContainer = document.getElementById('positionsContainer');
  const memberNameElement = document.getElementById('memberName');
  const errorMessage = document.getElementById('errorMessage');
  const electionStatusContainer = document.getElementById('electionStatusContainer');
  const electionStatusMessage = document.getElementById('electionStatusMessage');
  const submitButtonContainer = document.getElementById('submitButtonContainer');
  
  try {
    // Fetch election status
    const electionStatusResponse = await fetch('/api/voting/status');
    const electionStatusData = await electionStatusResponse.json();
    
    if (!electionStatusResponse.ok) {
      throw new Error(electionStatusData.message || 'Failed to fetch election status');
    }
    
    // Fetch session info to verify user is logged in and get member name
    const sessionResponse = await fetch('/api/auth/session');
    const sessionData = await sessionResponse.json();
    
    if (!sessionResponse.ok) {
      // Not logged in or session expired
      showError('Your session has expired or you are not logged in. Redirecting to login page...');
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
      return;
    }
    
    // Display member name
    if (memberNameElement && sessionData.member && sessionData.member.name) {
      memberNameElement.textContent = sessionData.member.name;
    }
    
    // Check if member has already voted
    if (sessionData.hasVoted) {
      positionsContainer.innerHTML = `
        <div class="already-voted">
          <h3>You have already cast your vote</h3>
          <p>You can only vote once in this election.</p>
          <div class="action-buttons">
            <a href="/confirmation?voteId=${sessionData.voteId}" class="btn btn-primary">View Confirmation</a>
          </div>
        </div>
      `;
      
      // Hide submit button
      if (submitButtonContainer) {
        submitButtonContainer.style.display = 'none';
      }
      
      // Update status message
      if (electionStatusMessage) {
        electionStatusMessage.textContent = "Thank you for your participation.";
      }
      
      return;
    }
    
    // Check election status and update UI accordingly
    const status = electionStatusData.status || {};
    
    if (electionStatusContainer) {
      let statusHTML = '';
      
      if (!status.isActive) {
        if (status.endTime) {
          // Election has ended
          statusHTML = `
            <div class="status-ended">
              <h3>Election has ended</h3>
              <p>The voting period has concluded. Thank you for your interest.</p>
              <p>Election ended: ${new Date(status.endTime).toLocaleString()}</p>
            </div>
          `;
          
          // Hide submit button and display message instead of ballot
          if (submitButtonContainer) {
            submitButtonContainer.style.display = 'none';
          }
          
          positionsContainer.innerHTML = `
            <div class="election-ended">
              <p>The results will be announced soon.</p>
            </div>
          `;
          
          // Update status message
          if (electionStatusMessage) {
            electionStatusMessage.textContent = "This election has ended and is no longer accepting votes.";
          }
          
        } else {
          // Election has not started yet
          statusHTML = `
            <div class="status-not-started">
              <h3>Election has not started yet</h3>
              <p>The voting period has not begun. Please check back later.</p>
            </div>
          `;
          
          // Hide submit button and display message instead of ballot
          if (submitButtonContainer) {
            submitButtonContainer.style.display = 'none';
          }
          
          positionsContainer.innerHTML = `
            <div class="election-not-started">
              <p>The ballot will be available once the election begins.</p>
            </div>
          `;
          
          // Update status message
          if (electionStatusMessage) {
            electionStatusMessage.textContent = "This election has not started yet and is not accepting votes at this time.";
          }
        }
      } else {
        // Election is active
        statusHTML = `
          <div class="status-active">
            <h3>Election is in progress</h3>
            <p>Time remaining: ${status.timeRemaining || 'N/A'}</p>
            <p>Started: ${new Date(status.startTime).toLocaleString()}</p>
          </div>
        `;
        
        // Show submit button and load ballot
        if (submitButtonContainer) {
          submitButtonContainer.style.display = 'block';
        }
        // Load ballot data
        await loadBallot(positionsContainer);
      }
      
      electionStatusContainer.innerHTML = statusHTML;
    }
    
  } catch (error) {
    console.error('Error initializing voting page:', error);
    showError('Failed to load voting page. Please try refreshing the page.');
  }
  
  // Handle voting form submission - only if election is active
  if (votingForm) {
    votingForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Check election status one more time before submitting
      try {
        const checkStatusResponse = await fetch('/api/voting/status');
        const statusData = await checkStatusResponse.json();
        
        if (!checkStatusResponse.ok || !statusData.status.isActive) {
          showError('The election is no longer active. Your vote cannot be submitted.');
          return;
        }
        
        // Validate that all positions have a selection
        const positions = document.querySelectorAll('.position-section');
        let isValid = true;
        
        positions.forEach(position => {
          const positionId = position.dataset.positionId;
          const selectedCandidate = position.querySelector(`input[name="position_${positionId}"]:checked`);
          
          if (!selectedCandidate) {
            isValid = false;
            position.classList.add('error');
            const positionTitle = position.querySelector('.position-title');
            // Create or update the error message
            let errorEl = position.querySelector('.position-error');
            if (!errorEl) {
              errorEl = document.createElement('div');
              errorEl.className = 'position-error error-message';
              positionTitle.insertAdjacentElement('afterend', errorEl);
            }
            errorEl.textContent = 'Please select a candidate for this position';
          } else {
            position.classList.remove('error');
            const errorEl = position.querySelector('.position-error');
            if (errorEl) {
              errorEl.remove();
            }
          }
        });
        
        if (!isValid) {
          showError('Please select a candidate for each position before submitting.');
          return;
        }
        
        // Ask for confirmation
        const confirmVote = confirm('Are you sure you want to submit your vote? This action cannot be undone.');
        if (!confirmVote) {
          return;
        }
        
        // Display loading state
        const submitButton = votingForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'Submitting...';
        submitButton.disabled = true;
        
        // Collect vote data
        const voteData = {
          votes: {}
        };
        
        positions.forEach(position => {
          const positionId = position.dataset.positionId;
          const selectedCandidate = position.querySelector(`input[name="position_${positionId}"]:checked`);
          
          if (selectedCandidate) {
            voteData.votes[positionId] = selectedCandidate.value;
          }
        });
        
        // Submit vote
        const response = await fetch('/api/voting/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(voteData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to submit vote');
        }
        
        // Redirect to confirmation page
        window.location.href = `/confirmation?voteId=${data.voteId}`;
        
      } catch (error) {
        showError(error.message || 'An error occurred while submitting your vote. Please try again.');
        
        // Reset the button
        const submitButton = votingForm.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.textContent = 'Submit Vote';
          submitButton.disabled = false;
        }
      }
    });
  }
  
  // Set up periodic refresh of election status (every 60 seconds)
  setInterval(checkElectionStatus, 60000);
}

/**
 * Check the current election status and update UI accordingly
 */
async function checkElectionStatus() {
  try {
    const electionStatusResponse = await fetch('/api/voting/status');
    const electionStatusData = await electionStatusResponse.json();
    
    if (!electionStatusResponse.ok) {
      return; // Silently fail for periodic checks
    }
    
    const status = electionStatusData.status || {};
    const electionStatusContainer = document.getElementById('electionStatusContainer');
    
    // If the status changed from active to inactive, refresh the page
    if (!status.isActive && electionStatusContainer && 
        electionStatusContainer.querySelector('.status-active')) {
      window.location.reload();
      return;
    }
    
    // Just update the time remaining if still active
    if (status.isActive) {
      const timeRemainingElement = electionStatusContainer.querySelector('.status-active p:first-child');
      if (timeRemainingElement) {
        timeRemainingElement.textContent = `Time remaining: ${status.timeRemaining || 'N/A'}`;
      }
    }
  } catch (error) {
    console.error('Error checking election status:', error);
    // Don't show error to user for background checks
  }
}

/**
 * Load the ballot with positions and candidates
 * @param {HTMLElement} container - The container to load the ballot into
 */
async function loadBallot(container) {
  try {
    // Show loading state
    container.innerHTML = '<div class="loading-message">Loading ballot...</div>';
    // Fetch positions and candidates
    const response = await fetch('/api/voting/ballot');
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to load ballot');
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Check if there are any positions
    if (!data.positions || data.positions.length === 0) {
      container.innerHTML = '<div class="no-positions">No positions available for voting at this time.</div>';
      return;
    }
    
    // Get templates
    const positionTemplate = document.getElementById('positionTemplate');
    const candidateTemplate = document.getElementById('candidateTemplate');
    
    // Create position sections
    data.positions.forEach((position, index) => {
      // Clone position template
      const positionSection = positionTemplate.content.cloneNode(true);
      const positionElement = positionSection.querySelector('.position-section');
      const positionTitle = positionSection.querySelector('.position-title');
      const candidateList = positionSection.querySelector('.candidate-list');
      
      // Set position data
      positionElement.dataset.positionId = position.id;
      positionTitle.textContent = position.name;
      
      // Add custom class for alternating colors (though CSS :nth-child should handle this)
      positionElement.classList.add(index % 2 === 0 ? 'position-even' : 'position-odd');
      
      // Add candidates
      if (position.candidates && position.candidates.length > 0) {
        position.candidates.forEach(candidate => {
          // Clone candidate template
          const candidateCard = candidateTemplate.content.cloneNode(true);
          const candidateElement = candidateCard.querySelector('.candidate-card');
          const candidatePhoto = candidateCard.querySelector('.candidate-photo');
          const candidateName = candidateCard.querySelector('.candidate-name');
          const candidateInfo = candidateCard.querySelector('.candidate-info');
          const candidateInput = candidateCard.querySelector('input');
          
          // Set candidate data
          candidateElement.dataset.candidateId = candidate.id;
          candidatePhoto.src = candidate.photo ? '/images/' + candidate.photo : '/images/placeholder.png';
          candidatePhoto.alt = candidate.name;
          candidateName.textContent = candidate.name;
          candidateInfo.textContent = candidate.info || '';
          
          // Set input data
          candidateInput.name = `position_${position.id}`;
          candidateInput.value = candidate.id;
          
          // Add click event to select candidate
          candidateElement.addEventListener('click', function() {
            // Deselect all candidates in the same position
            const allCandidates = candidateList.querySelectorAll('.candidate-card');
            allCandidates.forEach(card => card.classList.remove('selected'));
            
            // Select this candidate
            this.classList.add('selected');
            this.querySelector('input').checked = true;
          });
          
          // Add to candidate list
          candidateList.appendChild(candidateCard);
        });
      } else {
        candidateList.innerHTML = '<div class="no-candidates">No candidates available for this position.</div>';
      }
      
      // Add to container
      container.appendChild(positionSection);
    });
    
  } catch (error) {
    console.error('Error loading ballot:', error);
    container.innerHTML = '<div class="error-message">Failed to load ballot. Please refresh the page.</div>';
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
    
    // Scroll to error message
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}