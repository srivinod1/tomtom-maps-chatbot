#!/usr/bin/env node
/**
 * Writer Agent - Content synthesis and response formatting
 * Purpose: Turn structured evidence into user-facing draft with citations
 */

const A2AProtocol = require('../a2a-protocol');

class WriterAgent {
  constructor(agentId, baseUrl) {
    this.agentId = agentId;
    this.baseUrl = baseUrl;
    this.a2a = new A2AProtocol(agentId, 'writer', baseUrl);
    this.setupMessageHandlers();
  }

  setupMessageHandlers() {
    this.a2a.processA2AMessage = async (a2aMessage) => {
      const { envelope, payload } = a2aMessage;
      
      if (envelope.intent === 'SYNTHESIZE_RESPONSE') {
        return await this.synthesizeResponse(payload);
      }
      
      if (envelope.intent === 'FORMAT_RESPONSE') {
        return await this.formatResponse(payload);
      }
      
      return {
        success: false,
        error: `Unknown intent: ${envelope.intent}`
      };
    };
  }

  /**
   * System Prompt for Writer Agent
   */
  getSystemPrompt() {
    return `You are a Writer Agent in a multi-agent system. Your role is to:

1. SYNTHESIZE structured evidence into coherent user-facing responses
2. FORMAT responses for the target audience
3. INCLUDE proper citations and source attribution
4. ENSURE no unsupported claims are made
5. MAINTAIN consistent tone and style
6. STRUCTURE responses for clarity and readability

WRITING PRINCIPLES:
- Always include citations for data sources
- Use clear, conversational language
- Structure information logically
- Highlight key findings
- Provide actionable insights when possible
- Maintain professional but friendly tone
- Avoid technical jargon unless necessary

CITATION FORMAT:
- Use [1], [2], [3] format for inline citations
- Include source list at the end
- Always attribute data to its source

RESPONSE STRUCTURES:
- Location Search: List format with details, ratings, distances
- Geocoding: Clear coordinates with address confirmation
- Directions: Step-by-step with distances and times
- General: Conversational with relevant information

OUTPUT FORMAT:
{
  "success": true/false,
  "response": "formatted response text",
  "citations": ["source1", "source2"],
  "metadata": {
    "word_count": 150,
    "tone": "professional|friendly|technical",
    "structure": "list|paragraph|step-by-step"
  }
}`;
  }

  /**
   * Synthesize evidence into a user-facing response
   */
  async synthesizeResponse(payload) {
    const { evidence, original_request, context, target_audience } = payload;
    
    try {
      console.log(`✍️  Writer Agent: Synthesizing response for: ${original_request}`);
      
      // Determine response type based on evidence
      const responseType = this.determineResponseType(evidence, original_request);
      
      // Generate appropriate response
      let response = '';
      let citations = [];
      
      switch (responseType) {
        case 'location_search':
          response = this.formatLocationSearchResponse(evidence, original_request);
          citations = this.extractCitations(evidence);
          break;
          
        case 'geocoding':
          response = this.formatGeocodingResponse(evidence, original_request);
          citations = this.extractCitations(evidence);
          break;
          
        case 'directions':
          response = this.formatDirectionsResponse(evidence, original_request);
          citations = this.extractCitations(evidence);
          break;
          
        case 'general':
          response = this.formatGeneralResponse(evidence, original_request, context);
          citations = this.extractCitations(evidence);
          break;
          
        default:
          response = this.formatDefaultResponse(evidence, original_request);
          citations = this.extractCitations(evidence);
      }
      
      // Add citations to response
      if (citations.length > 0) {
        response += this.addCitationList(citations);
      }
      
      return {
        success: true,
        response: response,
        citations: citations,
        metadata: {
          word_count: this.countWords(response),
          tone: this.detectTone(response),
          structure: responseType
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Writer Agent error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format a specific response
   */
  async formatResponse(payload) {
    const { response_type, data, context } = payload;
    
    try {
      let response = '';
      
      switch (response_type) {
        case 'places_list':
          response = this.formatPlacesList(data, context);
          break;
          
        case 'coordinates':
          response = this.formatCoordinates(data, context);
          break;
          
        case 'directions':
          response = this.formatDirections(data, context);
          break;
          
        default:
          response = this.formatDefault(data, context);
      }
      
      return {
        success: true,
        response: response,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Format response error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Determine response type based on evidence
   */
  determineResponseType(evidence, originalRequest) {
    if (evidence.data?.places) return 'location_search';
    if (evidence.data?.coordinates) return 'geocoding';
    if (evidence.data?.routes) return 'directions';
    if (originalRequest.toLowerCase().includes('hello') || originalRequest.toLowerCase().includes('how are you')) return 'general';
    return 'default';
  }

  /**
   * Format location search response
   */
  formatLocationSearchResponse(evidence, originalRequest) {
    const places = evidence.data?.places || [];
    const searchQuery = this.extractSearchQuery(originalRequest);
    
    if (places.length === 0) {
      return `I couldn't find any places for "${searchQuery}" near the specified location. Please try a different search term or location.`;
    }
    
    let response = `I found ${places.length} places for "${searchQuery}":\n\n`;
    
    places.slice(0, 5).forEach((place, index) => {
      response += `${index + 1}. **${place.name || 'Unknown'}**\n`;
      response += `   📍 ${place.address || 'Address not available'}\n`;
      if (place.rating && place.rating > 0) {
        response += `   ⭐ ${place.rating}/5\n`;
      }
      if (place.distance) {
        response += `   📏 ${place.distance} km away\n`;
      }
      response += '\n';
    });
    
    if (places.length > 5) {
      response += `... and ${places.length - 5} more places.`;
    }
    
    return response;
  }

  /**
   * Format geocoding response
   */
  formatGeocodingResponse(evidence, originalRequest) {
    const coords = evidence.data?.coordinates;
    const address = evidence.data?.address;
    
    if (!coords || !address) {
      return `I couldn't find coordinates for that address. Please check the spelling or try a more specific location.`;
    }
    
    return `The coordinates for "${address}" are approximately ${coords.lat.toFixed(6)}° N, ${coords.lon.toFixed(6)}° E.`;
  }

  /**
   * Format directions response
   */
  formatDirectionsResponse(evidence, originalRequest) {
    const routes = evidence.data?.routes || [];
    
    if (routes.length === 0) {
      return `I couldn't calculate a route for your request. Please check the origin and destination addresses.`;
    }
    
    const route = routes[0];
    const summary = route.summary;
    
    let response = `Here's the route information:\n\n`;
    response += `📍 **Distance**: ${(summary.lengthInMeters / 1000).toFixed(1)} km\n`;
    response += `⏱️  **Duration**: ${Math.round(summary.travelTimeInSeconds / 60)} minutes\n`;
    
    return response;
  }

  /**
   * Format general response
   */
  formatGeneralResponse(evidence, originalRequest, context) {
    if (originalRequest.toLowerCase().includes('hello') || originalRequest.toLowerCase().includes('hi')) {
      return `Hello! I'm your multi-agent assistant. I can help you with location searches, directions, geocoding, and general questions. What would you like to know?`;
    }
    
    if (originalRequest.toLowerCase().includes('how are you')) {
      return `I'm doing well, thank you! I'm ready to help you with location-based queries or any other questions you might have.`;
    }
    
    return `I understand you're asking: "${originalRequest}". I can help with location-based queries using TomTom Maps or answer general questions. Could you be more specific about what you need?`;
  }

  /**
   * Format default response
   */
  formatDefaultResponse(evidence, originalRequest) {
    return `I've processed your request: "${originalRequest}". Here's what I found:\n\n${JSON.stringify(evidence.data, null, 2)}`;
  }

  /**
   * Format places list
   */
  formatPlacesList(data, context) {
    const places = data.places || [];
    
    if (places.length === 0) {
      return `No places found matching your criteria.`;
    }
    
    let response = `Found ${places.length} places:\n\n`;
    places.forEach((place, index) => {
      response += `${index + 1}. ${place.name}\n`;
      response += `   ${place.address}\n`;
      if (place.rating) response += `   Rating: ${place.rating}/5\n`;
      if (place.distance) response += `   Distance: ${place.distance} km\n`;
      response += '\n';
    });
    
    return response;
  }

  /**
   * Format coordinates
   */
  formatCoordinates(data, context) {
    const coords = data.coordinates;
    const address = data.address;
    
    if (!coords) {
      return `Coordinates not found.`;
    }
    
    return `Coordinates for "${address}": ${coords.lat.toFixed(6)}° N, ${coords.lon.toFixed(6)}° E`;
  }

  /**
   * Format directions
   */
  formatDirections(data, context) {
    const routes = data.routes || [];
    
    if (routes.length === 0) {
      return `No routes found.`;
    }
    
    const route = routes[0];
    const summary = route.summary;
    
    return `Route: ${(summary.lengthInMeters / 1000).toFixed(1)} km, ${Math.round(summary.travelTimeInSeconds / 60)} minutes`;
  }

  /**
   * Format default
   */
  formatDefault(data, context) {
    return `Response: ${JSON.stringify(data, null, 2)}`;
  }

  /**
   * Extract search query from request
   */
  extractSearchQuery(request) {
    const words = request.toLowerCase().split(' ');
    const searchWords = words.filter(word => 
      !['find', 'search', 'for', 'near', 'me', 'the', 'a', 'an', 'and', 'or', 'but'].includes(word)
    );
    return searchWords.join(' ') || 'places';
  }

  /**
   * Extract citations from evidence
   */
  extractCitations(evidence) {
    return evidence.citations || evidence.sources || [];
  }

  /**
   * Add citation list to response
   */
  addCitationList(citations) {
    if (citations.length === 0) return '';
    
    let citationText = '\n\n**Sources:**\n';
    citations.forEach((citation, index) => {
      citationText += `[${index + 1}] ${citation}\n`;
    });
    
    return citationText;
  }

  /**
   * Count words in response
   */
  countWords(text) {
    return text.split(/\s+/).length;
  }

  /**
   * Detect tone of response
   */
  detectTone(text) {
    if (text.includes('!') || text.includes('Hello')) return 'friendly';
    if (text.includes('coordinates') || text.includes('latitude')) return 'technical';
    return 'professional';
  }

  /**
   * Register with other agents
   */
  registerWithAgents() {
    this.a2a.registerAgent('planner-agent', 'planner', this.baseUrl);
    this.a2a.registerAgent('researcher-agent', 'researcher', this.baseUrl);
    this.a2a.registerAgent('reviewer-agent', 'reviewer', this.baseUrl);
    this.a2a.registerAgent('supervisor-agent', 'supervisor', this.baseUrl);
  }
}

module.exports = WriterAgent;
