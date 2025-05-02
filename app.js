// app.js - Express application setup
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fileDb = require('./services/fileDb');
const security = require('./utils/security');

// Initialize express app
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Initialize the database
fileDb.initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

// Import routes
const authRoutes = require('./routes/auth');
const votingRoutes = require('./routes/voting');
const adminRoutes = require('./routes/admin');

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/admin', adminRoutes);

// Basic route for the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// Route for OTP verification page
app.get('/verify', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'verify.html'));
});

// Route for voting page (protected - will check in the frontend)
app.get('/voting', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'voting.html'));
});

// Route for confirmation page
app.get('/confirmation', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'confirmation.html'));
});

// Admin routes
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'login.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'dashboard.html'));
});

app.get('/admin/positions', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'positions.html'));
});

app.get('/admin/candidates', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'candidates.html'));
});

app.get('/admin/members', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'members.html'));
});

app.get('/admin/settings', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin', 'settings.html'));
});

// CSRF token middleware for forms
app.use((req, res, next) => {
  // Skip for GET requests and API routes
  if (req.method === 'GET' || req.path.startsWith('/api/')) {
    return next();
  }
  
  // Validate CSRF token
  if (!security.validateCSRF(req)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token'
    });
  }
  
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// 404 handler
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

// Export the app
module.exports = app;