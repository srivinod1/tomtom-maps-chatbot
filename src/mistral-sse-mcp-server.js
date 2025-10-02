#!/usr/bin/env node

/**
 * MCP Server with SSE Transport for Mistral Le Chat
 * Implements MCP protocol over Server-Sent Events as expected by Le Chat
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

class MistralSSEMCPServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3003;
    this.tomtomApiKey = process.env.TOMTOM_API_KEY;
    this.clients = new Map(); // Store SSE connections
    
    this.setupMiddleware();
    this.setupSSE();
    this.setupMCPServer();
  }

  setupMiddleware() {
    // Debug logging middleware
    this.app.use((req, res, next) => {
      console.log('=============================');
      console.log('📨 Incoming Request:');
      console.log('Method:', req.method);
      console.log('Path:', req.path);
      console.log('Headers:', req.headers);
      console.log('Body:', req.body);
      console.log('=============================');
      next();
    });

    // Enhanced CORS configuration for Mistral Le Chat
    this.app.use(cors({
      origin: true, // Allow all origins
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control'],
      preflightContinue: false,
      optionsSuccessStatus: 200
    }));
    
    // Handle preflight requests
    this.app.options('*', cors());
    
    this.app.use(express.json());
  }

  setupSSE() {
    // POST endpoint that returns SSE for MCP communication
    this.app.post('/sse', (req, res) => {
      console.log('🔌 SSE POST connection from:', req.headers['user-agent']);
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      });

      const clientId = Date.now() + Math.random();
      this.clients.set(clientId, res);
      console.log('🔌 Client connected:', clientId);

      // Handle message from POST body (already parsed by express.json())
      if (req.body && req.body.method) {
        console.log('📨 MCP message from POST body:', req.body.method);
        this.handleMCPMessage(req.body, res);
      } else {
        console.log('⚠️ No valid MCP message in POST body');
      }

      // Keep connection open
      req.on('close', () => {
        console.log('🔌 Client disconnected:', clientId);
        this.clients.delete(clientId);
      });
    });

    // Also provide GET endpoint for SSE stream only (for compatibility)
    this.app.get('/sse', (req, res) => {
      console.log('🔌 SSE GET connection from:', req.headers['user-agent']);
      console.log('🔍 GET request headers:', req.headers);
      console.log('🔍 GET request query:', req.query);
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      const clientId = Date.now() + Math.random();
      this.clients.set(clientId, res);
      
      // Send connection event
      res.write(': connected\n\n');
      
      // Send initial MCP server info
      res.write(`data: ${JSON.stringify({
        jsonrpc: "2.0",
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            logging: {}
          },
          serverInfo: {
            name: "tomtom-maps-server",
            version: "1.0.0"
          }
        },
        id: 1
      })}\n\n`);
      
      req.on('close', () => {
        console.log('🔌 GET SSE client disconnected:', clientId);
        this.clients.delete(clientId);
      });
    });

    // Alternative MCP endpoint - some clients might expect this
    this.app.post('/mcp', (req, res) => {
      console.log('🔌 MCP POST connection from:', req.headers['user-agent']);
      console.log('📨 MCP message from POST body:', req.body);
      
      if (req.body && req.body.method) {
        console.log('📨 Processing MCP message:', req.body.method);
        this.handleMCPMessage(req.body, res);
      } else {
        console.log('⚠️ No valid MCP message in POST body');
        res.json({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
            data: "No valid MCP message found"
          },
          id: null
        });
      }
    });

    // WebSocket-style SSE: Handle MCP messages via separate POST endpoint
    this.app.post('/message', async (req, res) => {
      console.log('🔌 MCP message POST from:', req.headers['user-agent']);
      console.log('📨 MCP message received:', req.body);
      
      if (req.body && req.body.method) {
        const result = await this.handleMCPMessageSync(req.body);
        
        // Broadcast to all SSE clients
        for (const [id, client] of this.clients) {
          client.write(`data: ${JSON.stringify({
            jsonrpc: '2.0',
            id: req.body.id,
            result: result
          })}\n\n`);
        }
        
        res.json({ success: true });
      } else {
        console.log('⚠️ No valid MCP message in POST body');
        res.json({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
            data: "No valid MCP message found"
          },
          id: null
        });
      }
    });
  }

  async handleMCPMessageSync(message) {
    try {
      const { jsonrpc, method, params, id } = message;
      console.log('🔍 MCP Message Received (sync):', { method, params, id });
      
      let result;
      
      switch (method) {
        case 'initialize':
          console.log('✅ Handling initialize method (sync)');
          result = {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              logging: {}
            },
            serverInfo: {
              name: "tomtom-maps-server",
              version: "1.0.0"
            }
          };
          break;
          
        case 'tools/list':
          console.log('✅ Handling tools/list method (sync)');
          result = {
            tools: [
              {
                name: "tomtom_search",
                description: "Search for places using TomTom Maps",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "Search query (e.g., 'restaurants in Paris')" },
                    location: { type: "string", description: "Location context (optional)" }
                  },
                  required: ["query"]
                }
              },
              {
                name: "tomtom_geocode",
                description: "Convert address to coordinates",
                inputSchema: {
                  type: "object",
                  properties: {
                    address: { type: "string", description: "Address to geocode" }
                  },
                  required: ["address"]
                }
              },
              {
                name: "tomtom_directions",
                description: "Get directions between two points",
                inputSchema: {
                  type: "object",
                  properties: {
                    origin: { type: "string", description: "Starting point" },
                    destination: { type: "string", description: "Destination" }
                  },
                  required: ["origin", "destination"]
                }
              },
              {
                name: "tomtom_reverse_geocode",
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
                name: "tomtom_static_map",
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
          };
          break;
          
        case 'tools/call':
          console.log('🔧 Tool call received (sync):', params);
          const { name, arguments: args } = params;
          console.log('📞 Executing tool (sync):', name);
          console.log('📥 Tool arguments:', args);
          
          const toolResult = await this.executeTool(name, args);
          console.log('📤 Tool result:', toolResult);
          
          result = {
            content: [
              {
                type: "text",
                text: toolResult
              }
            ]
          };
          console.log('📋 Final response (sync):', JSON.stringify(result, null, 2));
          break;
          
        default:
          console.log('❌ Unknown method (sync):', method);
          result = {
            error: {
              code: -32601,
              message: "Method not found",
              data: `Unknown method: ${method}`
            }
          };
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ MCP Error (sync):', error);
      console.error('❌ Error stack:', error.stack);
      
      return {
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message
        }
      };
    }
  }

  async handleMCPMessage(message, res) {
    try {
      const { jsonrpc, method, params, id } = message;
      console.log('🔍 MCP Message Received via SSE:', { method, params, id });
      
      let result;
      
      switch (method) {
        case 'initialize':
          console.log('✅ Handling initialize method via SSE');
          result = {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
              logging: {}
            },
            serverInfo: {
              name: "tomtom-maps-server",
              version: "1.0.0"
            }
          };
          break;
          
        case 'tools/list':
          console.log('✅ Handling tools/list method via SSE');
          result = {
            tools: [
              {
                name: "tomtom_search",
                description: "Search for places using TomTom Maps",
                inputSchema: {
                  type: "object",
                  properties: {
                    query: { type: "string", description: "Search query (e.g., 'restaurants in Paris')" },
                    location: { type: "string", description: "Location context (optional)" }
                  },
                  required: ["query"]
                }
              },
              {
                name: "tomtom_geocode",
                description: "Convert address to coordinates",
                inputSchema: {
                  type: "object",
                  properties: {
                    address: { type: "string", description: "Address to geocode" }
                  },
                  required: ["address"]
                }
              },
              {
                name: "tomtom_directions",
                description: "Get directions between two points",
                inputSchema: {
                  type: "object",
                  properties: {
                    origin: { type: "string", description: "Starting point" },
                    destination: { type: "string", description: "Destination" }
                  },
                  required: ["origin", "destination"]
                }
              },
              {
                name: "tomtom_reverse_geocode",
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
                name: "tomtom_static_map",
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
          };
          break;
          
        case 'tools/call':
          console.log('🔧 Tool call received via SSE:', params);
          const { name, arguments: args } = params;
          console.log('📞 Executing tool via SSE:', name);
          console.log('📥 Tool arguments:', args);
          
          const toolResult = await this.executeTool(name, args);
          console.log('📤 Tool result:', toolResult);
          
          result = {
            content: [
              {
                type: "text",
                text: toolResult
              }
            ]
          };
          console.log('📋 Final response to Le Chat via SSE:', JSON.stringify(result, null, 2));
          break;
          
        default:
          console.log('❌ Unknown method via SSE:', method);
          result = {
            error: {
              code: -32601,
              message: "Method not found",
              data: `Unknown method: ${method}`
            }
          };
      }
      
      // Send response via SSE format
      const response = {
        jsonrpc: '2.0',
        id: id,
        result: result
      };
      
      console.log('📨 Sending SSE response:', JSON.stringify(response, null, 2));
      res.write(`data: ${JSON.stringify(response)}\n\n`);
      
    } catch (error) {
      console.error('❌ MCP Error via SSE:', error);
      console.error('❌ Error stack:', error.stack);
      
      const errorResponse = {
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32603,
          message: "Internal error",
          data: error.message
        }
      };
      
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
    }
  }


  async executeTool(name, args) {
    switch (name) {
      case 'tomtom_search':
        return await this.searchPlaces(args);
      case 'tomtom_geocode':
        return await this.geocodeAddress(args);
      case 'tomtom_reverse_geocode':
        return await this.reverseGeocode(args);
      case 'tomtom_directions':
        return await this.getDirections(args);
      case 'tomtom_static_map':
        return await this.generateStaticMap(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async searchPlaces(args) {
    console.log('🔍 searchPlaces called with args:', args);
    const { query, location, lat = 52.3676, lon = 4.9041, radius = 5000, limit = 10 } = args;
    
    // If location is provided, try to geocode it first
    if (location && !lat && !lon) {
      const coords = await this.geocodeLocation(location);
      if (coords) {
        lat = coords.lat;
        lon = coords.lon;
      }
    }
    
    console.log('🌐 Making TomTom API call...');
    const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`;
    const params = {
      key: this.tomtomApiKey,
      limit: limit,
      geobias: `point:${lat},${lon}`
    };

    console.log('📡 API URL:', url);
    console.log('📡 API Params:', params);

    try {
      const response = await axios.get(url, { params });
      console.log('✅ TomTom API response received:', response.status);
      console.log('📊 Response data:', response.data);
      
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

        const result = `Found ${places.length} places for "${query}":\n\n` +
               places.map((place, index) => 
                 `${index + 1}. **${place.name}**\n   📍 ${place.address}\n   📏 ${place.distance} km away\n`
               ).join('\n');
        
        console.log('📤 searchPlaces result:', result);
        return result;
      }

      const noResults = `No places found for "${query}"`;
      console.log('📤 searchPlaces result (no results):', noResults);
      return noResults;
    } catch (error) {
      console.error('❌ TomTom API error:', error.message);
      console.error('❌ Error details:', error.response?.data);
      throw error;
    }
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
    const { origin, destination, travelMode = 'car' } = args;
    
    // First geocode both addresses
    const fromCoords = await this.geocodeLocation(origin);
    const toCoords = await this.geocodeLocation(destination);

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

      return `🚗 **Directions from ${origin} to ${destination}**\n\n` +
             `📏 **Distance:** ${distance} km\n` +
             `⏱️ **Duration:** ${duration} minutes\n` +
             `🚗 **Travel Mode:** ${travelMode}`;
    }

    return `Could not calculate route from ${origin} to ${destination}`;
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

  setupMCPServer() {
    // Health check endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'TomTom MCP Server with SSE for Mistral Le Chat',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        protocol: 'MCP over SSE',
        provider: 'Mistral Le Chat',
        endpoints: {
          sse: 'GET /sse - SSE connection',
          ssePost: 'POST /sse - MCP messages via SSE',
          mcp: 'POST /mcp - MCP messages via HTTP',
          message: 'POST /message - WebSocket-style MCP messages',
          health: 'GET / - Health check'
        },
        tools: [
          'search_places',
          'geocode_address',
          'reverse_geocode',
          'get_directions',
          'generate_static_map'
        ]
      });
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
      console.log('=== MISTRAL LE CHAT MCP SERVER WITH SSE ===');
      console.log(`📍 TomTom API Key: ${this.tomtomApiKey ? 'Configured' : 'Missing'}`);
      console.log(`🚀 Starting MCP Server with SSE on port ${this.port}`);
      console.log(`🔌 SSE Endpoint: http://localhost:${this.port}/sse`);
      console.log(`📨 MCP Messages: POST http://localhost:${this.port}/sse`);
      console.log(`❤️ Health Check: http://localhost:${this.port}/`);
      console.log('=== MISTRAL LE CHAT MCP SERVER WITH SSE READY ===');
      console.log('');
      console.log('📋 For Mistral Le Chat Configuration:');
      console.log('1. Use this URL as your MCP server: https://tomtom-maps-chatbot-production.up.railway.app/sse');
      console.log('2. The server implements MCP protocol over Server-Sent Events');
      console.log('3. Available tools: search_places, geocode_address, reverse_geocode, get_directions, generate_static_map');
    });
  }
}

// Start the server
const server = new MistralSSEMCPServer();
server.start();
