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
const TOMTOM_FUZZY_SEARCH_URL = 'https://api.tomtom.com/search/2/search';
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

CRITICAL: "I want to go to [city]" and "I need to go to [city]" are ALWAYS trip planning statements and should be classified as general_chat, NEVER as search_places or directions.

CRITICAL CLASSIFICATION RULES - READ THESE FIRST:
MANDATORY EXAMPLES - COPY THESE EXACTLY:
- "I am going to Paris" → general_chat (trip planning statement, NOT search)
- "I'm planning to visit London" → general_chat (trip planning statement, NOT search)
- "I'm traveling to Tokyo" → general_chat (trip planning statement, NOT search)
- "I want to go to Paris" → general_chat (trip planning statement, NOT search)
- "I need to go to London" → general_chat (trip planning statement, NOT search)
- "I'm visiting [city], what should I see?" → general_chat (trip planning with question, NOT search)
- "I'm traveling to [city], any recommendations?" → general_chat (trip planning with question, NOT search)
- "Find restaurants in Paris" → search_places (explicit search request)
- "What are the coordinates for Paris?" → geocode (explicit geocoding request)
- "Directions from Paris to London" → directions (explicit directions request)
- "Where is the Eiffel Tower?" → geocode (landmark location request)

IMPORTANT: If the user says "I want to go to [city]" or "I need to go to [city]", this is ALWAYS general_chat, NEVER search_places or directions.

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
3. QUERY PROCESSING: What should be searched for or what action should be taken? (for directions/matrix, extract the full query with locations)
4. AGENT ROUTING: Which agent should handle this request?

IMPORTANT FOR DIRECTIONS/MATRIX ROUTING:
- For directions queries like "directions from A to B", set search_query to "from A to B"
- For matrix queries like "matrix from A to B", set search_query to "from A to B"
- For matrix queries like "matrix routing between A, B, C", set search_query to "between A, B, C"
- For "both A and B" patterns, set search_query to "both A and B" (not "from A to B")
- For matrix routing with "A and B", set search_query to "A and B" (not "from A to B")
- NEVER use placeholder text like "[current location]" - use actual location names

LOCATION QUERY INDICATORS (be precise in detection):
- SEARCH QUERIES: "find", "search", "near", "close to", "restaurants", "coffee shops", "places", "shops", "stores", "hotels", "gas stations", "pharmacy", "hospital", "bank", "atm", "nearby", "around", "in the area"
- GEOCODING QUERIES: "coordinates", "address", "geocode", "lat", "long", "latitude", "longitude", "where is", "location of", "exact location", "what are the coordinates", "get coordinates", "find coordinates"
- DIRECTIONS QUERIES: "directions", "route", "how to get to", "drive to", "walk to", "travel to", "go to", "navigate to", "how do I get", "how long does it take", "travel time", "driving time", "walking time", "distance", "from X to Y", "get from", "travel from", "go from", "navigate from"
- MATRIX ROUTING QUERIES: "matrix routing", "travel time matrix", "distance matrix", "compare travel times", "between multiple locations", "from A, B to X, Y", "travel times between", "compare routes", "matrix", "travel matrix", "distance matrix", "compare travel", "multiple locations", "from X to Y to Z", "matrix from", "travel times between", "compare routes between", "matrix from X to Y", "travel time matrix from X to Y"
- REVERSE GEOCODING: "what is this address", "address of these coordinates", "reverse geocode"
- STATIC MAPS: "show me a map", "map of", "visualize", "display map"

GENERAL CONVERSATION INDICATORS (NOT location-based):
- WEATHER QUERIES: "weather", "temperature", "forecast", "rain", "sunny", "cloudy", "snow", "tell me about the weather", "what's the weather like"
- GENERAL KNOWLEDGE: "tell me about", "explain", "what is", "how does", "why", "when", "who", "history", "facts"
- GREETINGS: "hello", "hi", "good morning", "good afternoon", "good evening", "how are you"
- CONVERSATION: "thank you", "thanks", "please", "help", "assist", "can you", "could you"
- TRIP PLANNING STATEMENTS: "I am going to", "I'm planning to visit", "I'm traveling to", "I'm visiting", "I'm heading to", "I'm going to be in", "I'm staying in", "I want to go to", "I need to go to", "I'm going to be visiting"
- INFORMATIONAL STATEMENTS: "I am in", "I'm in", "I'm at", "I'm currently in", "I'm staying at", "I'm visiting", "I'm going to be in"

IMPORTANT: 
- Weather queries like "tell me about the weather in [location]" should be classified as general_chat, not location-based, even if they mention a location name.
- Trip planning statements like "I am going to Paris" or "I'm planning to visit London" should be classified as general_chat, not search_places, even if they mention a location name.
- Trip planning with questions like "I'm visiting London, what should I see?" or "I'm traveling to Tokyo, any recommendations?" should be classified as general_chat, not search_places.
- Only classify as location-based if the user is explicitly asking for maps, places, directions, or geocoding services.

CLASSIFICATION EXAMPLES:
- "I am going to Paris" → general_chat (trip planning statement)
- "I'm planning to visit London" → general_chat (trip planning statement)
- "I'm traveling to Tokyo" → general_chat (trip planning statement)
- "I'm visiting New York" → general_chat (trip planning statement)
- "Find restaurants in Paris" → search_places (explicit search request)
- "What are the coordinates for Paris?" → geocode (explicit geocoding request)
- "Directions from Paris to London" → directions (explicit directions request)
- "Tell me about the weather in Paris" → general_chat (weather query)

CONTEXT REFERENCES:
- "that address" = use last known address
- "near me" = use last known coordinates
- "this location" = use last known location
- "here" = use last known location
- "there" = use last known location
- "get there from X" = use last known location as destination, X as origin
- "from X to there" = use last known location as destination, X as origin

DIRECTIONS QUERY EXAMPLES:
- "how does it take for me to travel from X to Y" → directions intent
- "directions from X to Y" → directions intent
- "how do I get from X to Y" → directions intent
- "travel time from X to Y" → directions intent
- "how long to get from X to Y" → directions intent
- "from X to Y" → directions intent
- "get from X to Y" → directions intent
- "route from X to Y" → directions intent

IMPORTANT: Be precise in detecting location-based queries. Only classify as location query if it clearly involves maps, places, directions, or geocoding. Weather, general knowledge, and conversation queries should go to General AI Agent.

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
      console.log('OpenAI raw response:', llmResponse);
    } else if (ANTHROPIC_API_KEY) {
      console.log('Using Anthropic for context extraction');
      llmResponse = await callAnthropic(contextPrompt, '', userContext.userId || 'default');
      console.log('Anthropic raw response:', llmResponse);
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
    model: 'gpt-4.1',
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
      model: 'gpt-4.1',
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
    console.log('=== CALL MAPS AGENT DEBUG ===');
    console.log('Message type:', messageType);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
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
    
    console.log('A2A Message:', JSON.stringify(a2aMessage, null, 2));
    
    // Process the A2A message directly
    const result = await mapsA2A.processA2AMessage(a2aMessage);
    
    console.log('A2A Result:', JSON.stringify(result, null, 2));
    
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
async function searchLocationsOrbis(query, location, radius = 5000, geobias = null) {
  const startTime = Date.now();
  const correlationId = `tomtom-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const apiCall = {
    component: 'tomtomApi',
    endpoint: 'search',
    method: 'GET',
    params: { query, location, radius, geobias },
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
      limit: 10
    };

    // Add geobias if provided
    if (geobias) {
      params.geobias = geobias;
      console.log('🌍 Using geobias in search:', geobias);
    }

    // Use regular Search API with geobias support instead of Orbis
    const url = `${TOMTOM_SEARCH_URL}/${encodeURIComponent(query)}.json?${new URLSearchParams(params)}`;
    
    console.log('🔍 Search URL:', url);
    const response = await axios.get(url);
    
    let result;
    if (response.data && response.data.results) {
      result = {
        places: response.data.results.map(place => ({
          name: place.poi?.name || place.address?.freeformAddress || 'Unknown',
          formatted_address: place.address?.freeformAddress || place.address?.formattedAddress || 'Address not available',
          address: place.address?.freeformAddress || place.address?.formattedAddress || 'Address not available',
          rating: place.poi?.rating || 0,
          distance: place.dist ? (place.dist / 1000).toFixed(2) : null,
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

// LLM-based geobias determination function
async function determineGeobiasWithLLM(query, userContext) {
  try {
    const queryLower = query.toLowerCase();
    
    // First, try direct keyword matching for major cities
    if (queryLower.includes('london')) {
      console.log('🌍 Direct match: London detected');
      return 'point:51.5074,-0.1278';
    }
    if (queryLower.includes('paris')) {
      console.log('🌍 Direct match: Paris detected');
      return 'point:48.8566,2.3522';
    }
    if (queryLower.includes('amsterdam')) {
      console.log('🌍 Direct match: Amsterdam detected');
      return 'point:52.3676,4.9041';
    }
    if (queryLower.includes('tokyo')) {
      console.log('🌍 Direct match: Tokyo detected');
      return 'point:35.6762,139.6503';
    }
    if (queryLower.includes('new york')) {
      console.log('🌍 Direct match: New York detected');
      return 'point:40.7128,-74.0060';
    }
    if (queryLower.includes('washington') || queryLower.includes('white house')) {
      console.log('🌍 Direct match: Washington DC detected');
      return 'point:38.9072,-77.0369';
    }
    if (queryLower.includes('los angeles') || queryLower.includes('hollywood')) {
      console.log('🌍 Direct match: Los Angeles detected');
      return 'point:34.0522,-118.2437';
    }
    if (queryLower.includes('san francisco')) {
      console.log('🌍 Direct match: San Francisco detected');
      return 'point:37.7749,-122.4194';
    }
    if (queryLower.includes('chicago')) {
      console.log('🌍 Direct match: Chicago detected');
      return 'point:41.8781,-87.6298';
    }
    if (queryLower.includes('boston')) {
      console.log('🌍 Direct match: Boston detected');
      return 'point:42.3601,-71.0589';
    }
    if (queryLower.includes('miami')) {
      console.log('🌍 Direct match: Miami detected');
      return 'point:25.7617,-80.1918';
    }
    if (queryLower.includes('seattle')) {
      console.log('🌍 Direct match: Seattle detected');
      return 'point:47.6062,-122.3321';
    }
    
    // If no direct match, use user context as fallback
    if (userContext && userContext.lastCoordinates) {
      const { lat, lon } = userContext.lastCoordinates;
      console.log('🌍 Using user context geobias:', `point:${lat},${lon}`);
      return `point:${lat},${lon}`;
    }
    
    console.log('🌍 No specific location detected, no geobias applied');
    return null;
    
  } catch (error) {
    console.error('Error determining geobias with LLM:', error);
    return null;
  }
}

// Smart geocoding function that uses LLM to determine appropriate geobias
async function geocodeLocation(query, geobias = null, userContext = null) {
  try {
    console.log('🔍 Geocoding query:', query);
    
    // Determine geobias using LLM intelligence
    let determinedGeobias = geobias;
    
    if (!determinedGeobias) {
      determinedGeobias = await determineGeobiasWithLLM(query, userContext);
    }
    
    if (determinedGeobias) {
      console.log('🌍 Using geobias:', determinedGeobias);
    }
    
    // Use TomTom Fuzzy Search API for all geocoding (addresses and POIs)
    const encodedQuery = encodeURIComponent(query);
    const params = new URLSearchParams({
      key: TOMTOM_API_KEY,
      limit: 1
    });
    
    // Add geobias if determined
    if (determinedGeobias) {
      params.append('geobias', determinedGeobias);
    }
    
    const url = `${TOMTOM_FUZZY_SEARCH_URL}/${encodedQuery}.json?${params.toString()}`;
    
    console.log('🌐 Geocoding URL:', url);
    const response = await axios.get(url);
    
    if (response.data && response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      const coords = result.position;
      const address = result.address?.freeformAddress || result.address?.formattedAddress || query;
      
      console.log('✅ Geocoding successful:', { coords, address });
      
      return {
        success: true,
        coordinates: { lat: coords.lat, lon: coords.lon },
        address: address,
        raw_result: result
      };
    }
    
    console.log('❌ No geocoding results found');
    return {
      success: false,
      error: 'No results found for the given location'
    };
  } catch (error) {
    console.error('❌ Geocoding error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
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
    // TomTom Orbis Maps API format: /maps/orbis/routing/calculateRoute/{routePlanningLocations}/{contentType}?key={Your_API_Key}
    const routePlanningLocations = `${origin.lat},${origin.lon}:${destination.lat},${destination.lon}`;
    const routeUrl = `${TOMTOM_ROUTING_URL}/${routePlanningLocations}/json`;
    const params = {
      key: TOMTOM_API_KEY,
      apiVersion: 2,
      travelMode: 'car',
      traffic: 'live'
    };

    console.log('Routing request URL:', routeUrl);
    console.log('Routing request params:', params);
    const response = await axios.get(routeUrl, { params });
    console.log('Routing response status:', response.status);
    console.log('Routing response data:', JSON.stringify(response.data, null, 2));
    
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
    
    let originAddress = routeMatch[1].trim();
    let destinationAddress = routeMatch[2].trim();
    
    // Handle context references
    if (destinationAddress.toLowerCase().includes('there') || destinationAddress.toLowerCase().includes('[current location]')) {
      if (userContext.lastLocation && userContext.lastLocation.address) {
        destinationAddress = userContext.lastLocation.address;
        console.log(`📍 Using context reference for destination: ${destinationAddress}`);
      } else {
        return {
          success: false,
          response: `I don't have a previous location to reference. Please provide a specific destination address.`
        };
      }
    }
    
    if (originAddress.toLowerCase().includes('there') || originAddress.toLowerCase().includes('[current location]')) {
      if (userContext.lastLocation && userContext.lastLocation.address) {
        originAddress = userContext.lastLocation.address;
        console.log(`📍 Using context reference for origin: ${originAddress}`);
      } else {
        return {
          success: false,
          response: `I don't have a previous location to reference. Please provide a specific origin address.`
        };
      }
    }
    
    console.log('📍 Extracted origin:', originAddress);
    console.log('📍 Extracted destination:', destinationAddress);
    
    // Step 2: Geocode both addresses (parallel API calls)
    console.log('🔍 Geocoding addresses...');
    const [originGeocode, destGeocode] = await Promise.all([
      geocodeLocation(originAddress, null, userContext),
      geocodeLocation(destinationAddress, null, userContext)
    ]);
    
    if (!originGeocode.success) {
      return {
        success: false,
        response: `I couldn't find coordinates for the origin address: ${originAddress}. Please check the address and try again.`
      };
    }
    
    if (!destGeocode.success) {
      return {
        success: false,
        response: `I couldn't find coordinates for the destination address: ${destinationAddress}. Please check the address and try again.`
      };
    }
    
    const origin = originGeocode.coordinates;
    const destination = destGeocode.coordinates;
    
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
      locations.map(location => geocodeLocation(location, null, userContext))
    );
    
    // Filter successful geocoding results
    const geocodedLocations = [];
    for (let i = 0; i < geocodeResults.length; i++) {
      if (geocodeResults[i].success) {
        geocodedLocations.push({
          address: locations[i],
          coordinates: geocodeResults[i].coordinates
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
  
  console.log(`🔍 Extracting locations from: "${searchQuery}"`);
  
  // Try "from A, B to X, Y" pattern
  const fromToMatch = searchQuery.match(/from\s+(.+?)\s+to\s+(.+)/i);
  if (fromToMatch) {
    const origins = fromToMatch[1].split(',').map(addr => addr.trim());
    const destinations = fromToMatch[2].split(',').map(addr => addr.trim());
    locations.push(...origins, ...destinations);
    console.log(`📍 From/To pattern found: origins=${origins}, destinations=${destinations}`);
    return locations;
  }
  
  // Try "between A, B, C" pattern
  const betweenMatch = searchQuery.match(/between\s+(.+)/i);
  if (betweenMatch) {
    let locationList = betweenMatch[1].split(',').map(addr => addr.trim());
    
    // If no commas found, try splitting by "and"
    if (locationList.length === 1 && locationList[0].includes(' and ')) {
      locationList = locationList[0].split(/\s+and\s+/i).map(addr => addr.trim());
    }
    
    // Clean up any remaining "and" prefixes and empty strings
    locationList = locationList
      .map(addr => addr.replace(/^and\s+/i, '').trim())
      .filter(addr => addr.length > 0);
    
    locations.push(...locationList);
    console.log(`📍 Between pattern found: ${locationList}`);
    return locations;
  }
  
  // Try "A and B" pattern (e.g., "Central Park and Brooklyn Bridge")
  const andPattern = searchQuery.match(/([^,]+(?:\s+and\s+[^,]+)+)/i);
  if (andPattern) {
    const locationList = andPattern[1].split(/\s+and\s+/i).map(addr => addr.trim());
    locations.push(...locationList);
    console.log(`📍 And pattern found: ${locationList}`);
    return locations;
  }
  
  // Try "both A and B" pattern (e.g., "both Central Park and Brooklyn Bridge")
  const bothAndPattern = searchQuery.match(/both\s+(.+?)\s+and\s+(.+)/i);
  if (bothAndPattern) {
    const location1 = bothAndPattern[1].trim();
    const location2 = bothAndPattern[2].trim();
    locations.push(location1, location2);
    console.log(`📍 Both-And pattern found: ${[location1, location2]}`);
    return locations;
  }
  
  // Try comma-separated list with "and" (e.g., "A, B, and C")
  const commaAndMatch = searchQuery.match(/([^,]+(?:,\s*[^,]+)*,\s*and\s+[^,]+)/i);
  if (commaAndMatch) {
    const locationText = commaAndMatch[1];
    // Split by comma first, then handle "and" in the last part
    const parts = locationText.split(',');
    const lastPart = parts[parts.length - 1].trim();
    if (lastPart.startsWith('and ')) {
      const lastLocation = lastPart.substring(4).trim();
      const otherLocations = parts.slice(0, -1).map(addr => addr.trim());
      locations.push(...otherLocations, lastLocation);
      console.log(`📍 Comma+And pattern found: ${locations}`);
      return locations;
    }
  }
  
  // Try comma-separated list
  const commaMatch = searchQuery.match(/([^,]+(?:,\s*[^,]+)+)/);
  if (commaMatch) {
    const locationList = commaMatch[1].split(',').map(addr => addr.trim());
    locations.push(...locationList);
    console.log(`📍 Comma pattern found: ${locationList}`);
    return locations;
  }
  
  console.log(`📍 No pattern matched, returning empty array`);
  return locations;
}

async function calculateMatrixRouting(locations) {
  try {
    // TomTom Matrix Routing v2 API endpoint
    const matrixUrl = `https://api.tomtom.com/routing/matrix/2?key=${TOMTOM_API_KEY}`;
    
    // Prepare origins and destinations in the correct format for v2 API
    const origins = locations.map(loc => ({
      point: {
        latitude: loc.coordinates.lat,
        longitude: loc.coordinates.lon
      }
    }));
    const destinations = locations.map(loc => ({
      point: {
        latitude: loc.coordinates.lat,
        longitude: loc.coordinates.lon
      }
    }));
    
    const requestBody = {
      origins: origins,
      destinations: destinations,
      options: {
        departAt: 'now', // Required field - use current time
        travelMode: 'car',
        traffic: 'live', // Use live traffic for better accuracy
        routeType: 'fastest'
      }
    };

    console.log('Matrix routing URL:', matrixUrl);
    console.log('Matrix routing request body:', JSON.stringify(requestBody, null, 2));
    const response = await axios.post(matrixUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    console.log('Matrix routing response status:', response.status);
    console.log('Matrix routing response data:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.data) {
      // Handle TomTom Matrix Routing v2 API response format
      const matrixData = response.data.data;
      const statistics = response.data.statistics;
      
      console.log(`📊 Matrix routing results: ${statistics.successes}/${statistics.totalCount} successful`);
      if (statistics.failures > 0) {
        console.log(`⚠️  Matrix routing failures:`, statistics.failureDetails);
      }
      
      // Convert to matrix format
      const matrixSize = Math.sqrt(matrixData.length);
      const travelTimes = [];
      
      for (let i = 0; i < matrixSize; i++) {
        const row = [];
        for (let j = 0; j < matrixSize; j++) {
          const cellIndex = i * matrixSize + j;
          const cell = matrixData[cellIndex];
          
          if (i === j) {
            row.push(0); // Same location
          } else if (cell && cell.routeSummary) {
            row.push(cell.routeSummary.travelTimeInSeconds);
          } else if (cell && cell.detailedError) {
            console.log(`⚠️  Route error from ${i} to ${j}:`, cell.detailedError);
            row.push(-1); // No route found
          } else {
            row.push(-1); // No route found
          }
        }
        travelTimes.push(row);
      }
      
      return {
        matrix: travelTimes,
        origins: locations.map(loc => loc.address || 'Unknown'),
        destinations: locations.map(loc => loc.address || 'Unknown'),
        statistics: statistics
      };
    }
    
    return { matrix: [] };
  } catch (error) {
    console.error('Error calculating matrix routing:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
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
  console.log('🚨🚨🚨 ORCHESTRATOR CHAT FUNCTION CALLED 🚨🚨🚨');
  console.log('=== HANDLE ORCHESTRATOR CHAT DEBUG ===');
  console.log('RPC Request:', JSON.stringify(rpcRequest, null, 2));
  
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
    console.log('Message:', message);
    console.log('User ID:', user_id);
    
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
    console.log('Parsed contextAnalysis:', JSON.stringify(contextAnalysis, null, 2));
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
    
    console.log('=== ROUTING DEBUG ===');
    console.log('Intent:', contextAnalysis.intent);
    console.log('Tool needed:', contextAnalysis.tool_needed);
    console.log('Location intents includes intent:', locationIntents.includes(contextAnalysis.intent));
    console.log('Location tools includes tool:', locationTools.includes(contextAnalysis.tool_needed));
    
    if (locationIntents.includes(contextAnalysis.intent) && locationTools.includes(contextAnalysis.tool_needed)) {
      console.log('🔄 Routing to Maps Agent');
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
        result = await geocodeLocation(args.address);
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
    console.log('=== PROCESS LOCATION REQUEST DEBUG ===');
    console.log('Intent:', intent);
    console.log('Location context:', JSON.stringify(location_context, null, 2));
    console.log('Search query:', search_query);
    
    let response = '';
    let updated_context = null;
    
    // Check if this requires sequential tool calling (directions/matrix with addresses)
    const requiresSequential = ['directions', 'matrix_routing'].includes(intent) && 
                              (location_context.source === 'address' || search_query);
    
    if (requiresSequential) {
      console.log('🔄 Sequential tool calling required for:', intent);
      // For directions, we need to reconstruct the full query from the LLM analysis
      let fullQuery = search_query;
      if (intent === 'directions' && location_context.address) {
        fullQuery = `from ${location_context.address} to ${search_query}`;
      }
      console.log('🔄 Full query for sequential processing:', fullQuery);
      return await executeSequentialTools(intent, fullQuery, user_context);
    }
    
    // Single tool execution for simple queries (including geocoding)
    console.log('🔄 Using single tool execution for:', intent);
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
    
    // Handle geocoding queries with simple, direct approach
    if (intent === 'geocode' || intent === 'geocode_address') {
      console.log('🔍 Processing geocoding query');
      
      // Get the query from location_context or search_query
      const queryToGeocode = location_context.address || search_query;
      if (!queryToGeocode) {
        return {
          success: false,
          response: `I need a location to geocode. Please provide a specific place or address.`
        };
      }
      
      // Use the simple geocoding function
      const geocodeResult = await geocodeLocation(queryToGeocode, null, user_context);
      
      if (geocodeResult.success) {
        const { coordinates, address } = geocodeResult;
        response = `The coordinates for "${address}" are approximately ${coordinates.lat.toFixed(6)}° N, ${coordinates.lon.toFixed(6)}° E.`;
        updated_context = {
          lastCoordinates: coordinates,
          lastLocation: { source: 'address', address: address }
        };
      } else {
        response = `I couldn't find coordinates for "${queryToGeocode}". Please check the spelling or try a different location.`;
      }
      
      return {
        success: true,
        response: response,
        updated_context: updated_context
      };
    }
    
    // For other queries, determine search location based on context analysis
    let searchLocation = null;
    
    if (location_context.source === 'coordinates') {
      searchLocation = location_context.coordinates;
    } else if (location_context.source === 'address') {
      // Use MCP to geocode the address
      console.log('Geocoding address:', location_context.address);
      try {
        const geocodeResult = await geocodeLocation(location_context.address);
        console.log('Geocoding result:', geocodeResult);
        if (geocodeResult && geocodeResult.success) {
          const coords = geocodeResult.coordinates;
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
      // Try to extract location from search_query if it contains location hints
      if (search_query && (search_query.includes('near') || search_query.includes('close to'))) {
        // For queries like "coffee shops near Central Park", try to extract the location
        const locationMatch = search_query.match(/near\s+(.+?)(?:\s|$)/i) || 
                             search_query.match(/close to\s+(.+?)(?:\s|$)/i);
        if (locationMatch) {
          const locationName = locationMatch[1].trim();
          console.log('Attempting to geocode location from query:', locationName);
          try {
            const geocodeResult = await geocodeLocation(locationName);
            if (geocodeResult && geocodeResult.success) {
              const coords = geocodeResult.coordinates;
              searchLocation = { lat: coords.lat, lon: coords.lon };
              console.log('Successfully geocoded location from query:', searchLocation);
            }
          } catch (error) {
            console.log('Failed to geocode location from query:', error.message);
          }
        }
      }
      
      if (!searchLocation) {
        // Determine geobias for search instead of using hardcoded location
        const searchGeobias = await determineGeobiasWithLLM(search_query || 'places', user_context);
        if (searchGeobias) {
          // Extract coordinates from geobias string (point:lat,lon)
          const coords = searchGeobias.replace('point:', '').split(',');
          searchLocation = { lat: parseFloat(coords[0]), lon: parseFloat(coords[1]) };
          console.log('Using geobias-based search location:', searchLocation);
        } else {
          // Fallback to default location only if no geobias available
          searchLocation = { lat: 47.6062, lon: -122.3321 };
          console.log('Using default search location:', searchLocation);
        }
      }
    }
    
        // Execute the appropriate tool based on intent
        switch (intent) {
          case 'search_places':
          case 'search':
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
                // Determine geobias for search
                const searchGeobias = await determineGeobiasWithLLM(search_query || 'places', user_context);
                searchResult = await searchLocationsOrbis(search_query || 'places', searchLocation, 5000, searchGeobias);
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
              console.error('Search error details:', {
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
              response = `I'm having trouble searching for places right now. Please try again later.`;
            }
            break;
        
          case 'geocode':
          case 'geocode_address':
            // This case is handled at the top of the function
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
        return await geocodeLocation(payload.address);
        
      case 'reverse_geocode':
        return await reverseGeocode(payload.lat, payload.lon);
        
      case 'calculate_route':
        return await calculateRoute(payload.origin, payload.destination);
        
      case 'generate_static_map':
        return { url: await generateStaticMapUrl(payload.center, payload.zoom, payload.markers) };
        
      case 'process_location_request':
        console.log('=== A2A PROCESS_LOCATION_REQUEST DEBUG ===');
        console.log('Payload:', JSON.stringify(payload, null, 2));
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
          // Determine geobias for search instead of using hardcoded location
          const searchGeobias = await determineGeobiasWithLLM(searchQuery, user_context);
          let searchLocation = { lat: 47.6062, lon: -122.3321 }; // Default fallback
          if (searchGeobias) {
            const coords = searchGeobias.replace('point:', '').split(',');
            searchLocation = { lat: parseFloat(coords[0]), lon: parseFloat(coords[1]) };
            console.log('Using geobias-based search location for A2A:', searchLocation);
          }
          
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
