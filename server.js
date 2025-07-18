//server.js - Entry point for the secure voting application
const app = require('./app');
const logger = require('./services/logger');

// Set port from environment variable or default to 3000
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Visit http://localhost:${PORT} in your browser`);
});