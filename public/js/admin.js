// Admin dashboard functionality

// Handle the admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initAdminDashboard();
  });
  
  /**
   * Initialize the admin dashboard functionality
   */
  async function initAdminDashboard() {
    // Get dashboard elements
    const totalVotesElement = document.getElementById('totalVotes');
    const eligibleVotersElement = document.getElementById('eligibleVoters');
    const participationRateElement = document.getElementById('participationRate');
    const electionStatusElement = document.getElementById('electionStatus');
    const timeRemainingElement = document.getElementById('timeRemaining');
    const resultsContainer = document.getElementById('resultsContainer');
    const detailedResultsContainer = document.getElementById('detailedResults');
    
    // Get control buttons
    const startElectionBtn = document.getElementById('startElectionBtn');
    const stopElectionBtn = document.getElementById('stopElectionBtn');
    
    // Check admin session
    try {
      const sessionResponse = await fetch('/api/auth/admin/session');
      
      if (!sessionResponse.ok) {
        // Not logged in or not an admin
        window.location.href = '/admin/login';
        return;
      }
      
      const permissions = await checkAdminPermissions();
    
      // Show/hide election control buttons based on permissions
      if (startElectionBtn && stopElectionBtn) {
        if (!permissions.includes('manage_election')) {
          startElectionBtn.style.display = 'none';
          stopElectionBtn.style.display = 'none';
          
          // Add a message indicating limited permissions
          const controlsContainer = startElectionBtn.parentElement;
          const permissionMessage = document.createElement('p');
          permissionMessage.className = 'permission-message';
          permissionMessage.textContent = 'You do not have permission to start or end elections';
          controlsContainer.appendChild(permissionMessage);
        }
      }
      
      // Load dashboard data
      await loadDashboardData();
      
    } catch (error) {
      console.error('Error initializing admin dashboard:', error);
      showAdminMessage('Failed to load dashboard. Please refresh the page.', 'error');
    }
    
    // Set up event handlers for control buttons
    if (startElectionBtn) {
      startElectionBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to start the election?')) {
          try {
            // Show loading state
            startElectionBtn.disabled = true;
            startElectionBtn.textContent = 'Starting...';
            
            const response = await fetch('/api/admin/election/start', {
              method: 'POST'
            });
            
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.message || 'Failed to start election');
            }
            
            // Reload dashboard data
            await loadDashboardData();
            
            // Show success message
            showAdminMessage('Election started successfully', 'success');
            
            // Update button state - make these changes
            startElectionBtn.disabled = true;
            startElectionBtn.textContent = 'Election Started';
            
          } catch (error) {
            console.error('Error starting election:', error);
            showAdminMessage(error.message || 'Failed to start election', 'error');
            
            // Reset button
            startElectionBtn.disabled = false;
            startElectionBtn.textContent = 'Start Election';
          }
        }
      });
    }
    
    if (stopElectionBtn) {
      stopElectionBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to end the election? This will finalize all results.')) {
          try {
            // Show loading state
            stopElectionBtn.disabled = true;
            stopElectionBtn.textContent = 'Ending...';
            
            const response = await fetch('/api/admin/election/stop', {
              method: 'POST'
            });
            
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.message || 'Failed to end election');
            }
            
            // Reload dashboard data
            await loadDashboardData();
            
            // Show success message
            showAdminMessage('Election ended successfully', 'success');
            
          } catch (error) {
            console.error('Error ending election:', error);
            showAdminMessage(error.message || 'Failed to end election', 'error');
            
            // Reset button
            stopElectionBtn.disabled = false;
            stopElectionBtn.textContent = 'End Election';
          }
        }
      });
    }
    
    // Set up periodic refresh (every 30 seconds)
    setInterval(loadDashboardData, 30000);
    
    /**
     * Load dashboard data
     */
    async function loadDashboardData() {
      try {
        // Fetch dashboard data
        const response = await fetch('/api/admin/dashboard');
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to load dashboard data');
        }
        
        // Update summary stats
        if (totalVotesElement) {
          totalVotesElement.textContent = data.totalVotes || 0;
        }
        
        if (eligibleVotersElement) {
          eligibleVotersElement.textContent = data.eligibleVoters || 0;
        }
        
        if (participationRateElement) {
          const participationRate = data.eligibleVoters > 0 
            ? ((data.totalVotes / data.eligibleVoters) * 100).toFixed(1) 
            : 0;
          participationRateElement.textContent = `${participationRate}%`;
        }
        
        // Update election status
        if (electionStatusElement) {
          electionStatusElement.textContent = data.electionStatus || 'Not Started';
          
          // Style based on status
          if (data.electionStatus === 'In Progress') {
            electionStatusElement.style.color = '#2ecc71';
            startElectionBtn.disabled = true;
            startElectionBtn.textContent = 'Election In Progress'; // Change this line
            stopElectionBtn.disabled = false;
          } else if (data.electionStatus === 'Ended') {
            electionStatusElement.style.color = '#e74c3c';
            startElectionBtn.disabled = true;
            startElectionBtn.textContent = 'Start Election'; 
            stopElectionBtn.disabled = true;
          } else {
            electionStatusElement.style.color = '';
            startElectionBtn.disabled = false;
            startElectionBtn.textContent = 'Start Election';
            stopElectionBtn.disabled = true;
          }
        }
        
        // Update time remaining
        if (timeRemainingElement) {
          timeRemainingElement.textContent = data.timeRemaining || 'N/A';
        }
        
        // Update results
        if (resultsContainer && data.results) {
          if (data.electionStatus === 'Not Started') {
            resultsContainer.innerHTML = '<p>Results will be displayed once the election starts.</p>';
          } else {
            updateResults(data.results);
          }
        }
        
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Don't show error message here to avoid disrupting the user experience
        // during automatic refreshes
      }
    }
    
    /**
     * Update results display
     * @param {Object} results - The election results data
     */
    function updateResults(results) {
      if (!results || !resultsContainer || !detailedResultsContainer) {
        return;
      }
      
      // Clear containers
      resultsContainer.innerHTML = '';
      detailedResultsContainer.innerHTML = '';
      
      // Check if there are any results
      if (Object.keys(results).length === 0) {
        resultsContainer.innerHTML = '<p>No votes have been cast yet.</p>';
        return;
      }
      
      // Get templates
      const positionResultTemplate = document.getElementById('positionResultTemplate');
      const candidateResultTemplate = document.getElementById('candidateResultTemplate');
      
      // Process each position
      Object.keys(results).forEach(positionId => {
        const position = results[positionId];
        
        // Clone position template
        const positionResult = positionResultTemplate.content.cloneNode(true);
        const positionTitle = positionResult.querySelector('.position-title');
        const positionTable = positionResult.querySelector('tbody');
        
        // Set position name
        positionTitle.textContent = position.name;
        
        // Calculate total votes for this position
        let totalPositionVotes = 0;
        Object.values(position.candidates).forEach(candidate => {
          totalPositionVotes += candidate.votes;
        });
        
        // Add candidate results
        Object.values(position.candidates).forEach(candidate => {
          // Clone candidate template
          const candidateResult = candidateResultTemplate.content.cloneNode(true);
          const candidateName = candidateResult.querySelector('.candidate-name');
          const votesCount = candidateResult.querySelector('.votes-count');
          const votesPercentage = candidateResult.querySelector('.votes-percentage');
          
          // Set candidate data
          candidateName.textContent = candidate.name;
          votesCount.textContent = candidate.votes;
          
          // Calculate percentage
          const percentage = totalPositionVotes > 0 
            ? ((candidate.votes / totalPositionVotes) * 100).toFixed(1) 
            : 0;
          votesPercentage.textContent = `${percentage}%`;
          
          // Highlight winner if election has ended and there are votes
          if (position.status === 'Ended' && totalPositionVotes > 0 && candidate.isWinner) {
            candidateResult.querySelector('tr').classList.add('winner');
          }
          
          // Add to table
          positionTable.appendChild(candidateResult);
        });
        
        // Add to detailed results
        detailedResultsContainer.appendChild(positionResult);
        
        // Create simple summary for the results card
        const summarySectionTitle = document.createElement('h4');
        summarySectionTitle.textContent = position.name;
        
        const summaryList = document.createElement('ul');
        summaryList.className = 'result-summary-list';
        
        Object.values(position.candidates)
          .sort((a, b) => b.votes - a.votes) // Sort by votes descending
          .forEach(candidate => {
            const listItem = document.createElement('li');
            const percentage = totalPositionVotes > 0 
              ? ((candidate.votes / totalPositionVotes) * 100).toFixed(1) 
              : 0;
            
            listItem.textContent = `${candidate.name}: ${candidate.votes} votes (${percentage}%)`;
            
            if (candidate.isWinner) {
              listItem.classList.add('winner');
            }
            
            summaryList.appendChild(listItem);
          });
        
        resultsContainer.appendChild(summarySectionTitle);
        resultsContainer.appendChild(summaryList);
      });
    }
  }

  async function checkAdminPermissions() {
    try {
      // Fetch admin permissions
      const response = await fetch('/api/admin/permissions');
      
      if (!response.ok) {
        console.warn('Failed to fetch admin permissions');
        return []; // Return empty array instead of failing
      }
      
      const data = await response.json();
      return data.permissions || [];
    } catch (error) {
      console.warn('Error checking admin permissions:', error);
      return []; // Return empty array on error
    }
  }
  
  /**
   * Display a message in the admin dashboard
   * @param {string} message - The message to display
   * @param {string} type - The type of message ('error', 'success')
   */
  function showAdminMessage(message, type = 'info') {
    // Check if a message container already exists
    let messageContainer = document.querySelector('.admin-message');
    
    // Create one if it doesn't exist
    if (!messageContainer) {
      messageContainer = document.createElement('div');
      messageContainer.className = 'admin-message';
      document.querySelector('.admin-dashboard').insertAdjacentElement('beforebegin', messageContainer);
    }
    
    // Set message content and style
    messageContainer.textContent = message;
    messageContainer.className = `admin-message ${type}`;
    
    // Show the message
    messageContainer.style.display = 'block';
    
    // Automatically hide after 5 seconds
    setTimeout(() => {
      messageContainer.style.display = 'none';
    }, 5000);
  }

  // Add this to the end of admin.js or include directly in your admin pages
document.addEventListener('DOMContentLoaded', function() {
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function() {
      try {
        // Send logout request
        const response = await fetch('/api/auth/admin/logout', {
          method: 'POST'
        });
        
        if (response.ok) {
          // Redirect to login page
          window.location.href = '/admin/login';
        } else {
          console.error('Logout failed');
        }
      } catch (error) {
        console.error('Error logging out:', error);
      }
    });
  }
});