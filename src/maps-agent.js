#!/usr/bin/env node
/**
 * Maps Agent - Dedicated TomTom Maps MCP Server
 * Handles all location-based queries and TomTom API interactions
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const A2AProtocol = require('./a2a-protocol');
require('dotenv').config();

// Constants for TomTom API
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;
const TOMTOM_ORBIS_SEARCH_URL = 'https://api.tomtom.com/maps/orbis/places/nearbySearch/.json';
const TOMTOM_GEOCODING_URL = 'https://api.tomtom.com/search/2/geocode';
const TOMTOM_REVERSE_GEOCODING_URL = 'https://api.tomtom.com/search/2/reverseGeocode';
const TOMTOM_STATICMAP_URL = 'https://api.tomtom.com/map/1/staticimage';
const TOMTOM_ROUTING_URL = 'https://api.tomtom.com/maps/orbis/routing/calculateRoute';

if (!TOMTOM_API_KEY) {
  console.error('Error: TOMTOM_API_KEY environment variable not set');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize A2A Protocol
const a2a = new A2AProtocol('maps-agent', 'maps', `http://localhost:${PORT}`);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Maps Agent - TomTom MCP + A2A Server',
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    protocols: ['MCP', 'A2A'],
    agentId: 'maps-agent',
    agentType: 'maps',
    capabilities: [
      'place_search',
      'geocoding',
      'reverse_geocoding',
      'directions',
      'static_maps',
      'matrix_routing'
    ]
  });
});

// MCP Protocol endpoints (for internal TomTom API access)
app.post('/', async (req, res) => {
  console.log('Received MCP request:', JSON.stringify(req.body, null, 2));
  const { method, params, id } = req.body;
  
  try {
    switch (method) {
      case 'initialize':
        return await handleInitialize({ params, id }, res);
        
      case 'tools/list':
        return await handleToolsList({ params, id }, res);
        
      case 'tools/call':
        return await handleToolsCall({ params, id }, res);
        
      default:
        return res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        });
    }
  } catch (error) {
    console.error('Error handling MCP request:', error);
    return res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: 'Internal error'
      }
    });
  }
});

// A2A Protocol endpoint (for inter-agent communication)
app.post('/a2a', (req, res) => {
  a2a.handleA2AMessage(req, res);
});

// Agent discovery endpoint
app.get('/agents', (req, res) => {
  res.json({
    agents: [a2a.getAgentStatus()]
  });
});

// TomTom API Functions
async function searchLocationsOrbis(query, location, radius = 5000) {
  try {
    const params = {
      key: TOMTOM_API_KEY,
      apiVersion: 1,
      lat: location.lat,
      lon: location.lon,
      radius: radius,
      query: query
    };

    const response = await axios.get(TOMTOM_ORBIS_SEARCH_URL, { params });
    
    if (response.data && response.data.results) {
      return {
        places: response.data.results.map(place => ({
          name: place.poi?.name || 'Unknown',
          formatted_address: place.address?.freeformAddress || 'Address not available',
          rating: place.poi?.rating || 0,
          distance: place.distance ? (place.distance / 1000).toFixed(2) : null,
          position: place.position,
          categories: place.poi?.categories || []
        }))
      };
    }
    
    return { places: [] };
  } catch (error) {
    console.error('TomTom Search API error:', error.response?.data || error.message);
    throw new Error('Failed to search locations');
  }
}

async function geocodeAddress(address) {
  try {
    const params = {
      key: TOMTOM_API_KEY,
      query: address
    };

    const response = await axios.get(TOMTOM_GEOCODING_URL, { params });
    
    if (response.data && response.data.results) {
      return {
        results: response.data.results.map(result => ({
          address: result.address?.freeformAddress || address,
          position: {
            lat: result.position.lat,
            lon: result.position.lon
          },
          confidence: result.score || 0
        }))
      };
    }
    
    return { results: [] };
  } catch (error) {
    console.error('TomTom Geocoding API error:', error.response?.data || error.message);
    throw new Error('Failed to geocode address');
  }
}

async function reverseGeocode(lat, lon) {
  try {
    const params = {
      key: TOMTOM_API_KEY,
      lat: lat,
      lon: lon
    };

    const response = await axios.get(TOMTOM_REVERSE_GEOCODING_URL, { params });
    
    if (response.data && response.data.addresses) {
      return {
        results: response.data.addresses.map(addr => ({
          address: addr.address?.freeformAddress || 'Address not available',
          position: {
            lat: addr.position.lat,
            lon: addr.position.lon
          }
        }))
      };
    }
    
    return { results: [] };
  } catch (error) {
    console.error('TomTom Reverse Geocoding API error:', error.response?.data || error.message);
    throw new Error('Failed to reverse geocode coordinates');
  }
}

async function calculateRoute(origin, destination, options = {}) {
  try {
    const params = {
      key: TOMTOM_API_KEY,
      apiVersion: 1,
      'origin.lat': origin.lat,
      'origin.lon': origin.lon,
      'destination.lat': destination.lat,
      'destination.lon': destination.lon,
      ...options
    };

    const response = await axios.get(TOMTOM_ROUTING_URL, { params });
    
    if (response.data && response.data.routes) {
      return {
        routes: response.data.routes.map(route => ({
          summary: {
            distance: route.summary?.lengthInMeters || 0,
            duration: route.summary?.travelTimeInSeconds || 0,
            trafficDelay: route.summary?.trafficDelayInSeconds || 0
          },
          legs: route.legs || []
        }))
      };
    }
    
    return { routes: [] };
  } catch (error) {
    console.error('TomTom Routing API error:', error.response?.data || error.message);
    throw new Error('Failed to calculate route');
  }
}

async function generateStaticMapUrl(center, zoom = 15, markers = [], options = {}) {
  try {
    const params = {
      key: TOMTOM_API_KEY,
      center: `${center.lon},${center.lat}`,
      zoom: zoom,
      width: options.width || 512,
      height: options.height || 512,
      format: options.format || 'png',
      ...options
    };

    if (markers.length > 0) {
      params.markers = markers.map(marker => 
        `color:${marker.color || 'red'}|${marker.lon},${marker.lat}`
      ).join('&markers=');
    }

    const queryString = new URLSearchParams(params).toString();
    return `${TOMTOM_STATICMAP_URL}?${queryString}`;
  } catch (error) {
    console.error('TomTom Static Map API error:', error.message);
    throw new Error('Failed to generate static map URL');
  }
}

// MCP Methods
async function handleInitialize(rpcRequest, res) {
  return res.json({
    jsonrpc: '2.0',
    id: rpcRequest.id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {
          listChanged: true
        }
      },
      serverInfo: {
        name: 'tomtom-maps-agent',
        version: '1.0.0'
      }
    }
  });
}

async function handleToolsList(rpcRequest, res) {
  return res.json({
    jsonrpc: '2.0',
    id: rpcRequest.id,
    result: {
      tools: [
        {
          name: 'maps.search',
          description: 'Search for places using TomTom Maps',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              location: { 
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lon: { type: 'number' }
                }
              },
              radius: { type: 'number', description: 'Search radius in meters' }
            },
            required: ['query', 'location']
          }
        },
        {
          name: 'maps.geocode',
          description: 'Convert address to coordinates',
          inputSchema: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Address to geocode' }
            },
            required: ['address']
          }
        },
        {
          name: 'maps.reverse_geocode',
          description: 'Convert coordinates to address',
          inputSchema: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lon: { type: 'number' }
            },
            required: ['lat', 'lon']
          }
        },
        {
          name: 'maps.directions',
          description: 'Get directions between two points',
          inputSchema: {
            type: 'object',
            properties: {
              origin: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lon: { type: 'number' }
                }
              },
              destination: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lon: { type: 'number' }
                }
              }
            },
            required: ['origin', 'destination']
          }
        },
        {
          name: 'maps.static_map',
          description: 'Generate static map URL',
          inputSchema: {
            type: 'object',
            properties: {
              center: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lon: { type: 'number' }
                }
              },
              zoom: { type: 'number' },
              markers: { type: 'array' }
            },
            required: ['center']
          }
        }
      ]
    }
  });
}

async function handleToolsCall(rpcRequest, res) {
  console.log('handleToolsCall called with:', rpcRequest.params);
  console.log('params type:', typeof rpcRequest.params);
  console.log('params keys:', Object.keys(rpcRequest.params || {}));
  
  const params = rpcRequest.params || {};
  const name = params.name;
  const args = params.arguments || {};
  
  console.log('Extracted name:', name);
  console.log('Extracted args:', args);
  
  if (!name) {
    console.log('No tool name provided');
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32602,
        message: 'Tool name is required'
      }
    });
  }
  
  console.log('Processing tool:', name, 'with args:', args);
  
  try {
    let result;
    
    switch (name) {
      case 'maps.search':
        console.log('Calling searchLocationsOrbis...');
        result = await searchLocationsOrbis(args.query, args.location, args.radius);
        break;
        
      case 'maps.geocode':
        result = await geocodeAddress(args.address);
        break;
        
      case 'maps.reverse_geocode':
        result = await reverseGeocode(args.lat, args.lon);
        break;
        
      case 'maps.directions':
        result = await calculateRoute(args.origin, args.destination);
        break;
        
      case 'maps.static_map':
        result = { url: await generateStaticMapUrl(args.center, args.zoom, args.markers) };
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    console.log('Tool result:', result);
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      }
    });
    
  } catch (error) {
    console.error('Tool call error:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
}

// Main JSON-RPC handler
app.post('/', async (req, res) => {
  console.log('Received request:', JSON.stringify(req.body, null, 2));
  const { method, params, id } = req.body;
  
  try {
    switch (method) {
      case 'initialize':
        return await handleInitialize({ params, id }, res);
        
      case 'tools/list':
        return await handleToolsList({ params, id }, res);
        
      case 'tools/call':
        return await handleToolsCall({ params, id }, res);
        
      default:
        return res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        });
    }
  } catch (error) {
    console.error('Error handling request:', error);
    return res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: 'Internal error'
      }
    });
  }
});

// Implement A2A message processing for Maps Agent
a2a.processA2AMessage = async function(a2aMessage) {
  const { type, payload } = a2aMessage.message;
  
  try {
    switch (type) {
      case 'search_places':
        // Use MCP internally to call TomTom API
        return await callMCPTool('maps.search', {
          query: payload.query,
          location: payload.location,
          radius: payload.radius
        });
        
      case 'geocode_address':
        return await callMCPTool('maps.geocode', {
          address: payload.address
        });
        
      case 'reverse_geocode':
        return await callMCPTool('maps.reverse_geocode', {
          lat: payload.lat,
          lon: payload.lon
        });
        
      case 'calculate_route':
        return await callMCPTool('maps.directions', {
          origin: payload.origin,
          destination: payload.destination
        });
        
      case 'generate_static_map':
        return await callMCPTool('maps.static_map', {
          center: payload.center,
          zoom: payload.zoom,
          markers: payload.markers
        });
        
      case 'get_capabilities':
        return {
          agentId: 'maps-agent',
          agentType: 'maps',
          capabilities: [
            'place_search',
            'geocoding',
            'reverse_geocoding',
            'directions',
            'static_maps',
            'matrix_routing'
          ]
        };
        
      default:
        throw new Error(`Unknown A2A message type: ${type}`);
    }
  } catch (error) {
    console.error(`❌ A2A Processing Error (${type}):`, error.message);
    throw error;
  }
};

// Internal MCP tool call function
async function callMCPTool(toolName, args) {
  try {
    // Simulate MCP tool call internally
    switch (toolName) {
      case 'maps.search':
        return await searchLocationsOrbis(args.query, args.location, args.radius);
        
      case 'maps.geocode':
        return await geocodeAddress(args.address);
        
      case 'maps.reverse_geocode':
        return await reverseGeocode(args.lat, args.lon);
        
      case 'maps.directions':
        return await calculateRoute(args.origin, args.destination);
        
      case 'maps.static_map':
        return { url: await generateStaticMapUrl(args.center, args.zoom, args.markers) };
        
      default:
        throw new Error(`Unknown MCP tool: ${toolName}`);
    }
  } catch (error) {
    console.error(`❌ MCP Tool Error (${toolName}):`, error.message);
    throw error;
  }
}

// Start server
const actualPort = process.env.MAPS_AGENT_PORT || PORT;
app.listen(actualPort, () => {
  console.log(`🗺️  Maps Agent (MCP + A2A) running on port ${actualPort}`);
  console.log(`📍 TomTom API Key: ${TOMTOM_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🔧 MCP Tools: maps.search, maps.geocode, maps.reverse_geocode, maps.directions, maps.static_map`);
  console.log(`📡 A2A Capabilities: search_places, geocode_address, reverse_geocode, calculate_route, generate_static_map`);
  console.log(`🌐 MCP Endpoint: http://localhost:${actualPort}/`);
  console.log(`🤝 A2A Endpoint: http://localhost:${actualPort}/a2a`);
});
