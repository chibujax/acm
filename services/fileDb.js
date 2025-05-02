// fileDb.js - File-based database operations
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');

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
        // File doesn't exist, create it with an empty array
        await fs.writeFile(filePath, JSON.stringify([]));
        console.log(`Created empty file: ${filePath}`);
      }
    }
    
    return true;
  } catch (err) {
    console.error('Error initializing database:', err);
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
      // File doesn't exist, return empty array
      return [];
    }
    
    console.error(`Error reading ${entityType}:`, err);
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
    return records.find(record => record[field] === value) || null;
  } catch (err) {
    console.error(`Error finding ${entityType} by ${field}:`, err);
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
    return records.filter(record => record[field] === value);
  } catch (err) {
    console.error(`Error finding all ${entityType} by ${field}:`, err);
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
    
    // Add the new record
    records.push(record);
    
    // Write back to the file
    await fs.writeFile(filePath, JSON.stringify(records, null, 2));
    
    return record;
  } catch (err) {
    console.error(`Error creating ${entityType}:`, err);
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
    console.error(`Error updating ${entityType}:`, err);
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
    console.error(`Error removing ${entityType}:`, err);
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  read,
  findBy,
  findAllBy,
  create,
  update,
  remove
};