#!/usr/bin/env node
/**
 * Unified A2A + MCP Server
 * Runs both Orchestrator Agent and Maps Agent in a single Railway service
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const A2AProtocol = require('./a2a-protocol');
const MCPClient = require('./mcp-client');
const ComprehensiveObservability = require('./comprehensive-observability');
require('dotenv').config();

// Constants for LLM APIs
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Constants for TomTom API
const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY;

// Debug environment variables
console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('All env vars starting with OPENAI:', Object.keys(process.env).filter(key => key.includes('OPENAI')));
console.log('All env vars starting with TOMTOM:', Object.keys(process.env).filter(key => key.includes('TOMTOM')));
console.log('All env vars starting with ANTHROPIC:', Object.keys(process.env).filter(key => key.includes('ANTHROPIC')));

console.log('OPENAI_API_KEY exists:', !!OPENAI_API_KEY);
console.log('OPENAI_API_KEY length:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
console.log('OPENAI_API_KEY starts with sk-:', OPENAI_API_KEY ? OPENAI_API_KEY.startsWith('sk-') : false);
console.log('OPENAI_API_KEY first 20 chars:', OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 20) : 'NOT SET');

console.log('ANTHROPIC_API_KEY exists:', !!ANTHROPIC_API_KEY);
console.log('ANTHROPIC_API_KEY length:', ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.length : 0);

console.log('TOMTOM_API_KEY exists:', !!TOMTOM_API_KEY);
console.log('TOMTOM_API_KEY length:', TOMTOM_API_KEY ? TOMTOM_API_KEY.length : 0);
console.log('TOMTOM_API_KEY first 10 chars:', TOMTOM_API_KEY ? TOMTOM_API_KEY.substring(0, 10) : 'NOT SET');

// Check if we're getting placeholder values
const hasPlaceholderValues = OPENAI_API_KEY && OPENAI_API_KEY.includes('your_ope');
console.log('Has placeholder values:', hasPlaceholderValues);

console.log('=== END ENVIRONMENT VARIABLES DEBUG ===');
const TOMTOM_ORBIS_SEARCH_URL = 'https://api.tomtom.com/maps/orbis/places/nearbySearch/.json';
const TOMTOM_GEOCODING_URL = 'https://api.tomtom.com/search/2/geocode';
const TOMTOM_REVERSE_GEOCODING_URL = 'https://api.tomtom.com/search/2/reverseGeocode';
const TOMTOM_STATICMAP_URL = 'https://api.tomtom.com/map/1/staticimage';
const TOMTOM_ROUTING_URL = 'https://api.tomtom.com/maps/orbis/routing/calculateRoute';

if (!TOMTOM_API_KEY) {
  console.error('Error: TOMTOM_API_KEY environment variable not set');
  process.exit(1);
}

// Create unified server
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize A2A Protocol for Orchestrator
const orchestratorA2A = new A2AProtocol('orchestrator-agent', 'orchestrator', `http://localhost:${PORT}`);

// Initialize A2A Protocol for Maps Agent
const mapsA2A = new A2AProtocol('maps-agent', 'maps', `http://localhost:${PORT}`);

// Initialize MCP client for tool access
const MCP_TOOL_SERVER_URL = process.env.MCP_TOOL_SERVER_URL || 'http://localhost:3003';
const mcpClient = new MCPClient(MCP_TOOL_SERVER_URL);

// Initialize MCP client and discover tools
async function initializeMCPClient() {
  try {
    await mcpClient.discoverTools();
    console.log('🔧 MCP Client initialized with tools:', mcpClient.getAvailableTools());
  } catch (error) {
    console.warn('⚠️  MCP Client initialization failed:', error.message);
    console.log('   MCP Tool Server not available - using fallback methods');
    // In Railway, we'll use direct TomTom API calls as fallback
  }
}

// Register agents for internal communication
orchestratorA2A.registerAgent('maps-agent', 'maps', `http://localhost:${PORT}`);
mapsA2A.registerAgent('orchestrator-agent', 'orchestrator', `http://localhost:${PORT}`);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Unified A2A + MCP Server',
    status: 'healthy',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    protocols: ['A2A', 'MCP', 'JSON-RPC'],
    agents: {
      orchestrator: 'integrated',
      maps: 'integrated'
    },
    endpoints: {
      orchestrator: 'POST / (JSON-RPC)',
      a2a: 'POST /a2a (A2A Protocol)',
      maps_mcp: 'POST /maps (MCP Protocol)',
      health: 'GET /'
    }
  });
});

// JSON-RPC endpoint for Orchestrator (Frontend Interface)
app.post('/', async (req, res) => {
  console.log('Received JSON-RPC request:', JSON.stringify(req.body, null, 2));
  const { method, params, id } = req.body;
  
  try {
    switch (method) {
      case 'orchestrator.chat':
        return await handleOrchestratorChat({ params, id }, res);
        
      case 'orchestrator.capabilities':
        return await handleOrchestratorCapabilities({ params, id }, res);
        
      case 'orchestrator.context':
        return await handleOrchestratorContext({ params, id }, res);
        
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
    console.error('Error handling JSON-RPC request:', error);
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

// A2A Protocol endpoint (Internal Agent Communication)
app.post('/a2a', (req, res) => {
  const a2aMessage = req.body;
  
  // Route to appropriate agent based on target
  if (a2aMessage.target && a2aMessage.target.agentId === 'orchestrator-agent') {
    orchestratorA2A.handleA2AMessage(req, res);
  } else if (a2aMessage.target && a2aMessage.target.agentId === 'maps-agent') {
    mapsA2A.handleA2AMessage(req, res);
  } else {
    res.status(400).json({
      success: false,
      error: 'Unknown target agent'
    });
  }
});

// MCP endpoint for Maps Agent (Internal TomTom API access)
app.post('/maps', async (req, res) => {
  console.log('Received MCP request:', JSON.stringify(req.body, null, 2));
  const { method, params, id } = req.body;
  
  try {
    switch (method) {
      case 'initialize':
        return await handleMapsInitialize({ params, id }, res);
        
      case 'tools/list':
        return await handleMapsToolsList({ params, id }, res);
        
      case 'tools/call':
        return await handleMapsToolsCall({ params, id }, res);
        
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

// Agent discovery endpoint
app.get('/agents', (req, res) => {
  res.json({
    agents: [
      orchestratorA2A.getAgentStatus(),
      mapsA2A.getAgentStatus()
    ]
  });
});

// Comprehensive Analytics endpoint
app.get('/analytics', async (req, res) => {
  try {
    if (!observability) {
      return res.json({
        error: 'Comprehensive Observability not configured',
        message: 'Set GOOGLE_CLOUD_PROJECT environment variable to enable observability'
      });
    }

    const analytics = await observability.getComprehensiveAnalytics(req.query.timeRange || '1h');
    
    res.json({
      success: true,
      analytics: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      message: error.message
    });
  }
});

// Multi-Agent System State
let conversationHistory = [];
let userContexts = {};

// Initialize Comprehensive Observability
// Initialize observability (disabled for Railway deployment)
const observability = null; // Disabled for Railway - enable when Google Cloud credentials are properly configured

// User Context Management
function getUserContext(userId) {
  if (!userContexts[userId]) {
    userContexts[userId] = {
      lastLocation: null,
      lastCoordinates: null,
      conversationHistory: []
    };
  }
  return userContexts[userId];
}

function updateUserContext(userId, updates) {
  const context = getUserContext(userId);
  Object.assign(context, updates);
}

function getConversationContext(userId, limit = 10) {
  const userContext = getUserContext(userId);
  return userContext.conversationHistory.slice(-limit);
}

// LLM-based context extraction and intent understanding
async function extractContextAndIntent(message, userContext, conversationContext) {
  const contextPrompt = `You are an intelligent orchestrator agent for a location-based chatbot system. Your role is to:

1. ANALYZE user messages to understand their intent
2. EXTRACT location context from messages or conversation history
3. ROUTE requests to the appropriate specialized agent (Maps Agent for location queries, General AI for other queries)

SYSTEM CAPABILITIES:
- Maps Agent: Handles location search, geocoding, directions, static maps
- General AI Agent: Handles general conversation, knowledge questions, greetings

USER'S CURRENT MESSAGE: "${message}"

CONVERSATION HISTORY:
${conversationContext.map(msg => `${msg.type}: ${msg.message}`).join('\n')}

USER'S STORED CONTEXT:
- Last location: ${userContext.lastLocation ? JSON.stringify(userContext.lastLocation) : 'None'}
- Last coordinates: ${userContext.lastCoordinates ? JSON.stringify(userContext.lastCoordinates) : 'None'}

ANALYSIS REQUIRED:
1. INTENT CLASSIFICATION: Is this a location-based query or general conversation?
2. LOCATION EXTRACTION: What location should be used? (extract from message, use context, or reference previous location)
3. QUERY PROCESSING: What should be searched for or what action should be taken?
4. AGENT ROUTING: Which agent should handle this request?

LOCATION QUERY INDICATORS (be very liberal in detection):
- SEARCH QUERIES: "find", "search", "near", "close to", "restaurants", "coffee shops", "places", "shops", "stores", "hotels", "gas stations", "pharmacy", "hospital", "bank", "atm"
- GEOCODING QUERIES: "coordinates", "address", "geocode", "lat", "long", "latitude", "longitude", "where is", "location of", "exact location"
- DIRECTIONS QUERIES: "directions", "route", "how to get to", "drive to", "walk to", "travel to", "go to", "navigate to", "how do I get", "how long does it take", "travel time", "driving time", "walking time", "distance", "from X to Y"
- MATRIX ROUTING QUERIES: "matrix routing", "travel time matrix", "distance matrix", "compare travel times", "between multiple locations", "from A, B to X, Y", "travel times between", "compare routes"
- REVERSE GEOCODING: "what is this address", "address of these coordinates", "reverse geocode"
- STATIC MAPS: "show me a map", "map of", "visualize", "display map"

CONTEXT REFERENCES:
- "that address" = use last known address
- "near me" = use last known coordinates
- "this location" = use last known location
- "here" = use last known location
- "there" = use last known location

DIRECTIONS QUERY EXAMPLES:
- "how does it take for me to travel from X to Y" → directions intent
- "directions from X to Y" → directions intent
- "how do I get from X to Y" → directions intent
- "travel time from X to Y" → directions intent
- "how long to get from X to Y" → directions intent

IMPORTANT: Be very liberal in detecting location-based queries. When in doubt, classify as location query and route to Maps Agent.

Respond with a JSON object in this exact format:
{
  "intent": "search_places|geocode|directions|matrix_routing|reverse_geocode|static_map|general_chat",
  "location_context": {
    "source": "coordinates|address|context_reference|none",
    "coordinates": {"lat": number, "lon": number} | null,
    "address": "string" | null
  },
  "search_query": "string" | null,
  "tool_needed": "search_places|geocode_address|reverse_geocode_address|calculate_route|matrix_routing|static_map|none",
  "confidence": 0.0-1.0
}`;

  try {
    console.log('=== LLM CONTEXT EXTRACTION DEBUG ===');
    console.log('OPENAI_API_KEY available:', !!OPENAI_API_KEY);
    console.log('ANTHROPIC_API_KEY available:', !!ANTHROPIC_API_KEY);
    console.log('Will use LLM:', !!(OPENAI_API_KEY || ANTHROPIC_API_KEY));
    
    let llmResponse = '';
    if (OPENAI_API_KEY) {
      console.log('Using OpenAI for context extraction');
      llmResponse = await callOpenAI(contextPrompt, '', userContext.userId || 'default');
    } else if (ANTHROPIC_API_KEY) {
      console.log('Using Anthropic for context extraction');
      llmResponse = await callAnthropic(contextPrompt, '', userContext.userId || 'default');
    } else {
      console.log('No LLM API keys available - this should not happen in production');
      throw new Error('No LLM API keys configured - cannot process request');
    }

    // Parse LLM response
    const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    } else {
      throw new Error('No valid JSON found in LLM response');
    }
  } catch (error) {
    console.error('LLM context extraction failed:', error.message);
    throw new Error(`LLM context extraction failed: ${error.message}`);
  }
}


// LLM Integration with Observability
async function callOpenAI(message, context = '', userId = 'anonymous') {
  const startTime = Date.now();
  const correlationId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const llmCall = {
    component: 'llmCalls',
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    prompt: `${context}\n\n${message}`,
    userId: userId,
    correlationId: correlationId,
    success: false,
    response: null,
    tokensUsed: 0,
    error: null,
    duration: 0
  };

  try {
    console.log('=== OPENAI API CALL DEBUG ===');
    console.log('API Key being used:', OPENAI_API_KEY ? `${OPENAI_API_KEY.substring(0, 20)}...` : 'NOT SET');
    console.log('API Key length:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
    console.log('API Key starts with sk-:', OPENAI_API_KEY ? OPENAI_API_KEY.startsWith('sk-') : false);
    
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: context },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const content = response.data.choices[0].message.content;
    const tokensUsed = response.data.usage?.total_tokens || 0;
    
    // Update LLM call with success
    llmCall.success = true;
    llmCall.response = content;
    llmCall.tokensUsed = tokensUsed;
    llmCall.duration = Date.now() - startTime;
    
    // Observe the LLM call
    if (observability) {
      await observability.observeOperation(llmCall);
    }
    
    return content;
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    
    // Update LLM call with error
    llmCall.success = false;
    llmCall.error = error.message;
    llmCall.duration = Date.now() - startTime;
    
    // Observe the failed LLM call
    if (observability) {
      await observability.observeOperation(llmCall);
    }
    
    throw error;
  }
}

async function callAnthropic(message, context = '', userId = 'anonymous') {
  const startTime = Date.now();
  const correlationId = `anthropic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const llmCall = {
    component: 'llmCalls',
    provider: 'anthropic',
    model: 'claude-3-sonnet-20240229',
    prompt: `${context}\n\n${message}`,
    userId: userId,
    correlationId: correlationId,
    success: false,
    response: null,
    tokensUsed: 0,
    error: null,
    duration: 0
  };

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 500,
      messages: [
        { role: 'user', content: `${context}\n\n${message}` }
      ]
    }, {
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });
    
    const content = response.data.content[0].text;
    const tokensUsed = response.data.usage?.input_tokens + response.data.usage?.output_tokens || 0;
    
    // Update LLM call with success
    llmCall.success = true;
    llmCall.response = content;
    llmCall.tokensUsed = tokensUsed;
    llmCall.duration = Date.now() - startTime;
    
    // Observe the LLM call
    if (observability) {
      await observability.observeOperation(llmCall);
    }
    
    return content;
  } catch (error) {
    console.error('Anthropic API error:', error.response?.data || error.message);
    
    // Update LLM call with error
    llmCall.success = false;
    llmCall.error = error.message;
    llmCall.duration = Date.now() - startTime;
    
    // Observe the failed LLM call
    if (observability) {
      await observability.observeOperation(llmCall);
    }
    
    throw error;
  }
}

// Internal Maps Agent Communication with Observability
async function callMapsAgent(messageType, payload, userId = 'anonymous') {
  const startTime = Date.now();
  const correlationId = `internal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const toolCall = {
    toolName: messageType,
    agentId: 'maps-agent',
    agentType: 'maps',
    input: payload,
    userId: userId,
    correlationId: correlationId,
    success: false,
    output: null,
    error: null,
    duration: 0
  };

  try {
    // Call the Maps Agent A2A handler directly instead of HTTP
    const a2aMessage = {
      protocol: 'A2A',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: {
        agentId: 'orchestrator-agent',
        agentType: 'orchestrator',
        url: `http://localhost:${PORT}`
      },
      target: {
        agentId: 'maps-agent',
        agentType: 'maps',
        url: `http://localhost:${PORT}`
      },
      message: {
        type: messageType,
        payload: payload,
        correlationId: correlationId,
        timeout: 10000
      }
    };
    
    // Process the A2A message directly
    const result = await mapsA2A.processA2AMessage(a2aMessage);
    
    // Update tool call with success
    toolCall.success = true;
    toolCall.output = result;
    toolCall.duration = Date.now() - startTime;
    
    // Observe the tool call
    if (observability) {
      await observability.observeOperation({
        component: 'mapsAgent',
        operationType: messageType,
        toolName: messageType,
        input: payload,
        output: result,
        duration: toolCall.duration,
        success: toolCall.success,
        error: toolCall.error,
        userId: userId,
        correlationId: correlationId
      });
    }
    
    return result;
  } catch (error) {
    console.error('Internal Maps Agent error:', error.message);
    
    // Update tool call with error
    toolCall.success = false;
    toolCall.error = error.message;
    toolCall.duration = Date.now() - startTime;
    
    // Observe the failed tool call
    if (observability) {
      await observability.observeOperation({
        component: 'mapsAgent',
        operationType: messageType,
        toolName: messageType,
        input: payload,
        output: null,
        duration: toolCall.duration,
        success: toolCall.success,
        error: toolCall.error,
        userId: userId,
        correlationId: correlationId
      });
    }
    
    throw error;
  }
}

// TomTom API Functions with Observability
async function searchLocationsOrbis(query, location, radius = 5000) {
  const startTime = Date.now();
  const correlationId = `tomtom-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const apiCall = {
    component: 'tomtomApi',
    endpoint: 'search',
    method: 'GET',
    params: { query, location, radius },
    correlationId: correlationId,
    success: false,
    response: null,
    statusCode: null,
    error: null,
    duration: 0
  };

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
    
    let result;
    if (response.data && response.data.results) {
      result = {
        places: response.data.results.map(place => ({
          name: place.poi?.name || 'Unknown',
          formatted_address: place.address?.freeformAddress || 'Address not available',
          rating: place.poi?.rating || 0,
          distance: place.distance ? (place.distance / 1000).toFixed(2) : null,
          position: place.position,
          categories: place.poi?.categories || []
        }))
      };
    } else {
      result = { places: [] };
    }
    
    // Update API call with success
    apiCall.success = true;
    apiCall.response = result;
    apiCall.statusCode = response.status;
    apiCall.duration = Date.now() - startTime;
    
    // Observe the API call
    if (observability) {
      await observability.observeOperation(apiCall);
    }
    
    return result;
  } catch (error) {
    console.error('TomTom Search API error:', error.response?.data || error.message);
    
    // Update API call with error
    apiCall.success = false;
    apiCall.error = error.message;
    apiCall.statusCode = error.response?.status || 0;
    apiCall.duration = Date.now() - startTime;
    
    // Observe the failed API call
    if (observability) {
      await observability.observeOperation(apiCall);
    }
    
    throw new Error('Failed to search locations');
  }
}

async function geocodeAddress(address) {
  try {
    // URL encode the address properly
    const encodedAddress = encodeURIComponent(address);
    const url = `${TOMTOM_GEOCODING_URL}/${encodedAddress}.json?key=${TOMTOM_API_KEY}&limit=1`;
    
    console.log('Geocoding URL:', url);
    
    const response = await axios.get(url);
    
    if (response.data && response.data.results) {
      return {
        results: response.data.results.map(result => ({
          position: result.position,
          address: result.address
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
        addresses: response.data.addresses.map(addr => ({
          address: addr.address,
          position: addr.position
        }))
      };
    }
    
    return { addresses: [] };
  } catch (error) {
    console.error('TomTom Reverse Geocoding API error:', error.response?.data || error.message);
    throw new Error('Failed to reverse geocode');
  }
}

async function calculateRoute(origin, destination) {
  try {
    const params = {
      key: TOMTOM_API_KEY,
      origin: `${origin.lat},${origin.lon}`,
      destination: `${destination.lat},${destination.lon}`
    };

    const response = await axios.get(TOMTOM_ROUTING_URL, { params });
    
    if (response.data && response.data.routes) {
      return {
        routes: response.data.routes.map(route => ({
          summary: route.summary,
          legs: route.legs
        }))
      };
    }
    
    return { routes: [] };
  } catch (error) {
    console.error('TomTom Routing API error:', error.response?.data || error.message);
    throw new Error('Failed to calculate route');
  }
}

// Sequential processing for directions (geocoding + routing)
async function processDirectionsSequential(searchQuery, userContext) {
  try {
    console.log('🔄 Processing directions sequentially:', searchQuery);
    
    // Step 1: Extract addresses using regex (deterministic)
    const routeMatch = searchQuery.match(/from\s+(.+?)\s+to\s+(.+)/i);
    if (!routeMatch) {
      return {
        success: false,
        response: `I need more specific information for directions. Please provide addresses like "directions from [origin] to [destination]".`
      };
    }
    
    const originAddress = routeMatch[1].trim();
    const destinationAddress = routeMatch[2].trim();
    
    console.log('📍 Extracted origin:', originAddress);
    console.log('📍 Extracted destination:', destinationAddress);
    
    // Step 2: Geocode both addresses (parallel API calls)
    console.log('🔍 Geocoding addresses...');
    const [originGeocode, destGeocode] = await Promise.all([
      geocodeAddress(originAddress),
      geocodeAddress(destinationAddress)
    ]);
    
    if (!originGeocode.results || originGeocode.results.length === 0) {
      return {
        success: false,
        response: `I couldn't find coordinates for the origin address: ${originAddress}. Please check the address and try again.`
      };
    }
    
    if (!destGeocode.results || destGeocode.results.length === 0) {
      return {
        success: false,
        response: `I couldn't find coordinates for the destination address: ${destinationAddress}. Please check the address and try again.`
      };
    }
    
    const origin = originGeocode.results[0].position;
    const destination = destGeocode.results[0].position;
    
    console.log('✅ Geocoding successful');
    console.log('📍 Origin coordinates:', origin);
    console.log('📍 Destination coordinates:', destination);
    
    // Step 3: Calculate route using TomTom API
    console.log('🚗 Calculating route...');
    const routeResult = await calculateRoute(
      { lat: origin.lat, lon: origin.lon },
      { lat: destination.lat, lon: destination.lon }
    );
    
    if (!routeResult.routes || routeResult.routes.length === 0) {
      return {
        success: false,
        response: `I couldn't find a route from ${originAddress} to ${destinationAddress}. Please check the addresses and try again.`
      };
    }
    
    // Step 4: Format response (deterministic)
    const route = routeResult.routes[0];
    const summary = route.summary;
    
    let response = `Here's your route from ${originAddress} to ${destinationAddress}:\n\n`;
    response += `🚗 **Driving Time:** ${Math.round(summary.travelTimeInSeconds / 60)} minutes\n`;
    response += `📏 **Distance:** ${(summary.lengthInMeters / 1000).toFixed(1)} km\n`;
    response += `⛽ **Fuel Cost:** ${summary.fuelCostInUSD ? `$${summary.fuelCostInUSD.toFixed(2)}` : 'Not available'}\n\n`;
    response += `📍 **From:** ${originAddress}\n`;
    response += `📍 **To:** ${destinationAddress}`;
    
    // Update context with the route information
    const updated_context = {
      lastCoordinates: { lat: destination.lat, lon: destination.lon },
      lastLocation: { source: 'address', address: destinationAddress }
    };
    
    console.log('✅ Directions processing complete');
    
    return {
      success: true,
      response: response,
      updated_context: updated_context
    };
    
  } catch (error) {
    console.error('Error in processDirectionsSequential:', error);
    return {
      success: false,
      error: error.message,
      response: `I'm having trouble calculating directions right now. Please try again later.`
    };
  }
}

// Sequential processing for matrix routing (geocoding + matrix)
async function processMatrixRoutingSequential(searchQuery, userContext) {
  try {
    console.log('🔄 Processing matrix routing sequentially:', searchQuery);
    
    // Step 1: Extract locations using regex (deterministic)
    const locations = extractLocationsFromQuery(searchQuery);
    
    if (locations.length < 2) {
      return {
        success: false,
        response: `I need at least 2 locations for matrix routing. Please provide locations like "matrix routing from A, B to X, Y" or "matrix routing between A, B, C".`
      };
    }
    
    console.log('📍 Extracted locations:', locations);
    
    // Step 2: Geocode all locations (parallel API calls)
    console.log('🔍 Geocoding all locations...');
    const geocodeResults = await Promise.all(
      locations.map(location => geocodeAddress(location))
    );
    
    // Filter successful geocoding results
    const geocodedLocations = [];
    for (let i = 0; i < geocodeResults.length; i++) {
      if (geocodeResults[i].results && geocodeResults[i].results.length > 0) {
        geocodedLocations.push({
          address: locations[i],
          coordinates: geocodeResults[i].results[0].position
        });
      } else {
        console.warn(`Failed to geocode: ${locations[i]}`);
      }
    }
    
    if (geocodedLocations.length < 2) {
      return {
        success: false,
        response: `I couldn't find coordinates for enough locations. Please check the addresses and try again.`
      };
    }
    
    console.log('✅ Geocoding successful for', geocodedLocations.length, 'locations');
    
    // Step 3: Calculate matrix routing using TomTom API
    console.log('📊 Calculating travel time matrix...');
    const matrixResult = await calculateMatrixRouting(geocodedLocations);
    
    if (!matrixResult || !matrixResult.matrix) {
      return {
        success: false,
        response: `I couldn't calculate the travel time matrix for those locations. Please check the addresses and try again.`
      };
    }
    
    // Step 4: Format response (deterministic)
    let response = `Here's the travel time matrix for your locations:\n\n`;
    
    // Format the matrix as a table
    const matrix = matrixResult.matrix;
    const locationNames = geocodedLocations.map(loc => loc.address);
    
    response += `| From \\ To | ${locationNames.join(' | ')} |\n`;
    response += `|-----------|${locationNames.map(() => '--------').join('|')}|\n`;
    
    for (let i = 0; i < matrix.length; i++) {
      response += `| **${locationNames[i]}** | `;
      for (let j = 0; j < matrix[i].length; j++) {
        if (i === j) {
          response += `- | `;
        } else {
          const travelTime = matrix[i][j];
          if (travelTime && travelTime > 0) {
            response += `${Math.round(travelTime / 60)} min | `;
          } else {
            response += `N/A | `;
          }
        }
      }
      response += `\n`;
    }
    
    response += `\n📍 **Locations:**\n`;
    geocodedLocations.forEach((loc, index) => {
      response += `${index + 1}. ${loc.address}\n`;
    });
    
    console.log('✅ Matrix routing processing complete');
    
    return {
      success: true,
      response: response,
      updated_context: {
        lastCoordinates: geocodedLocations[geocodedLocations.length - 1].coordinates,
        lastLocation: { source: 'address', address: geocodedLocations[geocodedLocations.length - 1].address }
      }
    };
    
  } catch (error) {
    console.error('Error in processMatrixRoutingSequential:', error);
    return {
      success: false,
      error: error.message,
      response: `I'm having trouble calculating the travel time matrix right now. Please try again later.`
    };
  }
}

// Helper function to extract locations from query
function extractLocationsFromQuery(searchQuery) {
  const locations = [];
  
  // Try "from A, B to X, Y" pattern
  const fromToMatch = searchQuery.match(/from\s+(.+?)\s+to\s+(.+)/i);
  if (fromToMatch) {
    const origins = fromToMatch[1].split(',').map(addr => addr.trim());
    const destinations = fromToMatch[2].split(',').map(addr => addr.trim());
    locations.push(...origins, ...destinations);
    return locations;
  }
  
  // Try "between A, B, C" pattern
  const betweenMatch = searchQuery.match(/between\s+(.+)/i);
  if (betweenMatch) {
    const locationList = betweenMatch[1].split(',').map(addr => addr.trim());
    locations.push(...locationList);
    return locations;
  }
  
  // Try comma-separated list
  const commaMatch = searchQuery.match(/([^,]+(?:,\s*[^,]+)+)/);
  if (commaMatch) {
    const locationList = commaMatch[1].split(',').map(addr => addr.trim());
    locations.push(...locationList);
    return locations;
  }
  
  return locations;
}

async function calculateMatrixRouting(locations) {
  try {
    // TomTom Matrix Routing API endpoint
    const matrixUrl = 'https://api.tomtom.com/routing/1/matrix/sync/json';
    
    // Prepare origins and destinations (for matrix routing, we use all locations as both origins and destinations)
    const origins = locations.map(loc => `${loc.coordinates.lat},${loc.coordinates.lon}`);
    const destinations = locations.map(loc => `${loc.coordinates.lat},${loc.coordinates.lon}`);
    
    const params = {
      key: TOMTOM_API_KEY,
      origins: origins.join(';'),
      destinations: destinations.join(';'),
      travelMode: 'car',
      traffic: 'true'
    };

    console.log('Matrix routing request:', params);
    const response = await axios.get(matrixUrl, { params });
    
    if (response.data && response.data.matrix) {
      // Convert TomTom matrix format to our format
      const matrix = response.data.matrix;
      const travelTimes = [];
      
      for (let i = 0; i < matrix.length; i++) {
        const row = [];
        for (let j = 0; j < matrix[i].length; j++) {
          if (i === j) {
            row.push(0); // Same location
          } else {
            const route = matrix[i][j];
            if (route && route.summary) {
              row.push(route.summary.travelTimeInSeconds);
            } else {
              row.push(-1); // No route found
            }
          }
        }
        travelTimes.push(row);
      }
      
      return {
        matrix: travelTimes,
        origins: locations.map(loc => loc.address),
        destinations: locations.map(loc => loc.address)
      };
    }
    
    return { matrix: [] };
  } catch (error) {
    console.error('Error calculating matrix routing:', error);
    throw error;
  }
}

async function generateStaticMapUrl(center, zoom = 12, markers = []) {
  try {
    const params = new URLSearchParams({
      key: TOMTOM_API_KEY,
      center: `${center.lat},${center.lon}`,
      zoom: zoom.toString(),
      width: '600',
      height: '400',
      format: 'png'
    });

    if (markers.length > 0) {
      markers.forEach((marker, index) => {
        params.append(`markers`, `${marker.lat},${marker.lon},${marker.label || 'marker'}`);
      });
    }

    return `${TOMTOM_STATICMAP_URL}?${params.toString()}`;
  } catch (error) {
    console.error('TomTom Static Map API error:', error.message);
    throw new Error('Failed to generate static map');
  }
}

// Orchestrator Handlers
async function handleOrchestratorChat(rpcRequest, res) {
  const startTime = Date.now();
  const correlationId = `orchestrator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const operation = {
    component: 'orchestrator',
    operationType: 'chat',
    userId: rpcRequest.params.user_id || 'default',
    input: rpcRequest.params,
    correlationId: correlationId,
    success: false,
    output: null,
    error: null,
    duration: 0,
    agentUsed: '',
    queryType: ''
  };

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
    
    // Use LLM-based context extraction and intent understanding
    const contextAnalysis = await extractContextAndIntent(message, userContext, conversationContext);
    
    // Debug: Log the LLM analysis
    console.log('=== LLM ANALYSIS RESULT ===');
    console.log('Intent:', contextAnalysis.intent);
    console.log('Tool needed:', contextAnalysis.tool_needed);
    console.log('Location context:', JSON.stringify(contextAnalysis.location_context, null, 2));
    console.log('Search query:', contextAnalysis.search_query);
    console.log('Confidence:', contextAnalysis.confidence);
    console.log('=== END LLM ANALYSIS ===');
    
    // Update context with extracted information
    if (contextAnalysis.location_context && contextAnalysis.location_context.source !== 'none') {
      updateUserContext(user_id, {
        lastLocation: contextAnalysis.location_context,
        lastCoordinates: contextAnalysis.location_context.coordinates || userContext.lastCoordinates
      });
    }
    
    // Route based on LLM analysis
    let response = '';
    let agent_used = '';
    let query_type = 'general';
    
    // Check if this is a location-based query that should go to Maps Agent
    const locationIntents = ['search_places', 'geocode', 'directions', 'matrix_routing', 'reverse_geocode', 'static_map'];
    const locationTools = ['search_places', 'geocode_address', 'calculate_route', 'matrix_routing', 'reverse_geocode_address', 'static_map'];
    
    if (locationIntents.includes(contextAnalysis.intent) && locationTools.includes(contextAnalysis.tool_needed)) {
      agent_used = 'maps_agent';
      query_type = 'location';
      
      try {
        // Prepare the request for Maps Agent - let it handle all TomTom API calls
        const mapsAgentRequest = {
          intent: contextAnalysis.intent,
          location_context: contextAnalysis.location_context,
          search_query: contextAnalysis.search_query,
          tool_needed: contextAnalysis.tool_needed,
          user_context: {
            lastLocation: userContext.lastLocation,
            lastCoordinates: userContext.lastCoordinates
          }
        };

        // Call Maps Agent with the complete context - let it handle all TomTom API interactions
        const mapsResult = await callMapsAgent('process_location_request', mapsAgentRequest);
        
        if (mapsResult && mapsResult.success) {
          response = mapsResult.response;
          // Update context with any new location information from Maps Agent
          if (mapsResult.updated_context) {
            updateUserContext(user_id, mapsResult.updated_context);
          }
        } else {
          response = mapsResult?.error || "I'm having trouble connecting to the Maps service right now. Please try again later.";
        }
      } catch (error) {
        console.error('Error calling Maps Agent:', error);
        response = `I'm having trouble connecting to the Maps service right now. Please try again later.`;
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
        throw new Error(`LLM processing failed: ${error.message}`);
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
    
    // Update operation with success
    operation.success = true;
    operation.output = { response, agent_used, query_type };
    operation.agentUsed = agent_used;
    operation.queryType = query_type;
    operation.duration = Date.now() - startTime;
    
    // Observe the orchestrator operation
    if (observability) {
      await observability.observeOperation(operation);
    }
    
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
    
    // Update operation with error
    operation.success = false;
    operation.error = error.message;
    operation.duration = Date.now() - startTime;
    
    // Observe the failed orchestrator operation
    if (observability) {
      await observability.observeOperation(operation);
    }
    
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

async function handleOrchestratorContext(rpcRequest, res) {
  const { user_id, action = 'get', context } = rpcRequest.params;
  
  if (action === 'set' && context) {
    updateUserContext(user_id, context);
  }
  
  const userContext = getUserContext(user_id);
  
  return res.json({
    jsonrpc: '2.0',
    id: rpcRequest.id,
    result: {
      context: {
        current_location: userContext.lastLocation,
        last_coordinates: userContext.lastCoordinates,
        conversation_history: userContext.conversationHistory.slice(-10)
      }
    }
  });
}

// Maps Agent MCP Handlers
async function handleMapsInitialize(rpcRequest, res) {
  return res.json({
    jsonrpc: '2.0',
    id: rpcRequest.id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'Maps Agent MCP Server',
        version: '1.0.0'
      }
    }
  });
}

async function handleMapsToolsList(rpcRequest, res) {
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

async function handleMapsToolsCall(rpcRequest, res) {
  const params = rpcRequest.params || {};
  const name = params.name;
  const args = params.arguments || {};
  
  if (!name) {
    return res.json({
      jsonrpc: '2.0',
      id: rpcRequest.id,
      error: {
        code: -32602,
        message: 'Tool name is required'
      }
    });
  }
  
  try {
    let result;
    
    switch (name) {
      case 'maps.search':
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

// Maps Agent: Process location requests using MCP internally
async function processLocationRequest(payload) {
  const { intent, location_context, search_query, user_context } = payload;
  
  try {
    let response = '';
    let updated_context = null;
    
    // Check if this requires sequential tool calling (directions/matrix with addresses)
    const requiresSequential = ['directions', 'matrix_routing'].includes(intent) && 
                              (location_context.source === 'address' || search_query);
    
    if (requiresSequential) {
      console.log('🔄 Sequential tool calling required for:', intent);
      return await executeSequentialTools(intent, search_query, user_context);
    }
    
    // Single tool execution for simple queries
    return await executeSingleTool(intent, location_context, search_query, user_context);
    
  } catch (error) {
    console.error('Error in processLocationRequest:', error);
    return {
      success: false,
      error: error.message,
      response: "I'm having trouble processing your location request. Please try again."
    };
  }
}

// Execute sequential tools (geocoding + routing/matrix)
async function executeSequentialTools(intent, searchQuery, userContext) {
  try {
    let response = '';
    let updated_context = null;
    
    if (intent === 'directions') {
      return await processDirectionsSequential(searchQuery, userContext);
    } else if (intent === 'matrix_routing') {
      return await processMatrixRoutingSequential(searchQuery, userContext);
    }
    
    return {
      success: false,
      error: 'Unknown sequential intent',
      response: "I don't know how to process that type of request."
    };
  } catch (error) {
    console.error('Error in executeSequentialTools:', error);
    return {
      success: false,
      error: error.message,
      response: "I'm having trouble processing your request. Please try again."
    };
  }
}

// Execute single tool (search, geocoding, etc.)
async function executeSingleTool(intent, location_context, search_query, user_context) {
  try {
    let response = '';
    let updated_context = null;
    
    // Determine search location based on context analysis
    let searchLocation = null;
    
    if (location_context.source === 'coordinates') {
      searchLocation = location_context.coordinates;
    } else if (location_context.source === 'address') {
      // Use MCP to geocode the address
      console.log('Geocoding address:', location_context.address);
      try {
        const geocodeResult = await geocodeAddress(location_context.address);
        console.log('Geocoding result:', geocodeResult);
        if (geocodeResult && geocodeResult.results && geocodeResult.results.length > 0) {
          const coords = geocodeResult.results[0].position;
          searchLocation = { lat: coords.lat, lon: coords.lon };
          updated_context = {
            lastCoordinates: searchLocation,
            lastLocation: location_context
          };
        } else {
          console.log('No geocoding results found');
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        throw error;
      }
    } else if (location_context.source === 'context_reference' && user_context.lastCoordinates) {
      searchLocation = user_context.lastCoordinates;
    }
    
    if (!searchLocation) {
      // Fallback to default location
      searchLocation = { lat: 47.6062, lon: -122.3321 };
    }
    
        // Execute the appropriate tool based on intent
        switch (intent) {
          case 'search_places':
            try {
              // Try MCP tool first, fallback to direct API call
              let searchResult;
              try {
                searchResult = await mcpClient.callTool('mcp://tomtom/search', {
                  query: search_query || 'places',
                  lat: searchLocation.lat,
                  lon: searchLocation.lon,
                  radius: 5000,
                  limit: 10
                });
              } catch (mcpError) {
                console.log('MCP tool not available, using direct API call');
                searchResult = await searchLocationsOrbis(search_query || 'places', searchLocation);
              }
              
              if (searchResult && searchResult.places && searchResult.places.length > 0) {
                response = `I found ${searchResult.places.length} places for "${search_query || 'places'}":\n\n`;
                searchResult.places.slice(0, 3).forEach((place, index) => {
                  response += `${index + 1}. **${place.name || place.poi?.name || 'Unknown'}**\n`;
                  response += `   📍 ${place.address || place.formatted_address || 'Address not available'}\n`;
                  if (place.rating > 0) response += `   ⭐ ${place.rating}/5\n`;
                  if (place.distance) response += `   📏 ${place.distance} km away\n`;
                  response += '\n';
                });
              } else {
                response = `I couldn't find any places for "${search_query || 'places'}" near the specified location.`;
              }
            } catch (error) {
              console.error('Search tool error:', error);
              response = `I'm having trouble searching for places right now. Please try again later.`;
            }
            break;
        
          case 'geocode_address':
            try {
              // Try MCP tool first, fallback to direct API call
              let geocodeResult;
              try {
                geocodeResult = await mcpClient.callTool('mcp://tomtom/geocode', {
                  address: location_context.address,
                  limit: 1
                });
              } catch (mcpError) {
                console.log('MCP geocode tool not available, using direct API call');
                geocodeResult = await geocodeAddress(location_context.address);
              }
              
              if (geocodeResult && geocodeResult.results && geocodeResult.results.length > 0) {
                const coords = geocodeResult.results[0].position;
                const address = geocodeResult.results[0].address.freeformAddress || geocodeResult.results[0].address;
                response = `The coordinates for "${address}" are approximately ${coords.lat.toFixed(6)}° N, ${coords.lon.toFixed(6)}° E.`;
                updated_context = {
                  lastCoordinates: { lat: coords.lat, lon: coords.lon },
                  lastLocation: { source: 'address', address: address }
                };
              } else {
                response = `I couldn't find coordinates for that address.`;
              }
            } catch (error) {
              console.error('Geocode tool error:', error);
              response = `I'm having trouble geocoding that address. Please try again later.`;
            }
            break;
        
          case 'reverse_geocode':
            try {
              const reverseResult = await mcpClient.callTool('mcp://tomtom/reverse-geocode', {
                lat: location_context.coordinates.lat,
                lon: location_context.coordinates.lon
              });
              
              if (reverseResult && reverseResult.addresses && reverseResult.addresses.length > 0) {
                response = `The address for coordinates ${location_context.coordinates.lat}, ${location_context.coordinates.lon} is: ${reverseResult.addresses[0].address.freeformAddress}`;
              } else {
                response = `I couldn't find an address for those coordinates.`;
              }
            } catch (error) {
              console.error('MCP reverse geocode tool error:', error);
              response = `I'm having trouble reverse geocoding those coordinates. Please try again later.`;
            }
            break;
        
          case 'calculate_route':
            // This case is now handled by sequential processing
            response = `I can help you with location-based queries. What would you like to do?`;
            break;
        
          case 'matrix_routing':
            // This case is now handled by sequential processing
            response = `I can help you with location-based queries. What would you like to do?`;
            break;
        
      default:
        response = `I can help you with location-based queries. What would you like to do?`;
    }
    
    return {
      success: true,
      response: response,
      updated_context: updated_context
    };
    
  } catch (error) {
    console.error('Error in processLocationRequest:', error);
    return {
      success: false,
      error: error.message,
      response: "I'm having trouble processing your location request. Please try again."
    };
  }
}

// A2A Message Processing for Maps Agent
mapsA2A.processA2AMessage = async function(a2aMessage) {
  const { type, payload } = a2aMessage.message;
  
  try {
    switch (type) {
      case 'search_places':
        return await searchLocationsOrbis(payload.query, payload.location, payload.radius);
        
      case 'geocode_address':
        return await geocodeAddress(payload.address);
        
      case 'reverse_geocode':
        return await reverseGeocode(payload.lat, payload.lon);
        
      case 'calculate_route':
        return await calculateRoute(payload.origin, payload.destination);
        
      case 'generate_static_map':
        return { url: await generateStaticMapUrl(payload.center, payload.zoom, payload.markers) };
        
      case 'process_location_request':
        return await processLocationRequest(payload);
        
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

// A2A Message Processing for Orchestrator Agent
orchestratorA2A.processA2AMessage = async function(a2aMessage) {
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

// Cleanup functions
function cleanupConversationHistory(userId, limit) {
  const userContext = getUserContext(userId);
  if (userContext.conversationHistory.length > limit) {
    userContext.conversationHistory = userContext.conversationHistory.slice(-limit);
  }
}

function cleanupGlobalHistory(limit) {
  if (conversationHistory.length > limit) {
    conversationHistory = conversationHistory.slice(-limit);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Unified A2A + MCP Server running on port ${PORT}`);
  console.log(`📍 TomTom API Key: ${TOMTOM_API_KEY ? 'Configured' : 'Missing'}`);
  console.log(`🤖 LLM Providers: ${OPENAI_API_KEY ? 'OpenAI' : 'None'}, ${ANTHROPIC_API_KEY ? 'Anthropic' : 'None'}`);
  console.log(`🔧 JSON-RPC Endpoint: http://localhost:${PORT}/`);
  console.log(`🤝 A2A Endpoint: http://localhost:${PORT}/a2a`);
  console.log(`🗺️  Maps MCP Endpoint: http://localhost:${PORT}/maps`);
  console.log(`🌐 Health Check: http://localhost:${PORT}/`);
  
  // Initialize MCP client
  await initializeMCPClient();
  
  // Log system startup event
  if (observability) {
    await observability.logSystemEvent({
      eventType: 'server_startup',
      component: 'unified_server',
      message: 'Unified A2A + MCP Server started successfully',
      data: {
        port: PORT,
        tomtomConfigured: !!TOMTOM_API_KEY,
        openaiConfigured: !!OPENAI_API_KEY,
        anthropicConfigured: !!ANTHROPIC_API_KEY
      },
      severity: 'INFO'
    });
  }
});
