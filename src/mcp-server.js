// src/mcp-server.js
// Multi-Agent MCP Server with TomTom Maps Integration
const express = require('express');
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
const TOMTOM_MATRIX_ROUTING_URL = 'https://api.tomtom.com/routing/matrix/2';

// Check for API key
if (!TOMTOM_API_KEY) {
  console.error('Error: TOMTOM_API_KEY environment variable not set');
  process.exit(1);
}

// Create MCP server
const app = express();
app.use(bodyParser.json());

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.json({
    service: 'Multi-Agent TomTom Maps MCP Server',
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      orchestrator: 'POST / (JSON-RPC)',
      health: 'GET /'
    }
  });
});

// Regular REST API endpoints (for direct testing)
app.use('/api/tomtom', require('./tomtom-maps'));

// Main MCP JSON-RPC endpoint
app.post('/', async (req, res) => {
  const rpcRequest = req.body;
  console.error('Received MCP request:', JSON.stringify(rpcRequest, null, 2));
  
  // Handle different MCP methods
  try {
    switch (rpcRequest.method) {
      case 'initialize':
        return res.json({
          jsonrpc: '2.0',
          id: rpcRequest.id,
          result: {
            capabilities: {
              orchestrator: {
                chat: true,
                capabilities: true,
                context: true
              }
            },
            serverInfo: {
              name: 'multi-agent-tomtom-mcp-server',
              version: '2.0.0',
              description: 'Multi-agent MCP server with TomTom Maps integration'
            }
          }
        });
      
      case 'orchestrator.chat':
        return await handleOrchestratorChat(rpcRequest, res);
      
      case 'orchestrator.capabilities':
        return await handleOrchestratorCapabilities(rpcRequest, res);
      
      case 'orchestrator.context':
        return await handleOrchestratorContext(rpcRequest, res);
      
      default:
        return res.json({
          jsonrpc: '2.0',
          id: rpcRequest.id,
          error: {
            code: -32601,
            message: `Method ${rpcRequest.method} not implemented`
          }
        });
    }
  } catch (error) {
    console.error('Error handling RPC request:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      }
    });
  }
});

// Handle maps.search
async function handleMapSearch(rpcRequest, res) {
  const { query, location, type } = rpcRequest.params;
  
  try {
    // Prepare request body for Orbis Search API
    const requestBody = {
      query: query,
      options: {
        language: 'en-US'
      }
    };

    // Add location search bias if location is provided
    if (location && location.lat && location.lon) {
      requestBody.options.bias = {
        point: {
          latitude: location.lat,
          longitude: location.lon
        },
        radius: 10000 // 10km radius
      };
    }

    // Add category if type is provided
    if (type) {
      requestBody.options.filter = {
        categories: [mapTypeToCategory(type)]
      };
    }

    const response = await axios.get(`${TOMTOM_ORBIS_SEARCH_URL}/.json`, {
      params: {
        key: TOMTOM_API_KEY,
        apiVersion: '1',
        lat: location ? location.lat : undefined,
        lon: location ? location.lon : undefined,
        query: query
      }
    });

    // Format the results
    const formattedResults = formatOrbisSearchResults(response.data);
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: formattedResults
    });
  } catch (error) {
    console.error('Error in maps.search:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Search failed: ${error.message}`
      }
    });
  }
}

// Handle maps.directions
async function handleMapDirections(rpcRequest, res) {
  const { origin, destination, travelMode } = rpcRequest.params;
  
  try {
    // Map travel mode to TomTom Orbis mode
    const vehicleMode = {
      'car': 'car',
      'pedestrian': 'pedestrian',
      'bicycle': 'bicycle',
      'truck': 'truck',
      'taxi': 'taxi',
      'bus': 'bus',
      'van': 'van',
      'motorcycle': 'motorcycle'
    }[travelMode] || 'car';

    // Prepare the request parameters for TomTom Routing API v2
    const requestData = {
      // Origin and destination coordinates
      origin: `${origin.lat},${origin.lon}`,
      destination: `${destination.lat},${destination.lon}`,
      // Travel mode
      travelMode: vehicleMode,
      // Additional options
      traffic: 'live',
      routeType: 'efficient'
    };

    const response = await axios.get(`${TOMTOM_ROUTING_URL}/${requestData.origin}:${requestData.destination}/json`, {
      params: {
        key: TOMTOM_API_KEY,
        apiVersion: '2',
        travelMode: requestData.travelMode,
        traffic: requestData.traffic,
        routeType: 'efficient'
      },
      headers: {
        'TomTom-Api-Version': '2'
      }
    });

    // Format the results
    const formattedResults = formatRouteResults(response.data);
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: formattedResults
    });
  } catch (error) {
    console.error('Error in maps.directions:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Directions failed: ${error.message}`
      }
    });
  }
}

// Handle maps.staticMap
async function handleStaticMap(rpcRequest, res) {
  const { lat, lon, zoom, width, height } = rpcRequest.params;
  
  try {
    const mapUrl = generateStaticMapUrl(lat, lon, zoom || 15, width || 512, height || 512);
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: { url: mapUrl }
    });
  } catch (error) {
    console.error('Error in maps.staticMap:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Static map generation failed: ${error.message}`
      }
    });
  }
}

// Handle maps.geocode
async function handleGeocode(rpcRequest, res) {
  const { address } = rpcRequest.params;
  
  try {
    const response = await axios.get(`${TOMTOM_GEOCODING_URL}/${encodeURIComponent(address)}.json`, {
      params: {
        key: TOMTOM_API_KEY,
        language: 'en-US'
      }
    });

    // Format the results
    const formattedResults = formatGeocodeResults(response.data);
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: formattedResults
    });
  } catch (error) {
    console.error('Error in maps.geocode:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Geocoding failed: ${error.message}`
      }
    });
  }
}

// Handle maps.reverseGeocode
async function handleReverseGeocode(rpcRequest, res) {
  const { lat, lon } = rpcRequest.params;
  
  try {
    const response = await axios.get(`${TOMTOM_REVERSE_GEOCODING_URL}/${lat},${lon}`, {
      params: {
        key: TOMTOM_API_KEY,
        language: 'en-US'
      }
    });

    // Format the results
    const formattedResults = formatReverseGeocodeResults(response.data);
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: formattedResults
    });
  } catch (error) {
    console.error('Error in maps.reverseGeocode:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Reverse geocoding failed: ${error.message}`
      }
    });
  }
}

// Handle maps.matrix
async function handleMatrix(rpcRequest, res) {
  const { origins, destinations, travelMode } = rpcRequest.params;
  
  try {
    // Map travel mode to TomTom's supported modes
    const routingMode = {
      'car': 'car',
      'pedestrian': 'pedestrian',
      'bicycle': 'bicycle',
      'truck': 'truck',
      'taxi': 'taxi',
      'bus': 'bus',
      'van': 'van',
      'motorcycle': 'motorcycle'
    }[travelMode] || 'car';

    // Format origins and destinations for the Matrix API
    const formattedOrigins = origins.map(point => ({
      point: {
        latitude: point.lat,
        longitude: point.lon
      }
    }));

    const formattedDestinations = destinations.map(point => ({
      point: {
        latitude: point.lat,
        longitude: point.lon
      }
    }));

    // Prepare the request payload
    const requestData = {
      origins: formattedOrigins,
      destinations: formattedDestinations,
      options: {
        travelMode: routingMode
      }
    };

    const response = await axios.post(TOMTOM_MATRIX_ROUTING_URL, requestData, {
      headers: {
        'Content-Type': 'application/json'
      },
      params: {
        key: TOMTOM_API_KEY
      }
    });

    // Format the results
    const formattedResults = formatMatrixResults(response.data);
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: formattedResults
    });
  } catch (error) {
    console.error('Error in maps.matrix:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Matrix calculation failed: ${error.message}`
      }
    });
  }
}

// Helper Functions

/**
 * Map place types to TomTom categories
 */
function mapTypeToCategory(type) {
  const categoryMap = {
    'restaurant': '7315',
    'hotel': '7314',
    'airport': '4581',
    'hospital': '7321',
    'shopping': '7376',
    'museum': '7317',
    'park': '9362',
    'cinema': '7342',
  };

  return categoryMap[type.toLowerCase()] || '';
}

/**
 * Generate a static map image URL for a location
 */
function generateStaticMapUrl(lat, lon, zoom = 15, width = 512, height = 512) {
  const params = new URLSearchParams({
    key: TOMTOM_API_KEY,
    center: `${lon},${lat}`,
    zoom: zoom,
    width: width,
    height: height,
    format: 'png',
    markers: `color:red|${lon},${lat}`,
    view: 'Unified',
  });

  return `${TOMTOM_STATICMAP_URL}?${params.toString()}`;
}

/**
 * Format TomTom Orbis search results to MCP format
 */
function formatOrbisSearchResults(results) {
  if (!results.results || !Array.isArray(results.results)) {
    return { places: [] };
  }

  return {
    places: results.results.map(place => {
      const address = place.address || {};
      const position = place.position || {};
      
      return {
        name: place.poi?.name || address.freeformAddress || 'Unknown Place',
        formatted_address: address.freeformAddress || '',
        location: {
          lat: position.lat || 0,
          lng: position.lon || 0
        },
        types: place.poi?.categories || [],
        place_id: place.id || '',
        rating: place.poi?.rating || 0,
        user_ratings_total: place.poi?.reviewCount || 0,
        vicinity: address.streetName || '',
        opening_hours: {
          open_now: place.poi?.openingHours?.isOpen || false
        },
        static_map_url: position ? generateStaticMapUrl(position.lat, position.lon) : ''
      };
    })
  };
}

/**
 * Format TomTom geocoding results to MCP format
 */
function formatGeocodeResults(geocodeData) {
  if (!geocodeData.results || !Array.isArray(geocodeData.results) || geocodeData.results.length === 0) {
    return { results: [] };
  }

  return {
    results: geocodeData.results.map(result => {
      const position = result.position || {};
      const address = result.address || {};
      
      return {
        formatted_address: address.freeformAddress || '',
        geometry: {
          location: {
            lat: position.lat || 0,
            lng: position.lon || 0
          }
        },
        place_id: result.id || '',
        types: [result.type || '']
      };
    })
  };
}

/**
 * Format TomTom reverse geocoding results to MCP format
 */
function formatReverseGeocodeResults(reverseData) {
  if (!reverseData.addresses || !Array.isArray(reverseData.addresses) || reverseData.addresses.length === 0) {
    return { results: [] };
  }

  return {
    results: reverseData.addresses.map(address => {
      const position = address.position || {};
      const addressDetails = address.address || {};
      
      return {
        formatted_address: addressDetails.freeformAddress || '',
        geometry: {
          location: {
            lat: position.lat || 0,
            lng: position.lon || 0
          }
        },
        place_id: address.id || '',
        types: [address.type || ''],
        address_components: [
          { long_name: addressDetails.streetNumber || '', short_name: addressDetails.streetNumber || '', types: ['street_number'] },
          { long_name: addressDetails.streetName || '', short_name: addressDetails.streetName || '', types: ['route'] },
          { long_name: addressDetails.municipality || '', short_name: addressDetails.municipality || '', types: ['locality'] },
          { long_name: addressDetails.postalCode || '', short_name: addressDetails.postalCode || '', types: ['postal_code'] },
          { long_name: addressDetails.countrySubdivision || '', short_name: addressDetails.countrySubdivisionCode || '', types: ['administrative_area_level_1'] },
          { long_name: addressDetails.country || '', short_name: addressDetails.countryCode || '', types: ['country'] }
        ]
      };
    })
  };
}

/**
 * Format TomTom routing results to MCP format
 */
function formatRouteResults(routeData) {
  if (!routeData.routes || !Array.isArray(routeData.routes) || routeData.routes.length === 0) {
    return { routes: [] };
  }

  const route = routeData.routes[0];
  const summary = route.summary;
  const legs = route.legs || [];

  return {
    routes: [{
      summary: {
        distance: {
          text: `${(summary.lengthInMeters / 1000).toFixed(1)} km`,
          value: summary.lengthInMeters
        },
        duration: {
          text: `${Math.round(summary.travelTimeInSeconds / 60)} mins`,
          value: summary.travelTimeInSeconds
        }
      },
      legs: legs.map(leg => ({
        distance: {
          text: `${(leg.summary.lengthInMeters / 1000).toFixed(1)} km`,
          value: leg.summary.lengthInMeters
        },
        duration: {
          text: `${Math.round(leg.summary.travelTimeInSeconds / 60)} mins`,
          value: leg.summary.travelTimeInSeconds
        },
        steps: leg.points ? leg.points.map((point, index) => ({
          distance: { text: "", value: 0 },
          duration: { text: "", value: 0 },
          end_location: {
            lat: point.latitude,
            lng: point.longitude
          },
          start_location: {
            lat: index > 0 ? leg.points[index - 1].latitude : point.latitude,
            lng: index > 0 ? leg.points[index - 1].longitude : point.longitude
          },
          instructions: ""
        })) : []
      }))
    }]
  };
}

/**
 * Format TomTom Matrix Routing results to MCP format
 */
function formatMatrixResults(matrixData) {
  if (!matrixData.data || !Array.isArray(matrixData.data)) {
    return { rows: [] };
  }

  return {
    rows: [{
      elements: matrixData.data.map(destinationData => {
        // Handle cases where a route might not be possible
        if (!destinationData.routeSummary) {
          return {
            status: 'NOT_FOUND',
            distance: { value: null, text: 'N/A' },
            duration: { value: null, text: 'N/A' }
          };
        }

        const summary = destinationData.routeSummary;
        return {
          status: 'OK',
          distance: {
            value: summary.lengthInMeters,
            text: `${(summary.lengthInMeters / 1000).toFixed(1)} km`
          },
          duration: {
            value: summary.travelTimeInSeconds,
            text: `${Math.round(summary.travelTimeInSeconds / 60)} mins`
          },
          duration_in_traffic: {
            value: summary.trafficDelayInSeconds ? summary.travelTimeInSeconds + summary.trafficDelayInSeconds : summary.travelTimeInSeconds,
            text: summary.trafficDelayInSeconds ?
              `${Math.round((summary.travelTimeInSeconds + summary.trafficDelayInSeconds) / 60)} mins` :
              `${Math.round(summary.travelTimeInSeconds / 60)} mins`
          }
        };
      })
    }]
  };
}

// Multi-Agent System State
let conversationHistory = [];
let userContexts = {};

// Orchestrator Chat Handler
async function handleOrchestratorChat(rpcRequest, res) {
  try {
    const { message, user_id = 'default', use_llm = false } = rpcRequest.params;
    
    if (!message) {
      return res.json({
        jsonrpc: '2.0',
        id: rpcRequest.id,
        error: {
          code: -32602,
          message: 'Message parameter is required'
        }
      });
    }
    
    // Store user message
    conversationHistory.push({
      timestamp: new Date().toISOString(),
      user_id,
      type: 'user',
      message
    });
    
    // Simple agent routing logic
    let response = '';
    let agent_used = '';
    let query_type = 'general';
    
    // Check if it's a location query
    const locationKeywords = ['where', 'location', 'address', 'place', 'find', 'search', 'near', 'nearby', 'directions', 'route', 'coordinates', 'geocode'];
    const isLocationQuery = locationKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    if (isLocationQuery) {
      agent_used = 'maps_agent';
      query_type = 'location';
      
      // Handle location queries by calling TomTom APIs internally
      if (message.toLowerCase().includes('search') || message.toLowerCase().includes('find')) {
        // Extract search parameters and call TomTom search
        const searchQuery = message.replace(/find|search|near|me/gi, '').trim();
        try {
          const searchResult = await handleMapSearch({
            params: {
              query: searchQuery || 'places',
              location: { lat: 47.6062, lon: -122.3321 } // Default to Seattle
            }
          }, { json: () => ({}) });
          
          if (searchResult && searchResult.places && searchResult.places.length > 0) {
            response = `I found ${searchResult.places.length} places for "${searchQuery}":\n\n`;
            searchResult.places.slice(0, 3).forEach((place, index) => {
              response += `${index + 1}. **${place.name}**\n`;
              response += `   📍 ${place.formatted_address}\n`;
              if (place.rating > 0) response += `   ⭐ ${place.rating}/5\n`;
              response += '\n';
            });
          } else {
            response = `I couldn't find any places for "${searchQuery}". Try a different search term or location.`;
          }
        } catch (error) {
          response = `I can help you search for places, but I need more specific information. What are you looking for?`;
        }
      } else if (message.toLowerCase().includes('directions') || message.toLowerCase().includes('route')) {
        response = 'I can help you get directions! Please provide both your starting location and destination. For example: "How do I get from Seattle to Portland?"';
      } else if (message.toLowerCase().includes('coordinates') || message.toLowerCase().includes('address')) {
        response = 'I can help you find coordinates for addresses or addresses for coordinates. Please provide the specific address or coordinates you need.';
      } else {
        response = `I can help you with location-based queries using TomTom Maps. You asked: "${message}". I can search for places, get directions, find coordinates, and more. What would you like to do?`;
      }
    } else {
      agent_used = 'general_ai_agent';
      query_type = 'general';
      
      // Simple general responses
      if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
        response = 'Hello! I\'m your multi-agent assistant. I can help you with location searches, directions, geocoding, and general questions. What would you like to know?';
      } else if (message.toLowerCase().includes('help')) {
        response = 'I can help you with:\n- Location searches using TomTom Maps\n- Getting directions between places\n- Finding coordinates for addresses\n- General questions and conversation\n\nWhat would you like to do?';
      } else {
        response = `I understand you're asking: "${message}". I can help with location-based queries using TomTom Maps or answer general questions. Could you be more specific about what you need?`;
      }
    }
    
    // Store assistant response
    conversationHistory.push({
      timestamp: new Date().toISOString(),
      user_id,
      type: 'assistant',
      message: response,
      metadata: {
        agent_used,
        query_type
      }
    });
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: {
        response,
        agent_used,
        query_type,
        timestamp: new Date().toISOString(),
        success: true
      }
    });
    
  } catch (error) {
    console.error('Error in agent chat:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      }
    });
  }
}

// Orchestrator Capabilities Handler
async function handleOrchestratorCapabilities(rpcRequest, res) {
  try {
    const capabilities = {
      orchestrator: {
        description: 'Multi-agent orchestrator that coordinates specialized agents',
        capabilities: [
          'natural_language_processing',
          'query_routing',
          'agent_coordination',
          'response_synthesis'
        ]
      },
      available_services: {
        location_services: [
          'place_search',
          'geocoding',
          'reverse_geocoding',
          'directions',
          'static_maps',
          'matrix_routing'
        ],
        general_services: [
          'conversation',
          'help_queries',
          'context_management'
        ]
      },
      mcp_methods: [
        'orchestrator.chat',
        'orchestrator.capabilities',
        'orchestrator.context'
      ]
    };
    
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      result: capabilities
    });
    
  } catch (error) {
    console.error('Error in agent capabilities:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      }
    });
  }
}

// Orchestrator Context Handler
async function handleOrchestratorContext(rpcRequest, res) {
  try {
    const { user_id = 'default', context, action = 'get' } = rpcRequest.params;
    
    if (action === 'set' && context) {
      if (!userContexts[user_id]) {
        userContexts[user_id] = {};
      }
      userContexts[user_id] = { ...userContexts[user_id], ...context };
      
      return res.json({
        jsonrpc: '2.0',
        id: rpcRequest.id,
        result: {
          status: 'success',
          message: 'Context updated',
          context: userContexts[user_id]
        }
      });
    } else {
      return res.json({
        jsonrpc: '2.0',
        id: rpcRequest.id,
        result: {
          context: userContexts[user_id] || {}
        }
      });
    }
    
  } catch (error) {
    console.error('Error in agent context:', error);
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32603,
        message: `Internal error: ${error.message}`
      }
    });
  }
}

// Start MCP server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.error(`Multi-Agent TomTom Maps MCP Server listening at http://localhost:${port}`);
});