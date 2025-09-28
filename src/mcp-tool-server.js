#!/usr/bin/env node
/**
 * MCP Tool Server for TomTom Maps Integration
 * Follows Model Context Protocol best practices
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

class MCPToolServer {
  constructor() {
    this.app = express();
    this.port = process.env.MCP_TOOL_PORT || 3003;
    this.tomtomApiKey = process.env.TOMTOM_API_KEY;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupToolManifest();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupToolManifest() {
    this.toolManifest = {
      mcpVersion: "1.0.0",
      server: {
        name: "tomtom-maps-tools",
        version: "1.0.0"
      },
      tools: [
        {
          name: "mcp://tomtom/search",
          description: "Search for places using TomTom Orbis Search API",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              lat: { type: "number", description: "Latitude" },
              lon: { type: "number", description: "Longitude" },
              radius: { type: "number", description: "Search radius in meters", default: 5000 },
              limit: { type: "number", description: "Maximum results", default: 10 }
            },
            required: ["query", "lat", "lon"]
          },
          outputSchema: {
            type: "object",
            properties: {
              places: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    address: { type: "string" },
                    rating: { type: "number" },
                    distance: { type: "number" },
                    coordinates: {
                      type: "object",
                      properties: {
                        lat: { type: "number" },
                        lon: { type: "number" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          name: "mcp://tomtom/geocode",
          description: "Geocode an address to coordinates",
          inputSchema: {
            type: "object",
            properties: {
              address: { type: "string", description: "Address to geocode" },
              limit: { type: "number", description: "Maximum results", default: 1 }
            },
            required: ["address"]
          },
          outputSchema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    position: {
                      type: "object",
                      properties: {
                        lat: { type: "number" },
                        lon: { type: "number" }
                      }
                    },
                    address: {
                      type: "object",
                      properties: {
                        freeformAddress: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          name: "mcp://tomtom/reverse-geocode",
          description: "Reverse geocode coordinates to address",
          inputSchema: {
            type: "object",
            properties: {
              lat: { type: "number", description: "Latitude" },
              lon: { type: "number", description: "Longitude" }
            },
            required: ["lat", "lon"]
          },
          outputSchema: {
            type: "object",
            properties: {
              addresses: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    address: {
                      type: "object",
                      properties: {
                        freeformAddress: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          name: "mcp://tomtom/directions",
          description: "Calculate route between two points",
          inputSchema: {
            type: "object",
            properties: {
              origin: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lon: { type: "number" }
                },
                required: ["lat", "lon"]
              },
              destination: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lon: { type: "number" }
                },
                required: ["lat", "lon"]
              }
            },
            required: ["origin", "destination"]
          },
          outputSchema: {
            type: "object",
            properties: {
              routes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "object",
                      properties: {
                        lengthInMeters: { type: "number" },
                        travelTimeInSeconds: { type: "number" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          name: "mcp://tomtom/static-map",
          description: "Generate static map image URL",
          inputSchema: {
            type: "object",
            properties: {
              center: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lon: { type: "number" }
                },
                required: ["lat", "lon"]
              },
              zoom: { type: "number", default: 12 },
              width: { type: "number", default: 400 },
              height: { type: "number", default: 300 },
              markers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    lat: { type: "number" },
                    lon: { type: "number" },
                    label: { type: "string" }
                  }
                }
              }
            },
            required: ["center"]
          },
          outputSchema: {
            type: "object",
            properties: {
              url: { type: "string" }
            }
          }
        }
      ]
    };
  }

  setupRoutes() {
    // MCP Tool Manifest
    this.app.get('/manifest', (req, res) => {
      res.json(this.toolManifest);
    });

    // MCP Tool Discovery
    this.app.get('/tools', (req, res) => {
      res.json(this.toolManifest.tools);
    });

    // MCP Tool Execution
    this.app.post('/tools/:toolName/execute', async (req, res) => {
      const { toolName } = req.params;
      const input = req.body;

      try {
        const result = await this.executeTool(toolName, input);
        res.json({
          success: true,
          result: result,
          tool: toolName,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`Tool execution error for ${toolName}:`, error);
        res.status(500).json({
          success: false,
          error: error.message,
          tool: toolName,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'tomtom-maps-tools',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });
  }

  async executeTool(toolName, input) {
    switch (toolName) {
      case 'mcp://tomtom/search':
        return await this.searchPlaces(input);
      case 'mcp://tomtom/geocode':
        return await this.geocodeAddress(input);
      case 'mcp://tomtom/reverse-geocode':
        return await this.reverseGeocode(input);
      case 'mcp://tomtom/directions':
        return await this.calculateRoute(input);
      case 'mcp://tomtom/static-map':
        return await this.generateStaticMap(input);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  async searchPlaces(input) {
    const { query, lat, lon, radius = 5000, limit = 10 } = input;
    
    console.log('🔍 MCP searchPlaces called with:', { query, lat, lon, radius, limit });
    console.log('🔑 TomTom API Key available:', !!this.tomtomApiKey);
    console.log('🔑 TomTom API Key length:', this.tomtomApiKey?.length);
    
    try {
      // Use the same Search API that works locally
      const url = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json`;
      
      const params = {
        key: this.tomtomApiKey,
        limit: limit,
        geobias: `point:${lat},${lon}` // Use geobias instead of lat/lon/radius
      };

      console.log('🌐 MCP Search URL:', url);
      console.log('📋 MCP Search params:', params);
      
      const response = await axios.get(url, { params });
      
      console.log('✅ MCP Search response status:', response.status);
      console.log('📊 MCP Search response data keys:', Object.keys(response.data || {}));
      console.log('🔢 MCP Search results count:', response.data?.results?.length || 0);
      
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
        
        console.log('🎯 MCP Search returning places:', places.length);
        return { places };
      }

      console.log('⚠️ MCP Search no results found');
      return { places: [] };
    } catch (error) {
      console.error('❌ MCP Search error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
      throw new Error(`Search failed: ${error.response?.data?.detailedError?.message || error.message}`);
    }
  }

  async geocodeAddress(input) {
    const { address, limit = 1 } = input;
    const encodedAddress = encodeURIComponent(address);
    const url = `https://api.tomtom.com/search/2/geocode/${encodedAddress}.json`;
    
    const params = {
      key: this.tomtomApiKey,
      limit: limit
    };

    const response = await axios.get(url, { params });
    
    if (response.data && response.data.results) {
      return {
        results: response.data.results.map(result => ({
          position: result.position,
          address: result.address
        }))
      };
    }

    return { results: [] };
  }

  async reverseGeocode(input) {
    const { lat, lon } = input;
    const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json`;
    
    const params = {
      key: this.tomtomApiKey
    };

    const response = await axios.get(url, { params });
    
    if (response.data && response.data.addresses) {
      return {
        addresses: response.data.addresses.map(addr => ({
          address: addr.address
        }))
      };
    }

    return { addresses: [] };
  }

  async calculateRoute(input) {
    const { origin, destination } = input;
    const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin.lat},${origin.lon}:${destination.lat},${destination.lon}/json`;
    
    const params = {
      key: this.tomtomApiKey,
      instructionsType: 'text',
      language: 'en-US'
    };

    const response = await axios.get(url, { params });
    
    if (response.data && response.data.routes) {
      return {
        routes: response.data.routes.map(route => ({
          summary: route.summary
        }))
      };
    }

    return { routes: [] };
  }

  async generateStaticMap(input) {
    const { center, zoom = 12, width = 400, height = 300, markers = [] } = input;
    
    let url = `https://api.tomtom.com/map/1/staticimage?key=${this.tomtomApiKey}`;
    url += `&center=${center.lat},${center.lon}`;
    url += `&zoom=${zoom}`;
    url += `&width=${width}`;
    url += `&height=${height}`;
    url += `&format=png`;

    if (markers.length > 0) {
      const markerStr = markers.map(m => `${m.lat},${m.lon},${m.label || 'marker'}`).join('|');
      url += `&markers=${encodeURIComponent(markerStr)}`;
    }

    return { url };
  }

  start() {
    this.app.listen(this.port, () => {
      console.log(`🔧 MCP Tool Server running on port ${this.port}`);
      console.log(`📋 Tool manifest: http://localhost:${this.port}/manifest`);
      console.log(`🛠️  Available tools: http://localhost:${this.port}/tools`);
      console.log(`❤️  Health check: http://localhost:${this.port}/health`);
    });
  }
}

// Start the server if run directly
if (require.main === module) {
  const server = new MCPToolServer();
  server.start();
}

module.exports = MCPToolServer;
