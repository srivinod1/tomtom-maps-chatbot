#!/usr/bin/env node
/**
 * Maps Agent - Dedicated TomTom Maps MCP Server
 * Handles all location-based queries and TomTom API interactions
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

// Constants for TomTom API
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;
const TOMTOM_ORBIS_SEARCH_URL = 'https://api.tomtom.com/maps/orbis/places/nearbySearch';
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

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Maps Agent - TomTom MCP Server',
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
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

// Start server
const actualPort = process.env.MAPS_AGENT_PORT || PORT;
app.listen(actualPort, () => {
  console.log(`🗺️  Maps Agent running on port ${actualPort}`);
  console.log(`📍 TomTom API Key: ${TOMTOM_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🔧 Available tools: search, geocode, reverse_geocode, directions, static_map`);
});
