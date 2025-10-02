#!/usr/bin/env node

/**
 * Proper MCP Server for Mistral Le Chat Integration
 * Follows the Model Context Protocol specification as per Mistral's documentation
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
require('dotenv').config();

class MistralTomTomMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'tomtom-maps-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.tomtomApiKey = process.env.TOMTOM_API_KEY;
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools - this is what Le Chat will discover
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
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
      };
    });

    // Handle tool calls - this is what Le Chat will execute
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_places':
            return await this.searchPlaces(args);
          case 'geocode_address':
            return await this.geocodeAddress(args);
          case 'reverse_geocode':
            return await this.reverseGeocode(args);
          case 'get_directions':
            return await this.getDirections(args);
          case 'generate_static_map':
            return await this.generateStaticMap(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        };
      }
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

      return {
        content: [
          {
            type: 'text',
            text: `Found ${places.length} places for "${query}":\n\n` +
                  places.map((place, index) => 
                    `${index + 1}. **${place.name}**\n   📍 ${place.address}\n   📏 ${place.distance} km away\n`
                  ).join('\n')
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `No places found for "${query}"`
        }
      ]
    };
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

      return {
        content: [
          {
            type: 'text',
            text: `📍 **${address}**\n\n**Coordinates:**\n- Latitude: ${coords.lat}\n- Longitude: ${coords.lon}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Could not find coordinates for "${address}"`
        }
      ]
    };
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

      return {
        content: [
          {
            type: 'text',
            text: `📍 **${address.freeformAddress || address.formattedAddress}**\n\n**Coordinates:** ${lat}, ${lon}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Could not find address for coordinates ${lat}, ${lon}`
        }
      ]
    };
  }

  async getDirections(args) {
    const { from, to, travelMode = 'car' } = args;
    
    // First geocode both addresses
    const fromCoords = await this.geocodeLocation(from);
    const toCoords = await this.geocodeLocation(to);

    if (!fromCoords || !toCoords) {
      return {
        content: [
          {
            type: 'text',
            text: `Could not find coordinates for one or both addresses`
          }
        ]
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
        content: [
          {
            type: 'text',
            text: `🚗 **Directions from ${from} to ${to}**\n\n` +
                  `📏 **Distance:** ${distance} km\n` +
                  `⏱️ **Duration:** ${duration} minutes\n` +
                  `🚗 **Travel Mode:** ${travelMode}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Could not calculate route from ${from} to ${to}`
        }
      ]
    };
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

    return {
      content: [
        {
          type: 'text',
          text: `🗺️ **Static Map Generated**\n\n**Center:** ${center}\n**Zoom:** ${zoom}\n**Size:** ${width}x${height}\n\n![Map](${mapUrl})`
        }
      ]
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('TomTom MCP Server running on stdio for Mistral Le Chat');
  }
}

// Start the server
const server = new MistralTomTomMCPServer();
server.run().catch(console.error);
