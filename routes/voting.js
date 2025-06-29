// voting.js - Voting routes
const express = require('express');
const router = express.Router();
const votingService = require('../services/voting');
const authMiddleware = require('../middlewares/auth');
const logger = require('../services/logger');

/**
 * Get ballot route - Returns positions and candidates
 */
router.get('/ballot', authMiddleware.authenticateUser, async (req, res) => {
  try {
    // Check if election is active
    const status = await votingService.getElectionStatus();
    
    if (!status.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Voting is not currently active'
      });
    }
    
    // Get ballot data
    const ballot = await votingService.getBallot();
    
    res.json(ballot);
  } catch (err) {
    logger.error('Error in get ballot route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Submit vote route
 */
router.post('/submit', [
  authMiddleware.authenticateUser,
  authMiddleware.checkVotingEligibility
], async (req, res) => {
  try {
    // Check if election is active
    const status = await votingService.getElectionStatus();
    
    if (!status.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Voting is not currently active'
      });
    }
    
    const { votes } = req.body;
    
    // Basic validation
    if (!votes || Object.keys(votes).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No votes submitted'
      });
    }
    
    // Submit vote
    const result = await votingService.submitVote(req.session.member.id, votes);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    logger.error('Error in submit vote route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get public results route - Returns anonymized results
 * Only accessible if election is over or admin has enabled public results
 */
router.get('/results', async (req, res) => {
  try {
    // Get election status
    const status = await votingService.getElectionStatus();
    
    // Only allow access if election is ended
    if (!status.endTime) {
      return res.status(403).json({
        success: false,
        message: 'Results are not available until the election has ended'
      });
    }
    
    // Get results (non-detailed)
    const results = await votingService.getResults(false);
    
    res.json(results);
  } catch (err) {
    logger.error('Error in public results route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get election status route
 */
router.get('/status', async (req, res) => {
  try {
    const status = await votingService.getElectionStatus();
    
    // Format start and end times if they exist
    const formattedStatus = {
      isActive: status.isActive,
      startTime: status.startTime,
      endTime: status.endTime,
      timeRemaining: status.timeRemaining,
    };
    
    res.json({
      success: true,
      status: formattedStatus
    });
  } catch (err) {
    logger.error('Error in election status route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;