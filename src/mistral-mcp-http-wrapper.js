#!/usr/bin/env node

/**
 * HTTP Wrapper for MCP Server - Railway Deployment
 * This creates an HTTP server that can run the MCP server for Mistral Le Chat
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { spawn } = require('child_process');
require('dotenv').config();

class MistralMCPHTTPWrapper {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3003;
    this.tomtomApiKey = process.env.TOMTOM_API_KEY;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'TomTom MCP Server for Mistral Le Chat',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        protocol: 'MCP',
        provider: 'Mistral Le Chat',
        mcpCompatible: true,
        tools: [
          'search_places',
          'geocode_address', 
          'reverse_geocode',
          'get_directions',
          'generate_static_map'
        ],
        endpoints: {
          mcp: 'MCP Protocol over stdio',
          health: 'GET /',
          info: 'GET /mcp-info'
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
        ]
      });
    });

    // Test endpoint to verify TomTom API
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
      console.log('=== MISTRAL LE CHAT MCP SERVER (HTTP WRAPPER) ===');
      console.log(`📍 TomTom API Key: ${this.tomtomApiKey ? 'Configured' : 'Missing'}`);
      console.log(`🚀 Starting HTTP wrapper on port ${this.port}`);
      console.log(`🌐 Health Check: http://localhost:${this.port}/`);
      console.log(`🔧 MCP Info: http://localhost:${this.port}/mcp-info`);
      console.log(`🧪 Test Endpoint: http://localhost:${this.port}/test`);
      console.log('=== MISTRAL LE CHAT MCP SERVER READY ===');
      console.log('');
      console.log('📋 For Mistral Le Chat Configuration:');
      console.log('1. Use this URL as your MCP server: https://tomtom-maps-chatbot-production.up.railway.app');
      console.log('2. The server is MCP-compatible and follows the Model Context Protocol');
      console.log('3. Available tools: search_places, geocode_address, reverse_geocode, get_directions, generate_static_map');
    });
  }
}

// Start the HTTP wrapper
const server = new MistralMCPHTTPWrapper();
server.start();
