// admin.js - Admin routes
const express = require('express');
const router = express.Router();
const fileDb = require('../services/fileDb');
const votingService = require('../services/voting');
const authMiddleware = require('../middlewares/auth');
const security = require('../utils/security');

/**
 * Get dashboard data route
 */
router.get('/dashboard', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    // Get dashboard data
    const dashboardData = await votingService.getDashboardData();
    
    res.json(dashboardData);
  } catch (err) {
    console.error('Error in get dashboard data route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Start election route
 */
router.post('/election/start', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { duration } = req.body;
    let parsedDuration = null;
    
    // Parse duration if provided
    if (duration) {
      parsedDuration = parseInt(duration);
      
      if (isNaN(parsedDuration) || parsedDuration < 1) {
        return res.status(400).json({
          success: false,
          message: 'Duration must be a positive number (milliseconds)'
        });
      }
    }
    
    // Start election
    const result = await votingService.startElection(parsedDuration);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error in start election route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * End election route
 */
router.post('/election/stop', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    // End election
    const result = await votingService.endElection();
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    console.error('Error in end election route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get detailed results route
 */
router.get('/results', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    // Get detailed results
    const results = await votingService.getResults(true);
    
    res.json(results);
  } catch (err) {
    console.error('Error in admin results route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get all positions route
 */
router.get('/positions', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    // Get all positions
    const positions = await fileDb.read('positions');
    
    res.json({
      success: true,
      positions
    });
  } catch (err) {
    console.error('Error in get positions route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Create position route
 */
router.post('/positions', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Basic validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Position name is required'
      });
    }
    
    // Create position
    const now = Date.now();
    const positionRecord = {
      id: `position_${now}_${security.generateRandomCode(6)}`,
      name,
      description: description || '',
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    
    await fileDb.create('positions', positionRecord);
    
    res.json({
      success: true,
      message: 'Position created successfully',
      position: positionRecord
    });
  } catch (err) {
    console.error('Error in create position route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Update position route
 */
router.put('/positions/:id', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    
    // Find position
    const position = await fileDb.findBy('positions', 'id', id);
    
    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }
    
    // Update position
    const updates = {
      updatedAt: Date.now()
    };
    
    if (name !== undefined) {
      updates.name = name;
    }
    
    if (description !== undefined) {
      updates.description = description;
    }
    
    if (isActive !== undefined) {
      updates.isActive = isActive;
    }
    
    const updatedPosition = await fileDb.update('positions', 'id', id, updates);
    
    res.json({
      success: true,
      message: 'Position updated successfully',
      position: updatedPosition
    });
  } catch (err) {
    console.error('Error in update position route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Delete position route
 */
router.delete('/positions/:id', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find position
    const position = await fileDb.findBy('positions', 'id', id);
    
    if (!position) {
      return res.status(404).json({
        success: false,
        message: 'Position not found'
      });
    }
    
    // Check if any candidates are assigned to this position
    const candidates = await fileDb.read('candidates');
    const hasAssignedCandidates = candidates.some(candidate => candidate.positionId === id);
    
    if (hasAssignedCandidates) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete position with assigned candidates'
      });
    }
    
    // Delete position
    await fileDb.remove('positions', 'id', id);
    
    res.json({
      success: true,
      message: 'Position deleted successfully'
    });
  } catch (err) {
    console.error('Error in delete position route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get all candidates route
 */
router.get('/candidates', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    // Get all candidates
    const candidates = await fileDb.read('candidates');
    
    res.json({
      success: true,
      candidates
    });
  } catch (err) {
    console.error('Error in get candidates route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Create candidate route
 */
router.post('/candidates', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { name, positionId, info, photo } = req.body;
    
    // Basic validation
    if (!name || !positionId) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name and position ID are required'
      });
    }
    
    // Verify position exists
    const position = await fileDb.findBy('positions', 'id', positionId);
    
    if (!position) {
      return res.status(400).json({
        success: false,
        message: 'Invalid position ID'
      });
    }
    
    // Create candidate
    const now = Date.now();
    const candidateRecord = {
      id: `candidate_${now}_${security.generateRandomCode(6)}`,
      name,
      positionId,
      info: info || '',
      photo: photo || null,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    
    await fileDb.create('candidates', candidateRecord);
    
    res.json({
      success: true,
      message: 'Candidate created successfully',
      candidate: candidateRecord
    });
  } catch (err) {
    console.error('Error in create candidate route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Update candidate route
 */
router.put('/candidates/:id', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, info, photo, isActive, positionId } = req.body;
    
    // Find candidate
    const candidate = await fileDb.findBy('candidates', 'id', id);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }
    
    // Update candidate
    const updates = {
      updatedAt: Date.now()
    };
    
    if (name !== undefined) {
      updates.name = name;
    }
    
    if (info !== undefined) {
      updates.info = info;
    }
    
    if (photo !== undefined) {
      updates.photo = photo;
    }
    
    if (isActive !== undefined) {
      updates.isActive = isActive;
    }
    
    if (positionId !== undefined) {
      // Verify position exists
      const position = await fileDb.findBy('positions', 'id', positionId);
      
      if (!position) {
        return res.status(400).json({
          success: false,
          message: 'Invalid position ID'
        });
      }
      
      updates.positionId = positionId;
    }
    
    const updatedCandidate = await fileDb.update('candidates', 'id', id, updates);
    
    res.json({
      success: true,
      message: 'Candidate updated successfully',
      candidate: updatedCandidate
    });
  } catch (err) {
    console.error('Error in update candidate route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Delete candidate route
 */
router.delete('/candidates/:id', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find candidate
    const candidate = await fileDb.findBy('candidates', 'id', id);
    
    if (!candidate) {
      return res.status(404).json({
        success: false,
        message: 'Candidate not found'
      });
    }
    
    // Delete candidate
    await fileDb.remove('candidates', 'id', id);
    
    res.json({
      success: true,
      message: 'Candidate deleted successfully'
    });
  } catch (err) {
    console.error('Error in delete candidate route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Get all members route
 */
router.get('/members', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    // Get all members
    const members = await fileDb.read('members');
    
    // Remove sensitive information
    const sanitizedMembers = members.map(member => ({
      id: member.id,
      name: member.name,
      membershipNumber: member.membershipNumber,
      phoneNumber: member.phoneNumber,
      isEligible: member.isEligible,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt
    }));
    
    res.json({
      success: true,
      members: sanitizedMembers
    });
  } catch (err) {
    console.error('Error in get members route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Create member route
 */
router.post('/members', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { name, membershipNumber, phoneNumber, isEligible } = req.body;
    
    // Basic validation
    if (!name || !membershipNumber || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name, membership number, and phone number are required'
      });
    }
    
    // Check if membership number already exists
    const existingMember = await fileDb.findBy('members', 'membershipNumber', membershipNumber);
    
    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: 'A member with this membership number already exists'
      });
    }
    
    // Create member
    const now = Date.now();
    const memberRecord = {
      id: `member_${now}_${security.generateRandomCode(6)}`,
      name,
      membershipNumber,
      phoneNumber,
      isEligible: isEligible !== undefined ? isEligible : true,
      createdAt: now,
      updatedAt: now
    };
    
    await fileDb.create('members', memberRecord);
    
    res.json({
      success: true,
      message: 'Member created successfully',
      member: memberRecord
    });
  } catch (err) {
    console.error('Error in create member route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Update member route
 */
router.put('/members/:id', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, isEligible } = req.body;
    
    // Find member
    const member = await fileDb.findBy('members', 'id', id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    // Update member
    const updates = {
      updatedAt: Date.now()
    };
    
    if (name !== undefined) {
      updates.name = name;
    }
    
    if (phoneNumber !== undefined) {
      updates.phoneNumber = phoneNumber;
    }
    
    if (isEligible !== undefined) {
      updates.isEligible = isEligible;
    }
    
    const updatedMember = await fileDb.update('members', 'id', id, updates);
    
    res.json({
      success: true,
      message: 'Member updated successfully',
      member: updatedMember
    });
  } catch (err) {
    console.error('Error in update member route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * Delete member route
 */
router.delete('/members/:id', authMiddleware.authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find member
    const member = await fileDb.findBy('members', 'id', id);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member not found'
      });
    }
    
    // Check if member has already voted
    const vote = await fileDb.findBy('votes', 'memberId', id);
    
    if (vote) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a member who has already voted'
      });
    }
    
    // Delete member
    await fileDb.remove('members', 'id', id);
    
    res.json({
      success: true,
      message: 'Member deleted successfully'
    });
  } catch (err) {
    console.error('Error in delete member route:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;