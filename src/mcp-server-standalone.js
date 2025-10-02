#!/usr/bin/env node

/**
 * Standalone TomTom MCP Server for Railway Deployment
 * This server runs independently and provides MCP tools for TomTom Maps API
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const MCPToolServer = require('./mcp-tool-server');

// Environment variables
const PORT = process.env.PORT || 3003;
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;

// Validate required environment variables
if (!TOMTOM_API_KEY) {
  console.error('❌ TOMTOM_API_KEY environment variable is required');
  process.exit(1);
}

console.log('=== TOMTOM MCP SERVER STARTUP ===');
console.log(`📍 TomTom API Key: ${TOMTOM_API_KEY ? 'Configured' : 'Missing'}`);
console.log(`🚀 Starting MCP Server on port ${PORT}`);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize MCP Tool Server
const mcpToolServer = new MCPToolServer();

// Extract the tool execution methods from the MCPToolServer class
const toolMethods = {
  'mcp://tomtom/search': mcpToolServer.searchPlaces.bind(mcpToolServer),
  'mcp://tomtom/geocode': mcpToolServer.geocodeAddress.bind(mcpToolServer),
  'mcp://tomtom/reverse-geocode': mcpToolServer.reverseGeocode.bind(mcpToolServer),
  'mcp://tomtom/directions': mcpToolServer.calculateRoute.bind(mcpToolServer),
  'mcp://tomtom/static-map': mcpToolServer.generateStaticMap.bind(mcpToolServer)
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'TomTom MCP Tool Server',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    protocol: 'MCP',
    tools: [
      'search',
      'geocode', 
      'reverse-geocode',
      'directions',
      'static-map'
    ],
    endpoints: {
      tools: 'GET /tools',
      execute: 'POST /tools/:toolName/execute',
      health: 'GET /'
    }
  });
});

// MCP Tools endpoint
app.get('/tools', (req, res) => {
  res.json([
    {
      name: 'search',
      description: 'Search for places using TomTom API',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          lat: { type: 'number', description: 'Latitude' },
          lon: { type: 'number', description: 'Longitude' },
          radius: { type: 'number', description: 'Search radius in meters', default: 5000 },
          limit: { type: 'number', description: 'Maximum number of results', default: 10 }
        },
        required: ['query', 'lat', 'lon']
      }
    },
    {
      name: 'geocode',
      description: 'Convert address to coordinates',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Address to geocode' },
          limit: { type: 'number', description: 'Maximum number of results', default: 1 }
        },
        required: ['address']
      }
    },
    {
      name: 'reverse-geocode',
      description: 'Convert coordinates to address',
      inputSchema: {
        type: 'object',
        properties: {
          lat: { type: 'number', description: 'Latitude' },
          lon: { type: 'number', description: 'Longitude' }
        },
        required: ['lat', 'lon']
      }
    },
    {
      name: 'directions',
      description: 'Get directions between two points',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Starting address or coordinates' },
          to: { type: 'string', description: 'Destination address or coordinates' },
          travelMode: { type: 'string', description: 'Travel mode', default: 'car' }
        },
        required: ['from', 'to']
      }
    },
    {
      name: 'static-map',
      description: 'Generate static map image',
      inputSchema: {
        type: 'object',
        properties: {
          center: { type: 'string', description: 'Center coordinates' },
          zoom: { type: 'number', description: 'Zoom level', default: 10 },
          width: { type: 'number', description: 'Image width', default: 400 },
          height: { type: 'number', description: 'Image height', default: 300 }
        },
        required: ['center']
      }
    }
  ]);
});

// MCP Tool execution endpoint
app.post('/tools/:toolName/execute', async (req, res) => {
  const { toolName } = req.params;
  const input = req.body;
  
  // Map simple tool names to full MCP tool names
  const toolNameMap = {
    'search': 'mcp://tomtom/search',
    'geocode': 'mcp://tomtom/geocode',
    'reverse-geocode': 'mcp://tomtom/reverse-geocode',
    'directions': 'mcp://tomtom/directions',
    'static-map': 'mcp://tomtom/static-map'
  };
  
  const fullToolName = toolNameMap[toolName] || toolName;
  
  try {
    console.log(`🔧 Executing MCP tool: ${toolName} (${fullToolName})`);
    console.log(`📥 Input:`, JSON.stringify(input, null, 2));
    
    // Get the appropriate method for this tool
    const toolMethod = toolMethods[fullToolName];
    if (!toolMethod) {
      throw new Error(`Unknown tool: ${fullToolName}`);
    }
    
    const result = await toolMethod(input);
    
    console.log(`✅ Tool execution successful`);
    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    console.error(`❌ Tool execution failed for ${toolName}:`, error.message);
    res.status(500).json({ 
      success: false,
      error: 'Tool execution failed', 
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TomTom MCP Server running on port ${PORT}`);
  console.log(`🌐 Health Check: http://localhost:${PORT}/`);
  console.log(`🔧 Tools Endpoint: http://localhost:${PORT}/tools`);
  console.log(`⚡ Execute Endpoint: http://localhost:${PORT}/tools/:toolName/execute`);
  console.log('=== MCP SERVER READY ===');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
