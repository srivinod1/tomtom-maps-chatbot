#!/usr/bin/env node

/**
 * HTTP MCP Server for Mistral Le Chat
 * Implements MCP protocol over HTTP as expected by Mistral Le Chat
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

class MistralHTTPMCPServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3003;
    this.tomtomApiKey = process.env.TOMTOM_API_KEY;
    
    this.setupMiddleware();
    this.setupMCPServer();
  }

  setupMiddleware() {
    // Enhanced CORS configuration for Mistral Le Chat
    this.app.use(cors({
      origin: true, // Allow all origins
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
      preflightContinue: false,
      optionsSuccessStatus: 200
    }));
    
    // Handle preflight requests
    this.app.options('*', cors());
    
    this.app.use(express.json());
  }

  setupMCPServer() {
    // MCP Server Info endpoint (GET and POST)
    this.app.get('/', (req, res) => {
      // Add debugging headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      
      res.json({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "tomtom-maps-server",
            version: "1.0.0"
          }
        },
        id: 1
      });
    });

    // Handle POST requests to root endpoint (for MCP protocol)
    this.app.post('/', (req, res) => {
      // Add debugging headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      
      const { method, params, id } = req.body;
      
      // Handle different MCP methods
      switch (method) {
        case 'ping':
          res.json({
            jsonrpc: "2.0",
            result: { pong: true },
            id: id || 1
          });
          break;
        case 'initialize':
          res.json({
            jsonrpc: "2.0",
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: "tomtom-maps-server",
                version: "1.0.0"
              }
            },
            id: id || 1
          });
          break;
        default:
          res.json({
            jsonrpc: "2.0",
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {}
              },
              serverInfo: {
                name: "tomtom-maps-server",
                version: "1.0.0"
              }
            },
            id: id || 1
          });
      }
    });

    // MCP Tools List endpoint
    this.app.post('/tools/list', (req, res) => {
      // Add CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      
      res.json({
        jsonrpc: "2.0",
        result: {
          tools: [
            {
              name: "search_places",
              description: "Search for places using TomTom API",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "Search query" },
                  lat: { type: "number", description: "Latitude" },
                  lon: { type: "number", description: "Longitude" },
                  radius: { type: "number", description: "Search radius in meters", default: 5000 },
                  limit: { type: "number", description: "Maximum number of results", default: 10 }
                },
                required: ["query", "lat", "lon"]
              }
            },
            {
              name: "geocode_address",
              description: "Convert address to coordinates",
              inputSchema: {
                type: "object",
                properties: {
                  address: { type: "string", description: "Address to geocode" },
                  limit: { type: "number", description: "Maximum number of results", default: 1 }
                },
                required: ["address"]
              }
            },
            {
              name: "reverse_geocode",
              description: "Convert coordinates to address",
              inputSchema: {
                type: "object",
                properties: {
                  lat: { type: "number", description: "Latitude" },
                  lon: { type: "number", description: "Longitude" }
                },
                required: ["lat", "lon"]
              }
            },
            {
              name: "get_directions",
              description: "Get directions between two points",
              inputSchema: {
                type: "object",
                properties: {
                  from: { type: "string", description: "Starting address or coordinates" },
                  to: { type: "string", description: "Destination address or coordinates" },
                  travelMode: { type: "string", description: "Travel mode", default: "car" }
                },
                required: ["from", "to"]
              }
            },
            {
              name: "generate_static_map",
              description: "Generate static map image",
              inputSchema: {
                type: "object",
                properties: {
                  center: { type: "string", description: "Center coordinates" },
                  zoom: { type: "number", description: "Zoom level", default: 10 },
                  width: { type: "number", description: "Image width", default: 400 },
                  height: { type: "number", description: "Image height", default: 300 }
                },
                required: ["center"]
              }
            }
          ]
        },
        id: req.body.id || 1
      });
    });

    // MCP Tool Call endpoint
    this.app.post('/tools/call', async (req, res) => {
      // Add CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
      
      const { name, arguments: args } = req.body.params;
      const requestId = req.body.id || 1;

      try {
        let result;
        switch (name) {
          case 'search_places':
            result = await this.searchPlaces(args);
            break;
          case 'geocode_address':
            result = await this.geocodeAddress(args);
            break;
          case 'reverse_geocode':
            result = await this.reverseGeocode(args);
            break;
          case 'get_directions':
            result = await this.getDirections(args);
            break;
          case 'generate_static_map':
            result = await this.generateStaticMap(args);
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        res.json({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: result
              }
            ]
          },
          id: requestId
        });
      } catch (error) {
        res.json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
            data: error.message
          },
          id: requestId
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        service: 'TomTom MCP Server for Mistral Le Chat',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        protocol: 'MCP over HTTP',
        provider: 'Mistral Le Chat'
      });
    });

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      console.error('❌ Server error:', error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message
        },
        id: null
      });
    });
  }

  async searchPlaces(args) {
    const { query, lat, lon, radius = 5000, limit = 10 } = args;
    
    const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`;
    const params = {
      key: this.tomtomApiKey,
      limit: limit,
      geobias: `point:${lat},${lon}`
    };

    const response = await axios.get(url, { params });
    
    if (response.data && response.data.results) {
      const places = response.data.results.map(place => ({
        name: place.poi?.name || place.address?.freeformAddress || 'Unknown',
        address: place.address?.freeformAddress || place.address?.formattedAddress || 'Address not available',
        rating: place.poi?.rating || 0,
        distance: place.dist ? (place.dist / 1000).toFixed(2) : 0,
        coordinates: {
          lat: place.position?.lat || lat,
          lon: place.position?.lon || lon
        }
      }));

      return `Found ${places.length} places for "${query}":\n\n` +
             places.map((place, index) => 
               `${index + 1}. **${place.name}**\n   📍 ${place.address}\n   📏 ${place.distance} km away\n`
             ).join('\n');
    }

    return `No places found for "${query}"`;
  }

  async geocodeAddress(args) {
    const { address, limit = 1 } = args;
    
    const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(address)}.json`;
    const params = {
      key: this.tomtomApiKey,
      limit: limit
    };

    const response = await axios.get(url, { params });
    
    if (response.data && response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      const coords = result.position;
      const address = result.address?.freeformAddress || result.address?.formattedAddress || 'Address not available';

      return `📍 **${address}**\n\n**Coordinates:**\n- Latitude: ${coords.lat}\n- Longitude: ${coords.lon}`;
    }

    return `Could not find coordinates for "${address}"`;
  }

  async reverseGeocode(args) {
    const { lat, lon } = args;
    
    const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json`;
    const params = {
      key: this.tomtomApiKey
    };

    const response = await axios.get(url, { params });
    
    if (response.data && response.data.addresses && response.data.addresses.length > 0) {
      const address = response.data.addresses[0].address;

      return `📍 **${address.freeformAddress || address.formattedAddress}**\n\n**Coordinates:** ${lat}, ${lon}`;
    }

    return `Could not find address for coordinates ${lat}, ${lon}`;
  }

  async getDirections(args) {
    const { from, to, travelMode = 'car' } = args;
    
    // First geocode both addresses
    const fromCoords = await this.geocodeLocation(from);
    const toCoords = await this.geocodeLocation(to);

    if (!fromCoords || !toCoords) {
      return `Could not find coordinates for one or both addresses`;
    }

    const url = `https://api.tomtom.com/routing/1/calculateRoute/${fromCoords.lat},${fromCoords.lon}:${toCoords.lat},${toCoords.lon}/json`;
    const params = {
      key: this.tomtomApiKey,
      travelMode: travelMode,
      instructionsType: 'text'
    };

    const response = await axios.get(url, { params });
    
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      const summary = route.summary;
      const distance = (summary.lengthInMeters / 1000).toFixed(1);
      const duration = Math.round(summary.travelTimeInSeconds / 60);

      return `🚗 **Directions from ${from} to ${to}**\n\n` +
             `📏 **Distance:** ${distance} km\n` +
             `⏱️ **Duration:** ${duration} minutes\n` +
             `🚗 **Travel Mode:** ${travelMode}`;
    }

    return `Could not calculate route from ${from} to ${to}`;
  }

  async generateStaticMap(args) {
    const { center, zoom = 10, width = 400, height = 300 } = args;
    
    const url = `https://api.tomtom.com/map/1/staticimage`;
    const params = {
      key: this.tomtomApiKey,
      center: center,
      zoom: zoom,
      width: width,
      height: height,
      format: 'png'
    };

    const mapUrl = `${url}?${new URLSearchParams(params).toString()}`;

    return `🗺️ **Static Map Generated**\n\n**Center:** ${center}\n**Zoom:** ${zoom}\n**Size:** ${width}x${height}\n\n![Map](${mapUrl})`;
  }

  async geocodeLocation(query) {
    try {
      const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`;
      const params = {
        key: this.tomtomApiKey,
        limit: 1
      };

      const response = await axios.get(url, { params });
      
      if (response.data && response.data.results && response.data.results.length > 0) {
        return response.data.results[0].position;
      }
    } catch (error) {
      console.error('Geocoding error:', error.message);
    }
    return null;
  }

  start() {
    this.app.listen(this.port, () => {
      console.log('=== MISTRAL LE CHAT HTTP MCP SERVER ===');
      console.log(`📍 TomTom API Key: ${this.tomtomApiKey ? 'Configured' : 'Missing'}`);
      console.log(`🚀 Starting HTTP MCP Server on port ${this.port}`);
      console.log(`🌐 MCP Server: http://localhost:${this.port}/`);
      console.log(`🔧 Tools List: POST http://localhost:${this.port}/tools/list`);
      console.log(`⚡ Tool Call: POST http://localhost:${this.port}/tools/call`);
      console.log(`❤️ Health Check: http://localhost:${this.port}/health`);
      console.log('=== MISTRAL LE CHAT HTTP MCP SERVER READY ===');
      console.log('');
      console.log('📋 For Mistral Le Chat Configuration:');
      console.log('1. Use this URL as your MCP server: https://tomtom-maps-chatbot-production.up.railway.app');
      console.log('2. The server implements MCP protocol over HTTP');
      console.log('3. Available tools: search_places, geocode_address, reverse_geocode, get_directions, generate_static_map');
    });
  }
}

// Start the server
const server = new MistralHTTPMCPServer();
server.start();
