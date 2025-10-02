#!/usr/bin/env node

/**
 * Mistral Le Chat MCP Server for TomTom Maps Integration
 * Configured specifically for Mistral's Le Chat interface
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

class MistralTomTomMCPServer {
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
        service: 'TomTom Maps MCP Server for Mistral Le Chat',
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        protocol: 'MCP',
        provider: 'Mistral Le Chat',
        tools: [
          'search_places',
          'geocode_address', 
          'reverse_geocode',
          'get_directions',
          'generate_static_map'
        ],
        endpoints: {
          tools: 'GET /tools',
          execute: 'POST /tools/:toolName/execute',
          health: 'GET /'
        }
      });
    });

    // MCP Tools endpoint for Mistral
    this.app.get('/tools', (req, res) => {
      res.json([
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
      ]);
    });

    // MCP Tool execution endpoint
    this.app.post('/tools/:toolName/execute', async (req, res) => {
      const { toolName } = req.params;
      const input = req.body;
      
      try {
        console.log(`🔧 Executing Mistral MCP tool: ${toolName}`);
        console.log(`📥 Input:`, JSON.stringify(input, null, 2));
        
        let result;
        switch (toolName) {
          case 'search_places':
            result = await this.searchPlaces(input);
            break;
          case 'geocode_address':
            result = await this.geocodeAddress(input);
            break;
          case 'reverse_geocode':
            result = await this.reverseGeocode(input);
            break;
          case 'get_directions':
            result = await this.getDirections(input);
            break;
          case 'generate_static_map':
            result = await this.generateStaticMap(input);
            break;
          default:
            throw new Error(`Unknown tool: ${toolName}`);
        }
        
        console.log(`✅ Tool execution successful`);
        res.json({
          success: true,
          result: result
        });
      } catch (error) {
        console.error(`❌ Tool execution failed for ${toolName}:`, error.message);
        res.status(500).json({ 
          success: false,
          error: 'Tool execution failed', 
          message: error.message 
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

  async searchPlaces(input) {
    const { query, lat, lon, radius = 5000, limit = 10 } = input;
    
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

      return {
        places: places,
        summary: `Found ${places.length} places for "${query}"`
      };
    }

    return { places: [], summary: `No places found for "${query}"` };
  }

  async geocodeAddress(input) {
    const { address, limit = 1 } = input;
    
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

      return {
        coordinates: coords,
        address: address,
        summary: `Found coordinates for "${address}"`
      };
    }

    return { coordinates: null, address: null, summary: `Could not find coordinates for "${address}"` };
  }

  async reverseGeocode(input) {
    const { lat, lon } = input;
    
    const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json`;
    const params = {
      key: this.tomtomApiKey
    };

    const response = await axios.get(url, { params });
    
    if (response.data && response.data.addresses && response.data.addresses.length > 0) {
      const address = response.data.addresses[0].address;

      return {
        address: address.freeformAddress || address.formattedAddress,
        coordinates: { lat, lon },
        summary: `Found address for coordinates ${lat}, ${lon}`
      };
    }

    return { address: null, coordinates: { lat, lon }, summary: `Could not find address for coordinates ${lat}, ${lon}` };
  }

  async getDirections(input) {
    const { from, to, travelMode = 'car' } = input;
    
    // First geocode both addresses
    const fromCoords = await this.geocodeLocation(from);
    const toCoords = await this.geocodeLocation(to);

    if (!fromCoords || !toCoords) {
      return {
        route: null,
        summary: `Could not find coordinates for one or both addresses`
      };
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

      return {
        route: {
          distance: distance,
          duration: duration,
          travelMode: travelMode,
          from: from,
          to: to
        },
        summary: `Route from ${from} to ${to}: ${distance} km, ${duration} minutes`
      };
    }

    return { route: null, summary: `Could not calculate route from ${from} to ${to}` };
  }

  async generateStaticMap(input) {
    const { center, zoom = 10, width = 400, height = 300 } = input;
    
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

    return {
      mapUrl: mapUrl,
      center: center,
      zoom: zoom,
      dimensions: { width, height },
      summary: `Generated static map centered at ${center}`
    };
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
      console.log('=== MISTRAL LE CHAT TOMTOM MCP SERVER ===');
      console.log(`📍 TomTom API Key: ${this.tomtomApiKey ? 'Configured' : 'Missing'}`);
      console.log(`🚀 Starting MCP Server on port ${this.port}`);
      console.log(`🌐 Health Check: http://localhost:${this.port}/`);
      console.log(`🔧 Tools Endpoint: http://localhost:${this.port}/tools`);
      console.log(`⚡ Execute Endpoint: http://localhost:${this.port}/tools/:toolName/execute`);
      console.log('=== MISTRAL LE CHAT MCP SERVER READY ===');
    });
  }
}

// Start the server
const server = new MistralTomTomMCPServer();
server.start();
