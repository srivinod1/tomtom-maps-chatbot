// src/mcp-server.js
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
              maps: {
                search: true,
                directions: true,
                staticMap: true,
                geocode: true,
                reverseGeocode: true,
                matrix: true
              }
            },
            serverInfo: {
              name: 'tomtom-mcp-server',
              version: '1.0.0'
            }
          }
        });
      
      case 'maps.search':
        return await handleMapSearch(rpcRequest, res);
      
      case 'maps.directions':
        return await handleMapDirections(rpcRequest, res);
      
      case 'maps.staticMap':
        return await handleStaticMap(rpcRequest, res);
      
      case 'maps.geocode':
        return await handleGeocode(rpcRequest, res);
      
      case 'maps.reverseGeocode':
        return await handleReverseGeocode(rpcRequest, res);
      
      case 'maps.matrix':
        return await handleMatrix(rpcRequest, res);
      
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

// Start MCP server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.error(`TomTom Maps MCP Server listening at http://localhost:${port}`);
});