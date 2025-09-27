// src/tomtom-maps/index.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// TomTom API endpoint constants for Orbis Maps and other APIs
const TOMTOM_ORBIS_SEARCH_URL = 'https://api.tomtom.com/maps/orbis/places/nearbySearch';
const TOMTOM_GEOCODING_URL = 'https://api.tomtom.com/search/2/geocode';
const TOMTOM_REVERSE_GEOCODING_URL = 'https://api.tomtom.com/search/2/reverseGeocode';
const TOMTOM_STATICMAP_URL = 'https://api.tomtom.com/map/1/staticimage';
const TOMTOM_ROUTING_URL = 'https://api.tomtom.com/maps/orbis/routing/calculateRoute';
const TOMTOM_MATRIX_ROUTING_URL = 'https://api.tomtom.com/routing/matrix/2';

// Get TomTom API key from environment variable
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;

if (!TOMTOM_API_KEY) {
  console.error('Error: TOMTOM_API_KEY environment variable not set');
}

/**
 * Search locations using TomTom Orbis Maps Search API
 * @param {string} query - Search query
 * @param {string} type - Type of location (e.g., 'restaurant', 'hotel', etc.)
 * @param {Object} location - User's current location {lat, lon}
 * @returns {Promise<Object>} - TomTom search response
 */
async function searchLocationsOrbis(query, type, location) {
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
        radius: 10000 // 10km radius, can be configurable
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

    return response.data;
  } catch (error) {
    console.error('Error searching TomTom Orbis:', error);
    throw error;
  }
}

/**
 * Geocode an address using TomTom Geocoding API
 * @param {string} address - Address to geocode
 * @returns {Promise<Object>} - TomTom geocoding response
 */
async function geocodeAddress(address) {
  try {
    const response = await axios.get(`${TOMTOM_GEOCODING_URL}/${encodeURIComponent(address)}.json`, {
      params: {
        key: TOMTOM_API_KEY,
        language: 'en-US'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error geocoding address with TomTom:', error);
    throw error;
  }
}

/**
 * Reverse geocode coordinates using TomTom Reverse Geocoding API
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - TomTom reverse geocoding response
 */
async function reverseGeocode(lat, lon) {
  try {
    const response = await axios.get(`${TOMTOM_REVERSE_GEOCODING_URL}/${lat},${lon}`, {
      params: {
        key: TOMTOM_API_KEY,
        language: 'en-US'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error reverse geocoding with TomTom:', error);
    throw error;
  }
}

/**
 * Map place types to TomTom categories
 * @param {string} type - Place type
 * @returns {string} - TomTom category ID
 */
function mapTypeToCategory(type) {
  // TomTom Search API v2 uses category sets
  const categoryMap = {
    'restaurant': '7315',
    'hotel': '7314',
    'airport': '4581',
    'hospital': '7321',
    'shopping': '7376',
    'museum': '7317',
    'park': '9362',
    'cinema': '7342',
    'gas_station': '7311',
    'bank': '7310',
    'atm': '7310',
    'pharmacy': '7316',
    'school': '7370',
    'university': '7370',
    // Add more mappings as needed
  };

  return categoryMap[type.toLowerCase()] || '';
}

/**
 * Generate a static map image URL for a location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} zoom - Zoom level (1-22)
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {string} - TomTom static map URL
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
    view: 'Unified', // Unified is the style that combines roads, buildings and labels
  });

  return `${TOMTOM_STATICMAP_URL}?${params.toString()}`;
}

/**
 * Calculate route between two points using TomTom Orbis Maps Routing API
 * @param {Object} origin - Origin coordinates {lat, lon}
 * @param {Object} destination - Destination coordinates {lat, lon}
 * @param {string} travelMode - Mode of travel (e.g., 'car', 'pedestrian', 'bicycle')
 * @returns {Promise<Object>} - TomTom routing response
 */
async function calculateRoute(origin, destination, travelMode = 'car') {
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
    const requestParams = {
      key: TOMTOM_API_KEY,
      // Origin and destination coordinates
      origin: `${origin.lat},${origin.lon}`,
      destination: `${destination.lat},${destination.lon}`,
      // Travel mode
      travelMode: vehicleMode,
      // Additional options
      traffic: 'live',
      routeType: 'efficient'
    };

    const response = await axios.get(`${TOMTOM_ROUTING_URL}/${requestParams.origin}:${requestParams.destination}/json`, {
      params: {
        key: requestParams.key,
        apiVersion: '2',
        travelMode: requestParams.travelMode,
        traffic: requestParams.traffic,
        routeType: 'efficient'
      },
      headers: {
        'TomTom-Api-Version': '2'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error calculating route with TomTom Orbis:', error);
    throw error;
  }
}

/**
 * Calculate a distance matrix using TomTom Matrix Routing API
 * @param {Array} origins - Array of origin coordinates [{lat, lon}, ...]
 * @param {Array} destinations - Array of destination coordinates [{lat, lon}, ...]
 * @param {string} travelMode - Mode of travel (e.g., 'car', 'pedestrian', 'bicycle')
 * @returns {Promise<Object>} - TomTom matrix routing response
 */
async function calculateMatrix(origins, destinations, travelMode = 'car') {
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

    return response.data;
  } catch (error) {
    console.error('Error calculating matrix with TomTom:', error);
    throw error;
  }
}

/**
 * Format TomTom Orbis search results to MCP format
 * @param {Object} results - TomTom Orbis search results
 * @returns {Object} - MCP formatted results
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
 * @param {Object} geocodeData - TomTom geocoding results
 * @returns {Object} - MCP formatted geocoding results
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
 * @param {Object} reverseData - TomTom reverse geocoding results
 * @returns {Object} - MCP formatted reverse geocoding results
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
 * @param {Object} routeData - TomTom routing results
 * @returns {Object} - MCP formatted routing results
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
 * @param {Object} matrixData - TomTom Matrix Routing results
 * @returns {Object} - MCP formatted matrix results
 */
function formatMatrixResults(matrixData) {
  if (!matrixData.data || !Array.isArray(matrixData.data)) {
    return { rows: [] };
  }

  // Format the response similar to TomTom Distance Matrix API format
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

// Routes implementation

/**
 * Search endpoint using Orbis Maps Search API
 */
router.post('/search', async (req, res) => {
  try {
    const { query, type, location } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const results = await searchLocationsOrbis(query, type, location);
    const formattedResults = formatOrbisSearchResults(results);
    
    res.json(formattedResults);
  } catch (error) {
    console.error('Error in /search:', error);
    res.status(500).json({ error: 'Failed to search locations' });
  }
});

/**
 * Geocoding endpoint
 */
router.post('/geocode', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address parameter is required' });
    }

    const geocodeData = await geocodeAddress(address);
    const formattedResults = formatGeocodeResults(geocodeData);
    
    res.json(formattedResults);
  } catch (error) {
    console.error('Error in /geocode:', error);
    res.status(500).json({ error: 'Failed to geocode address' });
  }
});

/**
 * Reverse geocoding endpoint
 */
router.post('/reversegeocode', async (req, res) => {
  try {
    const { lat, lon } = req.body;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Lat and lon parameters are required' });
    }

    const reverseData = await reverseGeocode(lat, lon);
    const formattedResults = formatReverseGeocodeResults(reverseData);
    
    res.json(formattedResults);
  } catch (error) {
    console.error('Error in /reversegeocode:', error);
    res.status(500).json({ error: 'Failed to reverse geocode coordinates' });
  }
});

/**
 * Route calculation endpoint using Orbis API
 */
router.post('/directions', async (req, res) => {
  try {
    const { origin, destination, travelMode } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }

    const routeData = await calculateRoute(origin, destination, travelMode);
    const formattedRoute = formatRouteResults(routeData);
    
    res.json(formattedRoute);
  } catch (error) {
    console.error('Error in /directions:', error);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});

/**
 * Static map endpoint
 */
router.post('/staticmap', async (req, res) => {
  try {
    const { lat, lon, zoom, width, height } = req.body;
    
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Lat and lon are required' });
    }

    const mapUrl = generateStaticMapUrl(lat, lon, zoom, width, height);
    
    res.json({ url: mapUrl });
  } catch (error) {
    console.error('Error in /staticmap:', error);
    res.status(500).json({ error: 'Failed to generate static map' });
  }
});

/**
 * Matrix routing endpoint
 */
router.post('/matrix', async (req, res) => {
  try {
    const { origins, destinations, travelMode } = req.body;
    
    if (!origins || !destinations || !Array.isArray(origins) || !Array.isArray(destinations)) {
      return res.status(400).json({ error: 'Origins and destinations arrays are required' });
    }

    if (origins.length === 0 || destinations.length === 0) {
      return res.status(400).json({ error: 'Origins and destinations cannot be empty' });
    }

    if (origins.length > 50 || destinations.length > 50) {
      return res.status(400).json({ error: 'Maximum of 50 origins or destinations allowed' });
    }

    const matrixData = await calculateMatrix(origins, destinations, travelMode);
    const formattedMatrix = formatMatrixResults(matrixData);
    
    res.json(formattedMatrix);
  } catch (error) {
    console.error('Error in /matrix:', error);
    res.status(500).json({ error: 'Failed to calculate distance matrix' });
  }
});

module.exports = router;