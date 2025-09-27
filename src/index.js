// src/index.js
const express = require('express');
const bodyParser = require('body-parser');
const tomtomMapsRouter = require('./tomtom-maps');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// CORS handling
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'POST, GET');
    return res.status(200).json({});
  }
  next();
});

// Routes
app.use('/api/tomtom', tomtomMapsRouter);

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'TomTom Maps MCP Server',
    endpoints: [
      '/api/tomtom/search',
      '/api/tomtom/geocode',
      '/api/tomtom/reversegeocode',
      '/api/tomtom/directions',
      '/api/tomtom/staticmap',
      '/api/tomtom/matrix'
    ]
  });
});

// Start server
app.listen(port, () => {
  console.log(`TomTom Maps MCP Server listening at http://localhost:${port}`);
});