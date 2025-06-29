// services/simpleLogger.js - Simple file-based logging without console override
const fs = require('fs').promises;
const path = require('path');

class SimpleLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, that's okay
    }
  }

  formatLogEntry(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid
    };
    return JSON.stringify(logEntry) + '\n';
  }

  async writeToFile(filename, content) {
    try {
      const filePath = path.join(this.logDir, filename);
      await fs.appendFile(filePath, content);
    } catch (err) {
      // Silent fail to prevent any recursion issues
    }
  }

  async log(level, message = '', data = '') {
    const logEntry = this.formatLogEntry(level, message, data);
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `app-${date}.log`;
    
    // Write to file
    await this.writeToFile(filename, logEntry);
    
    // Also log to console (original methods, not overridden)
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn
    };
    
    if (level === 'error') {
      originalConsole.error(`[${level.toUpperCase()}] ${message}`, data || '');
      // Also write to separate error log
      const errorFilename = `error-${date}.log`;
      await this.writeToFile(errorFilename, logEntry);
    } else if (level === 'warn') {
      originalConsole.warn(`[${level.toUpperCase()}] ${message}`, data || '');
    } else if (level === 'info') {
      originalConsole.warn(`[${level.toUpperCase()}] ${message}`, data || '');
    } else {
      originalConsole.log(`[INFO] ${level} ${message}`, data || '');
    }
  }

  async info(message, data = null) {
    await this.log('info', message, data);
  }

  async error(message, data = null) {
    await this.log('error', message, data);
  }

  async warn(message, data = null) {
    await this.log('warn', message, data);
  }

  async debug(message, data = null) {
    if (process.env.NODE_ENV !== 'production') {
      await this.log('debug', message, data);
    }
  }

  // Method to get recent logs (for admin viewing)
  async getRecentLogs(days = 7) {
    try {
      const logs = [];
      const now = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const filename = `app-${dateStr}.log`;
        const filePath = path.join(this.logDir, filename);
        
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.trim().split('\n').filter(line => line);
          
          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line);
              logs.push(logEntry);
            } catch (parseErr) {
              // Skip malformed log entries
            }
          }
        } catch (fileErr) {
          // File doesn't exist for this date, skip
        }
      }
      
      // Sort by timestamp, newest first
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (err) {
      return [];
    }
  }

  // Method to clean old logs
  async cleanOldLogs(maxDays = 30) {
    try {
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxDays);
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          // Extract date from filename (app-YYYY-MM-DD.log or error-YYYY-MM-DD.log)
          const match = file.match(/(\d{4}-\d{2}-\d{2})\.log$/);
          if (match) {
            const fileDate = new Date(match[1]);
            if (fileDate < cutoffDate) {
              const filePath = path.join(this.logDir, file);
              await fs.unlink(filePath);
              console.log(`Deleted old log file: ${file}`);
            }
          }
        }
      }
    } catch (err) {
      // Silent fail
    }
  }
}

// Create and export a singleton instance
const logger = new SimpleLogger();

module.exports = logger;