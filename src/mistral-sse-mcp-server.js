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
    this.tomtomRouteMonitoringApiKey = process.env.TOMTOM_ROUTE_MONITORING_API_KEY || this.tomtomApiKey;
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
                   version: "1.0.0-mcp"
                 }
        },
        id: 1
      })}\n\n`);
      
      req.on('close', () => {
        console.log('🔌 GET SSE client disconnected:', clientId);
        this.clients.delete(clientId);
      });
    });

    // Alternative MCP endpoint - HTTP JSON responses (what Le Chat expects)
    this.app.post('/mcp', async (req, res) => {
      console.log('🔌 MCP POST connection from:', req.headers['user-agent']);
      console.log('📨 MCP message from POST body:', req.body);
      
      if (req.body && req.body.method) {
        console.log('📨 Processing MCP message:', req.body.method);
        
        // Use the sync handler and return HTTP JSON response
        const result = await this.handleMCPMessageSync(req.body);
        
        // Only send response if result is not null (notifications don't need responses)
        if (result !== null) {
          const response = {
            jsonrpc: '2.0',
            id: req.body.id,
            result: result
          };
          
          console.log('📨 Sending HTTP JSON response:', JSON.stringify(response, null, 2));
          res.json(response);
        } else {
          console.log('📨 Notification received, no response needed');
          res.status(204).end(); // Send 204 No Content for notifications
        }
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
      
      // Handle notifications (no response needed, no id field)
      if (method && method.startsWith('notifications/')) {
        console.log(`✅ Acknowledged notification: ${method}`);
        return null; // Notifications don't require responses
      }
      
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
                   version: "1.0.0-mcp"
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
                          location: { type: "string", description: "Specific location/address for search bias (e.g., '15 rue des Halles, Paris' or 'Times Square, New York')" }
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
                name: "tomtom_monitor_route",
                description: "Monitor real-time traffic conditions on a specific route",
                inputSchema: {
                  type: "object",
                  properties: {
                    routeId: { type: "string", description: "Route ID to monitor (e.g., '81390')" },
                    routeDescription: { type: "string", description: "Route description (e.g., 'Barcelona airport to smart city event route')" }
                  },
                  required: []
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
      
      // Handle notifications (no response needed, no id field)
      if (method && method.startsWith('notifications/')) {
        console.log(`✅ Acknowledged notification via SSE: ${method}`);
        return; // Notifications don't require responses
      }
      
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
                   version: "1.0.0-mcp"
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
                          location: { type: "string", description: "Specific location/address for search bias (e.g., '15 rue des Halles, Paris' or 'Times Square, New York')" }
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
                name: "tomtom_monitor_route",
                description: "Monitor real-time traffic conditions on a specific route",
                inputSchema: {
                  type: "object",
                  properties: {
                    routeId: { type: "string", description: "Route ID to monitor (e.g., '81390')" },
                    routeDescription: { type: "string", description: "Route description (e.g., 'Barcelona airport to smart city event route')" }
                  },
                  required: []
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
      
      // Send response via SSE format (only if result is not null)
      if (result !== null) {
        const response = {
          jsonrpc: '2.0',
          id: id,
          result: result
        };
        
        console.log('📨 Sending SSE response:', JSON.stringify(response, null, 2));
        res.write(`data: ${JSON.stringify(response)}\n\n`);
      } else {
        console.log('📨 Notification received, no response needed');
      }
      
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
      case 'tomtom_monitor_route':
        return await this.monitorRoute(args);
      case 'tomtom_static_map':
        return await this.generateStaticMap(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async searchPlaces(args) {
    console.log('🔍 searchPlaces called with args:', args);
    const { query, location, lat, lon, radius = 5000, limit = 10 } = args;
    
    let searchLat = lat || 52.3676; // Default to Amsterdam if no lat provided
    let searchLon = lon || 4.9041;  // Default to Amsterdam if no lon provided
    
    // If location is provided but no explicit coordinates, try to geocode it first
    if (location && !lat && !lon) {
      let locationToGeocode = location;
      
      // If location is too generic (just city name), try to extract address from query
      if (location.length < 20 && query.includes('near') && query.includes(location)) {
        console.log('🔍 Location seems generic, trying to extract address from query');
        // Look for patterns like "near 15 rue des Halles, Paris" or "near 123 Main St, City"
        const nearMatch = query.match(/near\s+([^,]+(?:,\s*[^,]+)*)/i);
        if (nearMatch) {
          locationToGeocode = nearMatch[1].trim();
          console.log('📍 Extracted address from query:', locationToGeocode);
        }
      }
      
      console.log('🌍 Geocoding location:', locationToGeocode);
      const coords = await this.geocodeLocation(locationToGeocode);
      if (coords) {
        searchLat = coords.lat;
        searchLon = coords.lon;
        console.log('📍 Geocoded coordinates:', searchLat, searchLon);
      } else {
        console.log('⚠️ Failed to geocode location, using defaults');
      }
    }
    
    console.log('🌐 Making TomTom API call...');
    const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`;
    const params = {
      key: this.tomtomApiKey,
      limit: limit,
      geobias: `point:${searchLat},${searchLon}`
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
                  lat: place.position?.lat || searchLat,
                  lon: place.position?.lon || searchLon
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
             `⏱️ **Duration:** ${duration} minutes (with real-time traffic)\n` +
             `🚗 **Travel Mode:** ${travelMode}\n` +
             `🚦 **Route Type:** Fastest route with live traffic data`;
    }

    return `Could not calculate route from ${origin} to ${destination}`;
  }

  async monitorRoute(args) {
    const { routeId, routeDescription } = args;
    
    console.log('🔍 Monitoring route:', routeId || routeDescription);
    
    // If routeDescription is provided, try to find the route ID
    let actualRouteId = routeId;
    if (routeDescription && !routeId) {
      actualRouteId = await this.findRouteId(routeDescription);
      if (!actualRouteId) {
        return `❌ Could not find a route matching: "${routeDescription}". Please provide a specific Route ID or try a different route description.`;
      }
      console.log('📍 Found route ID:', actualRouteId, 'for description:', routeDescription);
    }
    
    try {
      const url = `https://api.tomtom.com/routemonitoring/3/routes/${actualRouteId}/details`;
      const params = {
        key: this.tomtomRouteMonitoringApiKey
      };
      
      const response = await axios.get(url, { params });
      const data = response.data;
      
      if (!data || !data.routeId) {
        return `No route data found for route ID: ${routeId}`;
      }
      
      // Convert to more readable units for overall stats
      const totalLength = (data.routeLength / 1000).toFixed(1);
      const currentTravelTime = Math.round(data.travelTime / 60); // Total time including delays
      const typicalTravelTime = Math.round(data.typicalTravelTime / 60); // Free-flow time
      const delayTime = Math.round(data.delayTime / 60);
      const delayPercentage = ((data.delayTime / data.typicalTravelTime) * 100).toFixed(1);
      
      // Determine traffic level
      let trafficLevel;
      if (delayPercentage < 10) trafficLevel = 'Light';
      else if (delayPercentage < 25) trafficLevel = 'Moderate';
      else if (delayPercentage < 50) trafficLevel = 'Heavy';
      else trafficLevel = 'Severe';
      
      // Build response
      let result = `🚦 **Route Monitoring Report - Route ID: ${actualRouteId}**\n`;
      if (data.routeName) {
        result += `📍 **Route:** ${data.routeName}\n`;
      }
      result += `\n`;
      
      result += `📊 **Overall Route Statistics:**\n`;
      result += `- Total Distance: ${totalLength} km\n`;
      result += `- Current Travel Time: ${currentTravelTime} minutes (with delays)\n`;
      result += `- Typical Travel Time: ${typicalTravelTime} minutes (free-flow)\n`;
      result += `- Total Delay: ${delayTime} minutes (${delayPercentage}%)\n`;
      result += `- Traffic Level: ${trafficLevel}\n`;
      result += `- Route Status: ${data.routeStatus}\n`;
      result += `- Route Confidence: ${data.routeConfidence}%\n\n`;
      
      // Find segments with delay and sort by delay
      // Only consider segments > 100 meters for meaningful bottleneck analysis
      const segments = data.detailedSegments || [];
      
      // Filter segments: only include those with delays AND length > 100 meters
      const delayedSegments = segments
        .filter(seg => {
          // Check if segment has traffic delay (current speed < typical speed)
          const hasDelay = seg.currentSpeed && seg.typicalSpeed && seg.currentSpeed < seg.typicalSpeed;
          
          // Debug: Log the actual segment structure to understand the field names (reduced logging)
          if (seg.segmentLength < 0.1) { // Only log short segments
            console.log(`🔍 Short segment: length=${seg.segmentLength}m, currentSpeed=${seg.currentSpeed}, typicalSpeed=${seg.typicalSpeed}`);
          }
          
          // Check if segment is longer than 100 meters
          // Try different possible field names for length
          let segmentLengthMeters = 0;
          if (seg.segmentLengthMeters) {
            segmentLengthMeters = seg.segmentLengthMeters;
          } else if (seg.segmentLength) {
            // segmentLength is already in meters (from TomTom API)
            segmentLengthMeters = seg.segmentLength;
          } else if (seg.length) {
            segmentLengthMeters = seg.length;
          }
          
          const isLongEnough = segmentLengthMeters > 100;
          
          // Reduced logging to avoid Railway rate limits
          if (hasDelay) {
            console.log(`✅ Bottleneck segment: ${segmentLengthMeters}m, speed reduction: ${100 - seg.relativeSpeed}%`);
          }
          
          return hasDelay && isLongEnough; // Restore 100m filter
        })
        .sort((a, b) => (100 - a.relativeSpeed) - (100 - b.relativeSpeed)) // Sort by speed reduction percentage (descending)
        .slice(0, 3);
      
      if (delayedSegments.length > 0) {
        result += `🚧 **Top ${delayedSegments.length} Bottleneck Segments:**\n\n`;
        
      // Get street names for each bottleneck segment
      for (let i = 0; i < delayedSegments.length; i++) {
        const segment = delayedSegments[i];
        
        // Extract coordinates from shape array (use first point)
        let segmentLocation = '';
        let coords = null;
        if (segment.shape && segment.shape.length > 0) {
          coords = segment.shape[0];
          segmentLocation = `at ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        } else {
          segmentLocation = segment.segmentIdStr || 'unknown location';
        }
        
        result += `${i + 1}. **Segment ${segmentLocation}**\n`;
        
        // Get street name via reverse geocoding
        if (coords) {
          try {
            const streetName = await this.getStreetName(coords.latitude, coords.longitude);
            if (streetName) {
              result += `   📍 **Location:** ${streetName}\n`;
            }
          } catch (error) {
            console.log('Could not get street name for segment:', error.message);
          }
        }
        
        // Speed reduction percentage (100 - relativeSpeed)
        // Debug: Check relativeSpeed value
        console.log(`🔍 Speed debug: relativeSpeed=${segment.relativeSpeed}, currentSpeed=${segment.currentSpeed}, typicalSpeed=${segment.typicalSpeed}`);
        const speedReductionPercent = (100 - segment.relativeSpeed).toFixed(1);
        result += `   - Current Speed: ${segment.currentSpeed} km/h\n`;
        result += `   - Typical Speed: ${segment.typicalSpeed} km/h\n`;
        result += `   - Speed Reduction: ${speedReductionPercent}%\n`;
        
               // Length in meters
               let segmentLengthMeters = 0;
               if (segment.segmentLengthMeters) {
                 segmentLengthMeters = segment.segmentLengthMeters;
               } else if (segment.segmentLength) {
                 // segmentLength is already in meters (from TomTom API)
                 segmentLengthMeters = segment.segmentLength;
               } else if (segment.length) {
                 segmentLengthMeters = segment.length;
               }
               
               if (segmentLengthMeters > 0) {
                 if (segmentLengthMeters >= 1000) {
                   const segmentLengthKm = (segmentLengthMeters / 1000).toFixed(2);
                   result += `   - Length: ${segmentLengthKm} km (${segmentLengthMeters}m)\n`;
                 } else {
                   result += `   - Length: ${segmentLengthMeters}m\n`;
                 }
               }
        
        // Confidence
        if (segment.confidence !== undefined) {
          result += `   - Confidence: ${segment.confidence}%\n`;
        }
        
        result += `\n`;
      }
      } else {
        result += `✅ **No significant delays detected on this route (considering segments > 100m).**\n\n`;
      }
      
      return result;
      
    } catch (error) {
      console.error('Route monitoring error:', error.message);
      if (error.response) {
        console.error('API error details:', error.response.data);
      }
      
      if (error.response?.status === 404) {
        return `Route ID ${routeId} not found. Please verify the route ID is correct.`;
      }
      
      throw new Error(`Failed to monitor route: ${error.message}`);
    }
  }

  // Helper method to find route ID from description
  async findRouteId(routeDescription) {
    try {
      // Known routes with their names and IDs
      // In a real implementation, you might want to use TomTom's route search API
      const knownRoutes = [
        { id: '81390', name: 'Barcelona airport - Smarty City Event' }
        // Add more routes as they become available
      ];
      
      const normalizedDescription = routeDescription.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // Extract key terms from the description
      const keywords = normalizedDescription.split(' ').filter(word => 
        word.length > 2 && 
        !['the', 'and', 'to', 'from', 'route', 'show', 'me', 'bottlenecks', 'on'].includes(word)
      );
      
      console.log('🔍 Searching for route with keywords:', keywords);
      
      // Try to find matching routes
      for (const route of knownRoutes) {
        const routeName = route.name.toLowerCase();
        
        // Check if all keywords are present in the route name
        const allKeywordsMatch = keywords.every(keyword => 
          routeName.includes(keyword)
        );
        
        if (allKeywordsMatch && keywords.length > 0) {
          console.log('✅ Found matching route:', route.name, 'for description:', routeDescription);
          return route.id;
        }
        
        // Also try partial matches for flexibility
        const anyKeywordMatch = keywords.some(keyword => 
          routeName.includes(keyword)
        );
        
        if (anyKeywordMatch && keywords.length <= 2) {
          console.log('✅ Found partial matching route:', route.name, 'for description:', routeDescription);
          return route.id;
        }
      }
      
      console.log('❌ No matching route found for:', routeDescription);
      return null;
    } catch (error) {
      console.log('Route search error:', error.message);
      return null;
    }
  }

  // Helper method to get street name from coordinates
  async getStreetName(lat, lon) {
    try {
      const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json`;
      const params = {
        key: this.tomtomApiKey,
        language: 'en-US'
      };
      
      const response = await axios.get(url, { params });
      const data = response.data;
      
      if (data.addresses && data.addresses.length > 0) {
        const address = data.addresses[0].address;
        return address.freeformAddress || `${address.streetName || 'Unknown Street'}, ${address.municipality || 'Unknown City'}`;
      }
      
      return null;
    } catch (error) {
      console.log('Reverse geocoding error:', error.message);
      return null;
    }
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
               service: 'TomTom MCP Server V1.0.0-mcp for Mistral Le Chat',
               status: 'healthy',
               version: '1.0.0-mcp',
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
             console.log('1. Use this URL as your MCP server: https://tomtom-maps-chatbot-production.up.railway.app/mcp');
             console.log('2. The server implements MCP protocol over HTTP JSON-RPC');
             console.log('3. Available tools: tomtom_search, tomtom_geocode, tomtom_directions, tomtom_reverse_geocode, tomtom_monitor_route, tomtom_static_map (V2.0.1)');
             console.log('4. Version: 2.0.1-mcp (Production Ready with 100m Filter)');
    });
  }
}

// Start the server
const server = new MistralSSEMCPServer();
server.start();
