// fileDb.js - File-based database operations
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const logger = require('../services/logger');

/**
 * Initialize the database by creating required files and directories
 * @returns {Promise} A promise that resolves when initialization is complete
 */
async function initializeDatabase() {
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir(path.dirname(config.dataFiles.members), { recursive: true });
    
    // Create empty files if they don't exist
    for (const [key, filePath] of Object.entries(config.dataFiles)) {
      try {
        await fs.access(filePath);
      } catch (err) {
        // File doesn't exist, create it with appropriate default content
        let defaultContent;
        
        if (key === 'electionStatus') {
          // Special case for election status - create with default object
          defaultContent = {
            isActive: false,
            startTime: null,
            endTime: null,
            duration: 24 * 60 * 60 * 1000 // 24 hours by default
          };
        } else {
          // For other files, create with empty array
          defaultContent = [];
        }
        
        await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2));
        logger.info(`Created empty file: ${filePath}`);
      }
    }
    
    return true;
  } catch (err) {
    logger.error('Error initializing database:', err);
    throw err;
  }
}

/**
 * Read all records from a data file
 * @param {string} entityType - The entity type (e.g., 'members', 'votes')
 * @returns {Promise<Array>} A promise that resolves with the records
 */
async function read(entityType) {
  try {
    const filePath = config.dataFiles[entityType];
    
    if (!filePath) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    // Read the file
    const data = await fs.readFile(filePath, 'utf8');
    
    // Parse and return the records
    return JSON.parse(data || '[]');
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist, return appropriate default
      if (entityType === 'electionStatus') {
        return {
          isActive: false,
          startTime: null,
          endTime: null,
          duration: 24 * 60 * 60 * 1000
        };
      }
      return [];
    }
    
    logger.error(`Error reading ${entityType}:`, err);
    throw err;
  }
}

/**
 * Write data to a file (overwrites existing content)
 * @param {string} entityType - The entity type (e.g., 'members', 'votes', 'electionStatus')
 * @param {*} data - The data to write (array for most entities, object for electionStatus)
 * @returns {Promise<*>} A promise that resolves with the written data
 */
async function write(entityType, data) {
  try {
    const filePath = config.dataFiles[entityType];
    
    if (!filePath) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    // Write the data to the file
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    
    return data;
  } catch (err) {
    logger.error(`Error writing ${entityType}:`, err);
    throw err;
  }
}

/**
 * Find a record by a specific field value
 * @param {string} entityType - The entity type (e.g., 'members', 'votes')
 * @param {string} field - The field to search by
 * @param {*} value - The value to search for
 * @returns {Promise<Object|null>} A promise that resolves with the record or null
 */
async function findBy(entityType, field, value) {
  try {
    const records = await read(entityType);
    
    // Handle case where records might be an object (like electionStatus)
    if (!Array.isArray(records)) {
      return records[field] === value ? records : null;
    }
    
    return records.find(record => record[field] === value) || null;
  } catch (err) {
    logger.error(`Error finding ${entityType} by ${field}:`, err);
    throw err;
  }
}

/**
 * Find all records matching a specific field value
 * @param {string} entityType - The entity type (e.g., 'members', 'votes')
 * @param {string} field - The field to search by
 * @param {*} value - The value to search for
 * @returns {Promise<Array>} A promise that resolves with matching records
 */
async function findAllBy(entityType, field, value) {
  try {
    const records = await read(entityType);
    
    // Handle case where records might be an object (like electionStatus)
    if (!Array.isArray(records)) {
      return records[field] === value ? [records] : [];
    }
    
    return records.filter(record => record[field] === value);
  } catch (err) {
    logger.error(`Error finding all ${entityType} by ${field}:`, err);
    throw err;
  }
}

/**
 * Create a new record
 * @param {string} entityType - The entity type (e.g., 'members', 'votes')
 * @param {Object} record - The record to create
 * @returns {Promise<Object>} A promise that resolves with the created record
 */
async function create(entityType, record) {
  try {
    const filePath = config.dataFiles[entityType];
    
    if (!filePath) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    // Read existing records
    const records = await read(entityType);
    
    // Ensure we're working with an array
    if (!Array.isArray(records)) {
      throw new Error(`Cannot create record in ${entityType}: not an array-based entity`);
    }
    
    // Add the new record
    records.push(record);
    
    // Write back to the file
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
    
    return record;
  } catch (err) {
    logger.error(`Error creating ${entityType}:`, err);
    throw err;
  }
}

/**
 * Update a record
 * @param {string} entityType - The entity type (e.g., 'members', 'votes')
 * @param {string} field - The field to find the record by
 * @param {*} value - The value to search for
 * @param {Object} updates - The updates to apply
 * @returns {Promise<Object|null>} A promise that resolves with the updated record or null
 */
async function update(entityType, field, value, updates) {
  try {
    const filePath = config.dataFiles[entityType];
    
    if (!filePath) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    // Read existing records
    const records = await read(entityType);
    
    // Handle case where records might be an object (like electionStatus)
    if (!Array.isArray(records)) {
      if (records[field] === value) {
        const updatedRecord = { ...records, ...updates };
        await fs.writeFile(filePath, JSON.stringify(updatedRecord, null, 2));
        return updatedRecord;
      }
      return null;
    }
    
    // Find the record index
    const index = records.findIndex(record => record[field] === value);
    
    if (index === -1) {
      return null;
    }
    
    // Apply updates
    records[index] = { ...records[index], ...updates };
    
    // Write back to the file
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
    
    return records[index];
  } catch (err) {
    logger.error(`Error updating ${entityType}:`, err);
    throw err;
  }
}

/**
 * Remove a record
 * @param {string} entityType - The entity type (e.g., 'members', 'votes')
 * @param {string} field - The field to find the record by
 * @param {*} value - The value to search for
 * @returns {Promise<boolean>} A promise that resolves with true if removed, false if not found
 */
async function remove(entityType, field, value) {
  try {
    const filePath = config.dataFiles[entityType];
    
    if (!filePath) {
      throw new Error(`Unknown entity type: ${entityType}`);
    }
    
    // Read existing records
    const records = await read(entityType);
    
    // Ensure we're working with an array
    if (!Array.isArray(records)) {
      throw new Error(`Cannot remove record from ${entityType}: not an array-based entity`);
    }
    
    // Find the record index
    const index = records.findIndex(record => record[field] === value);
    
    if (index === -1) {
      return false;
    }
    
    // Remove the record
    records.splice(index, 1);
    
    // Write back to the file
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
    
    return true;
  } catch (err) {
    logger.error(`Error removing ${entityType}:`, err);
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  read,
  write,
  findBy,
  findAllBy,
  create,
  update,
  remove
};