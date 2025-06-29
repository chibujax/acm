// voting.js - Voting business logic
const fileDb = require('./fileDb');
const security = require('../utils/security');
const helpers = require('../utils/helpers');
const logger = require('../services/logger');

// Default election status structure
const defaultElectionStatus = {
  isActive: false,
  startTime: null,
  endTime: null,
  duration: 24 * 60 * 60 * 1000, // 24 hours by default
};

/**
 * Load election status from file
 * @returns {Object} The election status
 */
async function loadElectionStatus() {
  try {
    const statusArray = await fileDb.read('electionStatus');
    
    // If file is empty or doesn't contain valid data, return default
    if (!statusArray || statusArray.length === 0) {
      return { ...defaultElectionStatus };
    }
    
    // Return the first (and should be only) status record
    const status = statusArray[0];
    
    // Ensure all required fields exist with defaults
    return {
      isActive: status.isActive || false,
      startTime: status.startTime || null,
      endTime: status.endTime || null,
      duration: status.duration || 24 * 60 * 60 * 1000
    };
  } catch (err) {
    logger.error('Error loading election status:', err);
    return { ...defaultElectionStatus };
  }
}

/**
 * Save election status to file
 * @param {Object} status - The election status to save
 * @returns {boolean} True if successful
 */
async function saveElectionStatus(newStatus, oldStatus) {
  try {
    // Save as an array with a single object (consistent with other data files)
    await fileDb.update('electionStatus', 'duration', oldStatus.duration, newStatus);
    return true;
  } catch (err) {
    logger.error('Error saving election status:', err);
    
    // If update fails (file might not exist), try creating it
    try {
      const fs = require('fs').promises;
      const config = require('../config/config');
      await fs.writeFile(config.dataFiles.electionStatus, JSON.stringify([newStatus], null, 2));
      return true;
    } catch (createErr) {
      logger.error('Error creating election status file:', createErr);
      return false;
    }
  }
}

/**
 * Get the current ballot
 * @returns {Object} The ballot with positions and candidates
 */
async function getBallot() {
  try {
    // Get all positions
    const positions = await fileDb.read('positions');
    
    if (!positions || positions.length === 0) {
      return {
        success: true,
        positions: []
      };
    }
    
    // Get all candidates
    const candidates = await fileDb.read('candidates');
    
    // Build the ballot
    const ballot = positions
      .filter(position => position.isActive) // Only include active positions
      .map(position => {
        // Find candidates for this position
        const positionCandidates = candidates
          .filter(candidate => candidate.positionId === position.id && candidate.isActive)
          .map(candidate => ({
            id: candidate.id,
            name: candidate.name,
            photo: candidate.photo,
            info: candidate.info
          }));
        
        return {
          id: position.id,
          name: position.name,
          description: position.description,
          candidates: positionCandidates
        };
      });
    
    return {
      success: true,
      positions: ballot
    };
  } catch (err) {
    logger.error('Error getting ballot:', err);
    throw err;
  }
}

/**
 * Submit a vote
 * @param {string} memberId - The ID of the member voting
 * @param {Object} votes - The votes being cast, keyed by position ID
 * @returns {Object} Result indicating success or failure
 */
async function submitVote(memberId, votes) {
  try {
    // Get current election status
    const electionStatus = await loadElectionStatus();
    
    // Check if election is active
    if (!electionStatus.isActive) {
      return {
        success: false,
        message: 'Voting is not currently active'
      };
    }
    
    // Check if member has already voted
    const existingVote = await fileDb.findBy('votes', 'memberId', memberId);
    
    if (existingVote) {
      return {
        success: false,
        message: 'You have already cast your vote in this election',
        voteId: existingVote.id
      };
    }
    
    // Validate votes against positions
    const positions = await fileDb.read('positions');
    const activePositionIds = positions
      .filter(position => position.isActive)
      .map(position => position.id.toString()); // Convert to string for consistent comparison
    
    // Check that votes are only for active positions
    for (const positionId of Object.keys(votes)) {
      if (!activePositionIds.includes(positionId.toString())) { // Compare as strings
        return {
          success: false,
          message: `Invalid position ID: ${positionId}`
        };
      }
    }
    
    // Validate that votes are for valid candidates
    const candidates = await fileDb.read('candidates');
    
    for (const [positionId, candidateId] of Object.entries(votes)) {
      // Ensure consistent type comparison for IDs
      const validCandidate = candidates.find(
        candidate => 
          candidate.id.toString() === candidateId.toString() && 
          candidate.positionId.toString() === positionId.toString() &&
          candidate.isActive
      );
      
      if (!validCandidate) {
        return {
          success: false,
          message: `Invalid candidate ID for position ${positionId}`
        };
      }
    }
    
    // Everything is valid, create the vote record
    const now = Date.now();
    const voteId = `vote_${now}_${helpers.generateRandomCode(8)}`;
    
    // Create anonymized record
    const voteRecord = {
      id: voteId,
      memberId,
      timestamp: now,
      votes: votes
    };
    
    // Save vote
    await fileDb.create('votes', voteRecord);
    
    return {
      success: true,
      message: 'Vote submitted successfully',
      voteId
    };
  } catch (err) {
    logger.error('Error submitting vote:', err);
    throw err;
  }
}

/**
 * Get election results
 * @param {boolean} detailed - Whether to include detailed results
 * @returns {Object} The election results
 */
async function getResults(detailed = false) {
  try {
    // Get current election status
    const electionStatus = await loadElectionStatus();
    
    // Get positions, candidates, and votes
    const positions = await fileDb.read('positions');
    const candidates = await fileDb.read('candidates');
    const votes = await fileDb.read('votes');
    
    // Initialize results object
    const results = {};
    
    // Process each position
    for (const position of positions) {
      if (!position.isActive) {
        continue; // Skip inactive positions
      }
      
      // Get candidates for this position
      const positionCandidates = candidates
        .filter(candidate => candidate.positionId === position.id && candidate.isActive)
        .reduce((acc, candidate) => {
          acc[candidate.id] = {
            id: candidate.id,
            name: candidate.name,
            votes: 0,
            isWinner: false
          };
          return acc;
        }, {});
      
      // Count votes for each candidate
      for (const vote of votes) {
        const candidateId = vote.votes[position.id];
        
        if (candidateId && positionCandidates[candidateId]) {
          positionCandidates[candidateId].votes++;
        }
      }
      
      // Determine winner if election has ended
      if (!electionStatus.isActive && electionStatus.endTime) {
        // Find candidate with most votes
        let maxVotes = 0;
        let winnerIds = [];
        
        for (const candidateId in positionCandidates) {
          const candidate = positionCandidates[candidateId];
          
          if (candidate.votes > maxVotes) {
            maxVotes = candidate.votes;
            winnerIds = [candidateId];
          } else if (candidate.votes === maxVotes && maxVotes > 0) {
            // Tie
            winnerIds.push(candidateId);
          }
        }
        
        // Mark winners
        for (const winnerId of winnerIds) {
          positionCandidates[winnerId].isWinner = true;
        }
      }
      
      // Add to results
      results[position.id] = {
        id: position.id,
        name: position.name,
        status: electionStatus.isActive ? 'In Progress' : (electionStatus.endTime ? 'Ended' : 'Not Started'),
        candidates: positionCandidates
      };
    }
    
    return {
      success: true,
      results,
      electionStatus: {
        isActive: electionStatus.isActive,
        startTime: electionStatus.startTime,
        endTime: electionStatus.endTime
      }
    };
  } catch (err) {
    logger.error('Error getting results:', err);
    throw err;
  }
}

/**
 * Start the election
 * @param {number} duration - Optional duration in milliseconds
 * @returns {Object} Result indicating success or failure
 */
async function startElection(duration) {
  try {
    // Get current election status
    const electionStatus = await loadElectionStatus();
    
    // Check if election is already active
    if (electionStatus.isActive) {
      return {
        success: false,
        message: 'Election is already in progress'
      };
    }
    
    // Set election status
    const now = Date.now();
    const newStatus = {
      isActive: true,
      startTime: now,
      endTime: null,
      duration: electionStatus.duration || (24 * 60 * 60 * 1000)
    };

    // Save to file
    await saveElectionStatus(newStatus, electionStatus);
    
    return {
      success: true,
      message: 'Election started successfully',
      electionStatus: newStatus
    };
  } catch (err) {
    logger.error('Error starting election:', err);
    throw err;
  }
}

/**
 * End the election
 * @returns {Object} Result indicating success or failure
 */
async function endElection() {
  try {
    // Get current election status
    const electionStatus = await loadElectionStatus();
    
    // Check if election is active
    if (!electionStatus.isActive) {
      return {
        success: false,
        message: 'No active election to end'
      };
    }
    
    // Set election status
    const now = Date.now();
    const newStatus = {
      ...electionStatus,
      isActive: false,
      endTime: now
    };

    // Save to file
    await saveElectionStatus(newStatus, electionStatus);
    
    return {
      success: true,
      message: 'Election ended successfully',
      electionStatus: newStatus
    };
  } catch (err) {
    logger.error('Error ending election:', err);
    throw err;
  }
}

/**
 * Get election status
 * @returns {Object} The current election status
 */
async function getElectionStatus() {
  try {
    // Load current status from file
    const electionStatus = await loadElectionStatus();
    
    // Calculate time remaining if election is active
    let timeRemaining = null;
    
    if (electionStatus.isActive && electionStatus.startTime) {
      const now = Date.now();
      const endTime = electionStatus.startTime + electionStatus.duration;
      const remaining = endTime - now;
      
      if (remaining <= 0) {
        // Election should be ended automatically
        const newStatus = {
          ...electionStatus,
          isActive: false,
          endTime: now
        };
        
        // Save the updated status
        await saveElectionStatus(newStatus, electionStatus);
        
        timeRemaining = '0h 0m';
        
        return {
          isActive: false,
          startTime: electionStatus.startTime,
          endTime: now,
          timeRemaining
        };
      } else {
        // Format time remaining
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
        timeRemaining = `${hours}h ${minutes}m`;
      }
    }
    
    return {
      isActive: electionStatus.isActive,
      startTime: electionStatus.startTime,
      endTime: electionStatus.endTime,
      timeRemaining
    };
  } catch (err) {
    logger.error('Error getting election status:', err);
    // Return default status on error
    return {
      isActive: false,
      startTime: null,
      endTime: null,
      timeRemaining: null
    };
  }
}

/**
 * Get dashboard data for admin
 * @returns {Object} Dashboard data
 */
async function getDashboardData() {
  try {
    // Get members, votes, and results
    const members = await fileDb.read('members');
    const votes = await fileDb.read('votes');
    const resultsData = await getResults(true);
    
    // Calculate stats
    // Use the total member count as eligible voters
    const eligibleVoters = members.length;
    const totalVotes = votes.length;
    
    // Get election status info
    const status = await getElectionStatus();
    
    return {
      success: true,
      totalVotes,
      eligibleVoters,
      electionStatus: status.isActive ? 'In Progress' : (status.endTime ? 'Ended' : 'Not Started'),
      timeRemaining: status.timeRemaining,
      startTime: status.startTime,
      endTime: status.endTime,
      results: resultsData.results
    };
  } catch (err) {
    logger.error('Error getting dashboard data:', err);
    throw err;
  }
}

module.exports = {
  getBallot,
  submitVote,
  getResults,
  startElection,
  endElection,
  getElectionStatus,
  getDashboardData
};