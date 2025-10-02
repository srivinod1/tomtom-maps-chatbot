#!/usr/bin/env node

/**
 * MCP Bridge Server for Mistral Le Chat
 * This creates a bridge that can run the MCP server and expose it via HTTP
 * for Railway deployment while maintaining MCP compatibility
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
require('dotenv').config();

class MistralMCPBridge {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3003;
    this.tomtomApiKey = process.env.TOMTOM_API_KEY;
    this.mcpServerProcess = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.startMCPServer();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  startMCPServer() {
    // Start the MCP server as a subprocess
    const mcpServerPath = path.join(__dirname, 'mistral-mcp-server.js');
    
    this.mcpServerProcess = spawn('node', [mcpServerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.mcpServerProcess.stdout.on('data', (data) => {
      console.log('MCP Server stdout:', data.toString());
    });

    this.mcpServerProcess.stderr.on('data', (data) => {
      console.log('MCP Server stderr:', data.toString());
    });

    this.mcpServerProcess.on('close', (code) => {
      console.log(`MCP Server process exited with code ${code}`);
    });

    console.log('🚀 MCP Server subprocess started');
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'TomTom MCP Bridge for Mistral Le Chat',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        protocol: 'MCP Bridge',
        provider: 'Mistral Le Chat',
        mcpServerRunning: this.mcpServerProcess && !this.mcpServerProcess.killed,
        tools: [
          'search_places',
          'geocode_address',
          'reverse_geocode',
          'get_directions',
          'generate_static_map'
        ],
        endpoints: {
          health: 'GET /',
          mcpInfo: 'GET /mcp-info',
          test: 'GET /test',
          download: 'GET /download-mcp-server'
        }
      });
    });

    // MCP Info endpoint
    this.app.get('/mcp-info', (req, res) => {
      res.json({
        mcpVersion: '1.0.0',
        server: {
          name: 'tomtom-maps-server',
          version: '1.0.0'
        },
        capabilities: {
          tools: {}
        },
        tools: [
          {
            name: 'search_places',
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
            name: 'geocode_address',
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
            name: 'reverse_geocode',
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
            name: 'get_directions',
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
            name: 'generate_static_map',
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
        ],
        installation: {
          type: 'local',
          command: 'node',
          args: ['src/mistral-mcp-server.js'],
          description: 'Download and run locally for Mistral Le Chat'
        }
      });
    });

    // Download endpoint for the MCP server
    this.app.get('/download-mcp-server', (req, res) => {
      const fs = require('fs');
      const mcpServerPath = path.join(__dirname, 'mistral-mcp-server.js');
      
      if (fs.existsSync(mcpServerPath)) {
        res.download(mcpServerPath, 'mistral-mcp-server.js');
      } else {
        res.status(404).json({ error: 'MCP server file not found' });
      }
    });

    // Test endpoint
    this.app.get('/test', async (req, res) => {
      try {
        const url = `https://api.tomtom.com/search/2/search/Amsterdam.json`;
        const params = {
          key: this.tomtomApiKey,
          limit: 1
        };

        const response = await axios.get(url, { params });
        
        res.json({
          success: true,
          message: 'TomTom API connection successful',
          mcpServerRunning: this.mcpServerProcess && !this.mcpServerProcess.killed,
          data: response.data
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'TomTom API connection failed',
          error: error.message
        });
      }
    });

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      console.error('❌ Server error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    });
  }

  start() {
    this.app.listen(this.port, () => {
      console.log('=== MISTRAL LE CHAT MCP BRIDGE ===');
      console.log(`📍 TomTom API Key: ${this.tomtomApiKey ? 'Configured' : 'Missing'}`);
      console.log(`🚀 Starting MCP Bridge on port ${this.port}`);
      console.log(`🌐 Health Check: http://localhost:${this.port}/`);
      console.log(`🔧 MCP Info: http://localhost:${this.port}/mcp-info`);
      console.log(`📥 Download MCP Server: http://localhost:${this.port}/download-mcp-server`);
      console.log(`🧪 Test Endpoint: http://localhost:${this.port}/test`);
      console.log('=== MISTRAL LE CHAT MCP BRIDGE READY ===');
      console.log('');
      console.log('📋 For Mistral Le Chat Configuration:');
      console.log('1. Download the MCP server: curl -O https://tomtom-maps-chatbot-production.up.railway.app/download-mcp-server');
      console.log('2. Run locally: node mistral-mcp-server.js');
      console.log('3. Configure in Le Chat with local path to the downloaded file');
      console.log('4. Available tools: search_places, geocode_address, reverse_geocode, get_directions, generate_static_map');
    });
  }

  // Graceful shutdown
  shutdown() {
    if (this.mcpServerProcess) {
      this.mcpServerProcess.kill();
    }
    process.exit(0);
  }
}

// Start the bridge
const bridge = new MistralMCPBridge();
bridge.start();

// Handle shutdown signals
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  bridge.shutdown();
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  bridge.shutdown();
});
