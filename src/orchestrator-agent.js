#!/usr/bin/env node
/**
 * Orchestrator Agent - Multi-Agent Coordination Server
 * Coordinates between Maps Agent and General AI Agent
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const A2AProtocol = require('./a2a-protocol');
require('dotenv').config();

// Constants for LLM APIs
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Maps Agent configuration
const MAPS_AGENT_URL = process.env.MAPS_AGENT_URL || 'http://localhost:3002';

// Create orchestrator server
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize A2A Protocol
const a2a = new A2AProtocol('orchestrator-agent', 'orchestrator', `http://localhost:${process.env.PORT || 3000}`);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Orchestrator Agent - A2A Coordination',
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    protocol: 'A2A',
    agentId: 'orchestrator-agent',
    agentType: 'orchestrator',
    endpoints: {
      orchestrator: 'POST / (JSON-RPC)',
      a2a: 'POST /a2a (A2A Protocol)',
      health: 'GET /'
    },
    agents: {
      maps_agent: MAPS_AGENT_URL,
      general_ai: 'integrated'
    }
  });
});

// A2A Protocol endpoint
app.post('/a2a', (req, res) => {
  a2a.handleA2AMessage(req, res);
});

// Agent discovery endpoint
app.get('/agents', (req, res) => {
  res.json({
    agents: [a2a.getAgentStatus()]
  });
});

// Multi-Agent System State
let conversationHistory = [];
let userContexts = {};

// Context management functions
function getUserContext(userId) {
  if (!userContexts[userId]) {
    userContexts[userId] = {
      lastLocation: null,
      lastCoordinates: null,
      conversationHistory: [],
      preferences: {}
    };
  }
  return userContexts[userId];
}

function updateUserContext(userId, contextUpdate) {
  const context = getUserContext(userId);
  Object.assign(context, contextUpdate);
  userContexts[userId] = context;
}

function extractLocationFromMessage(message, userContext) {
  // Look for coordinates in the message
  const coordPattern = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
  const coordMatch = message.match(coordPattern);
  
  if (coordMatch) {
    return {
      lat: parseFloat(coordMatch[1]),
      lon: parseFloat(coordMatch[2]),
      source: 'coordinates'
    };
  }
  
  // Look for address patterns
  const addressPattern = /(\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|way|drive|dr|lane|ln|place|pl|court|ct|circle|cir|parkway|pkwy|highway|hwy|route|rt|ijburglaan|amsterdam|netherlands|nl))/i;
  const addressMatch = message.match(addressPattern);
  
  if (addressMatch) {
    return {
      address: addressMatch[1],
      source: 'address'
    };
  }
  
  // Use last known location if available
  if (userContext.lastLocation) {
    return userContext.lastLocation;
  }
  
  return null;
}

function getConversationContext(userId, limit = 5) {
  const context = getUserContext(userId);
  return context.conversationHistory.slice(-limit);
}

function cleanupConversationHistory(userId, maxMessages = 50) {
  const context = getUserContext(userId);
  if (context.conversationHistory.length > maxMessages) {
    context.conversationHistory = context.conversationHistory.slice(-maxMessages);
    console.log(`Cleaned up conversation history for user ${userId}, kept last ${maxMessages} messages`);
  }
}

function cleanupGlobalHistory(maxMessages = 1000) {
  if (conversationHistory.length > maxMessages) {
    conversationHistory = conversationHistory.slice(-maxMessages);
    console.log(`Cleaned up global conversation history, kept last ${maxMessages} messages`);
  }
}

// LLM Integration Functions
async function callOpenAI(message, context = '') {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that can help with location-based queries using TomTom Maps and general questions. ${context}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    throw error;
  }
}

async function callAnthropic(message, context = '') {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }
  
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `${context}\n\nUser: ${message}`
        }
      ]
    }, {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    return response.data.content[0].text;
  } catch (error) {
    console.error('Anthropic API error:', error.response?.data || error.message);
    throw error;
  }
}

// Maps Agent Communication via A2A
async function callMapsAgent(messageType, payload) {
  try {
    // Register Maps Agent if not already registered
    if (!a2a.registeredAgents.has('maps-agent')) {
      a2a.registerAgent('maps-agent', 'maps', MAPS_AGENT_URL);
    }
    
    const result = await a2a.sendMessage('maps-agent', messageType, payload, {
      timeout: 10000
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.data;
  } catch (error) {
    console.error('A2A Maps Agent error:', error.message);
    throw error;
  }
}

// Orchestrator Chat Handler
async function handleOrchestratorChat(rpcRequest, res) {
  try {
    const { message, user_id = 'default' } = rpcRequest.params;
    
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
    
    // Get user context
    const userContext = getUserContext(user_id);
    const conversationContext = getConversationContext(user_id);
    
    // Store user message
    userContext.conversationHistory.push({
      timestamp: new Date().toISOString(),
      type: 'user',
      message
    });
    
    conversationHistory.push({
      timestamp: new Date().toISOString(),
      user_id,
      type: 'user',
      message
    });
    
    // Extract location from message or context
    const extractedLocation = extractLocationFromMessage(message, userContext);
    
    // Update context with extracted location
    if (extractedLocation) {
      updateUserContext(user_id, {
        lastLocation: extractedLocation,
        lastCoordinates: extractedLocation.source === 'coordinates' ? 
          { lat: extractedLocation.lat, lon: extractedLocation.lon } : 
          userContext.lastCoordinates
      });
    }
    
    // Simple agent routing logic
    let response = '';
    let agent_used = '';
    let query_type = 'general';
    
    // Check if it's a location query
    const locationKeywords = ['where', 'location', 'address', 'place', 'find', 'search', 'near', 'nearby', 'directions', 'route', 'coordinates', 'geocode', 'restaurant', 'restaurants', 'closest'];
    const isLocationQuery = locationKeywords.some(keyword => message.toLowerCase().includes(keyword));
    
    if (isLocationQuery) {
      agent_used = 'maps_agent';
      query_type = 'location';
      
      try {
        // Handle location queries by calling Maps Agent
        if (message.toLowerCase().includes('search') || message.toLowerCase().includes('find') || message.toLowerCase().includes('restaurant') || message.toLowerCase().includes('closest')) {
          // Extract search parameters
          let searchQuery = message.replace(/find|search|near|me|restaurant|restaurants|closest|to this place|along with distances/gi, '').trim();
          if (!searchQuery) searchQuery = 'restaurants';
          
          // Use extracted location or default
          let searchLocation = { lat: 47.6062, lon: -122.3321 }; // Default to Seattle
          
          if (extractedLocation && extractedLocation.source === 'coordinates') {
            searchLocation = { lat: extractedLocation.lat, lon: extractedLocation.lon };
          } else if (userContext.lastCoordinates) {
            searchLocation = userContext.lastCoordinates;
          } else if (extractedLocation && extractedLocation.source === 'address') {
            // Geocode the address first
            try {
              const geocodeResult = await callMapsAgent('geocode_address', { address: extractedLocation.address });
              
              if (geocodeResult && geocodeResult.results && geocodeResult.results.length > 0) {
                const coords = geocodeResult.results[0].position;
                searchLocation = { lat: coords.lat, lon: coords.lon };
                updateUserContext(user_id, { lastCoordinates: searchLocation });
                console.log(`Geocoded address: ${extractedLocation.address} -> ${coords.lat}, ${coords.lon}`);
              }
            } catch (geocodeError) {
              console.error('Geocoding error:', geocodeError);
            }
          }
          
          // Call Maps Agent for search via A2A
          console.log(`A2A Search for "${searchQuery}" at location:`, searchLocation);
          const searchResult = await callMapsAgent('search_places', {
            query: searchQuery,
            location: searchLocation
          });
          
          if (searchResult && searchResult.places && searchResult.places.length > 0) {
            response = `I found ${searchResult.places.length} places for "${searchQuery}":\n\n`;
            searchResult.places.slice(0, 3).forEach((place, index) => {
              response += `${index + 1}. **${place.name}**\n`;
              response += `   📍 ${place.formatted_address}\n`;
              if (place.rating > 0) response += `   ⭐ ${place.rating}/5\n`;
              if (place.distance) response += `   📏 ${place.distance} km away\n`;
              response += '\n';
            });
          } else {
            response = `I couldn't find any places for "${searchQuery}" near the specified location. Please try a different search term or provide a more specific location.`;
          }
        } else if (message.toLowerCase().includes('directions') || message.toLowerCase().includes('route')) {
          response = 'I can help you get directions! Please provide both your starting location and destination. For example: "How do I get from Seattle to Portland?"';
        } else if (message.toLowerCase().includes('coordinates') || message.toLowerCase().includes('address')) {
          response = 'I can help you find coordinates for addresses or addresses for coordinates. Please provide the specific address or coordinates you need.';
        } else {
          response = `I can help you with location-based queries using TomTom Maps. You asked: "${message}". I can search for places, get directions, find coordinates, and more. What would you like to do?`;
        }
      } catch (error) {
        console.error('Maps Agent error:', error.message);
        response = `I can help you with location-based queries, but I'm having trouble connecting to the maps service. Please try again.`;
      }
    } else {
      agent_used = 'general_ai_agent';
      query_type = 'general';
      
      // Build context for LLM
      let contextMessage = `You are a helpful assistant integrated with TomTom Maps. You can help with location searches, directions, geocoding, and general questions.`;
      
      // Add conversation context
      if (conversationContext.length > 0) {
        contextMessage += `\n\nRecent conversation context:\n`;
        conversationContext.forEach((msg, index) => {
          contextMessage += `${msg.type}: ${msg.message}\n`;
        });
      }
      
      // Add location context if available
      if (userContext.lastLocation) {
        contextMessage += `\n\nUser's last known location: ${JSON.stringify(userContext.lastLocation)}`;
      }
      
      // Always use LLM for general questions
      try {
        // Try OpenAI first, then Anthropic, then fallback
        if (OPENAI_API_KEY) {
          response = await callOpenAI(message, contextMessage);
        } else if (ANTHROPIC_API_KEY) {
          response = await callAnthropic(message, contextMessage);
        } else {
          throw new Error('No LLM API keys configured');
        }
      } catch (error) {
        console.error('LLM error:', error.message);
        // Fallback to simple responses
        if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
          response = 'Hello! I\'m your multi-agent assistant. I can help you with location searches, directions, geocoding, and general questions. What would you like to know?';
        } else if (message.toLowerCase().includes('help')) {
          response = 'I can help you with:\n- Location searches using TomTom Maps\n- Getting directions between places\n- Finding coordinates for addresses\n- General questions and conversation\n\nWhat would you like to do?';
        } else {
          response = `I understand you're asking: "${message}". I can help with location-based queries using TomTom Maps or answer general questions. Could you be more specific about what you need?`;
        }
      }
    }
    
    // Store assistant response
    userContext.conversationHistory.push({
      timestamp: new Date().toISOString(),
      type: 'assistant',
      message: response
    });
    
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
    
    // Cleanup old messages to prevent memory issues
    cleanupConversationHistory(user_id, 50); // Keep last 50 messages per user
    cleanupGlobalHistory(1000); // Keep last 1000 messages globally
    
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
    console.error('Error in orchestrator chat:', error);
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
  return res.json({
    jsonrpc: '2.0',
    id: rpcRequest.id,
    result: {
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
    }
  });
}

// Orchestrator Context Handler
async function handleOrchestratorContext(rpcRequest, res) {
  const { user_id = 'default' } = rpcRequest.params;
  const userContext = getUserContext(user_id);
  
  return res.json({
    jsonrpc: '2.0',
    id: rpcRequest.id,
    result: {
      user_id,
      context: {
        lastLocation: userContext.lastLocation,
        lastCoordinates: userContext.lastCoordinates,
        conversationLength: userContext.conversationHistory.length,
        preferences: userContext.preferences
      },
      timestamp: new Date().toISOString()
    }
  });
}

// Main JSON-RPC handler
app.post('/', async (req, res) => {
  const { method, params, id } = req.body;
  
  try {
    switch (method) {
      case 'orchestrator.chat':
        return await handleOrchestratorChat(req, res);
        
      case 'orchestrator.capabilities':
        return await handleOrchestratorCapabilities(req, res);
        
      case 'orchestrator.context':
        return await handleOrchestratorContext(req, res);
        
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

// Implement A2A message processing for Orchestrator Agent
a2a.processA2AMessage = async function(a2aMessage) {
  const { type, payload } = a2aMessage.message;
  
  try {
    switch (type) {
      case 'chat_message':
        // Process chat message and route to appropriate agent
        const userContext = getUserContext(payload.user_id || 'default');
        const conversationContext = getConversationContext(payload.user_id || 'default');
        
        // Store user message
        userContext.conversationHistory.push({
          timestamp: new Date().toISOString(),
          type: 'user',
          message: payload.message
        });
        
        // Route to appropriate agent
        const locationKeywords = ['where', 'location', 'address', 'place', 'find', 'search', 'near', 'nearby', 'directions', 'route', 'coordinates', 'geocode', 'restaurant', 'restaurants', 'closest'];
        const isLocationQuery = locationKeywords.some(keyword => payload.message.toLowerCase().includes(keyword));
        
        if (isLocationQuery) {
          // Route to Maps Agent via A2A
          const searchQuery = payload.message.replace(/find|search|near|me|restaurant|restaurants|closest|to this place|along with distances/gi, '').trim() || 'restaurants';
          const searchLocation = { lat: 47.6062, lon: -122.3321 }; // Default location
          
          const searchResult = await callMapsAgent('search_places', {
            query: searchQuery,
            location: searchLocation
          });
          
          return {
            response: `Found ${searchResult.places?.length || 0} places for "${searchQuery}"`,
            agent_used: 'maps_agent',
            query_type: 'location'
          };
        } else {
          // Route to LLM
          let contextMessage = `You are a helpful assistant integrated with TomTom Maps.`;
          if (conversationContext.length > 0) {
            contextMessage += `\n\nRecent conversation:\n`;
            conversationContext.forEach(msg => {
              contextMessage += `${msg.type}: ${msg.message}\n`;
            });
          }
          
          let llmResponse = '';
          if (OPENAI_API_KEY) {
            llmResponse = await callOpenAI(payload.message, contextMessage);
          } else if (ANTHROPIC_API_KEY) {
            llmResponse = await callAnthropic(payload.message, contextMessage);
          } else {
            llmResponse = `I understand you're asking: "${payload.message}". I can help with location-based queries using TomTom Maps or answer general questions.`;
          }
          
          return {
            response: llmResponse,
            agent_used: 'general_ai_agent',
            query_type: 'general'
          };
        }
        
      case 'get_capabilities':
        return {
          agentId: 'orchestrator-agent',
          agentType: 'orchestrator',
          capabilities: [
            'chat_message',
            'agent_coordination',
            'context_management',
            'query_routing'
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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🎯 Orchestrator Agent (A2A) running on port ${PORT}`);
  console.log(`🗺️  Maps Agent URL: ${MAPS_AGENT_URL}`);
  console.log(`🤖 LLM Providers: ${OPENAI_API_KEY ? 'OpenAI' : 'None'}, ${ANTHROPIC_API_KEY ? 'Anthropic' : 'None'}`);
  console.log(`🔧 A2A Capabilities: chat_message, get_capabilities`);
  console.log(`📡 A2A Endpoint: http://localhost:${PORT}/a2a`);
});
