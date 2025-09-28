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
    console.log('   Make sure MCP Tool Server is running on', MCP_TOOL_SERVER_URL);
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
// Initialize observability (disabled for testing)
const observability = null; // Disabled for testing - enable when credentials are available

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

LOCATION QUERY INDICATORS:
- "find", "search", "near", "close to", "restaurants", "coffee shops", "places"
- "coordinates", "address", "geocode", "lat", "long", "latitude", "longitude"
- "directions", "route", "how to get to", "drive to"
- "that address", "this location", "near me", "around here"

CONTEXT REFERENCES:
- "that address" = use last known address
- "near me" = use last known coordinates
- "this location" = use last known location

Respond with a JSON object in this exact format:
{
  "intent": "search_places|geocode|directions|general_chat",
  "location_context": {
    "source": "coordinates|address|context_reference|none",
    "coordinates": {"lat": number, "lon": number} | null,
    "address": "string" | null
  },
  "search_query": "string" | null,
  "tool_needed": "search_places|geocode_address|reverse_geocode|calculate_route|static_map|none",
  "confidence": 0.0-1.0
}`;

  try {
    let llmResponse = '';
    if (OPENAI_API_KEY) {
      llmResponse = await callOpenAI(contextPrompt, '', userContext.userId || 'default');
    } else if (ANTHROPIC_API_KEY) {
      llmResponse = await callAnthropic(contextPrompt, '', userContext.userId || 'default');
    } else {
      // Fallback to simple pattern matching if no LLM available
      return fallbackContextExtraction(message, userContext);
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
    console.warn('LLM context extraction failed, using fallback:', error.message);
    return fallbackContextExtraction(message, userContext);
  }
}

// Fallback context extraction for when LLM is not available
function fallbackContextExtraction(message, userContext) {
  // Look for coordinates pattern
  const coordPattern = /(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/;
  const coordMatch = message.match(coordPattern);
  if (coordMatch) {
    return {
      intent: 'search_places',
      location_context: {
        source: 'coordinates',
        coordinates: { lat: parseFloat(coordMatch[1]), lon: parseFloat(coordMatch[2]) },
        address: null
      },
      search_query: 'places',
      tool_needed: 'search_places',
      confidence: 0.8
    };
  }
  
  // Look for address patterns
  const addressPattern = /(\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct|Circle|Cir|Parkway|Pkwy|Highway|Hwy|Freeway|Fwy|Laan|Straat|Weg|Plein|Square|Plaza))/i;
  const addressMatch = message.match(addressPattern);
  if (addressMatch) {
    return {
      intent: 'search_places',
      location_context: {
        source: 'address',
        coordinates: null,
        address: addressMatch[1]
      },
      search_query: 'places',
      tool_needed: 'search_places',
      confidence: 0.7
    };
  }
  
  // Use context references
  const referencePattern = /(?:that|this|the)\s+(?:address|location|place)/i;
  if (referencePattern.test(message) && userContext.lastLocation) {
    return {
      intent: 'search_places',
      location_context: userContext.lastLocation,
      search_query: 'places',
      tool_needed: 'search_places',
      confidence: 0.6
    };
  }
  
  // Default to general chat
  return {
    intent: 'general_chat',
    location_context: { source: 'none', coordinates: null, address: null },
    search_query: null,
    tool_needed: 'none',
    confidence: 0.5
  };
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
    
    if (contextAnalysis.intent === 'search_places' && contextAnalysis.tool_needed === 'search_places') {
      agent_used = 'maps_agent';
      query_type = 'location';
      
      try {
        let searchLocation = null;
        let searchQuery = contextAnalysis.search_query || 'places';

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
  const { intent, location_context, search_query, tool_needed, user_context } = payload;
  
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
    
        // Execute the appropriate MCP tool based on intent
        switch (tool_needed) {
          case 'search_places':
            try {
              const searchResult = await mcpClient.callTool('mcp://tomtom/search', {
                query: search_query || 'places',
                lat: searchLocation.lat,
                lon: searchLocation.lon,
                radius: 5000,
                limit: 10
              });
              
              if (searchResult && searchResult.places && searchResult.places.length > 0) {
                response = `I found ${searchResult.places.length} places for "${search_query || 'places'}":\n\n`;
                searchResult.places.slice(0, 3).forEach((place, index) => {
                  response += `${index + 1}. **${place.name}**\n`;
                  response += `   📍 ${place.address}\n`;
                  if (place.rating > 0) response += `   ⭐ ${place.rating}/5\n`;
                  if (place.distance) response += `   📏 ${place.distance} km away\n`;
                  response += '\n';
                });
              } else {
                response = `I couldn't find any places for "${search_query || 'places'}" near the specified location.`;
              }
            } catch (error) {
              console.error('MCP search tool error:', error);
              response = `I'm having trouble searching for places right now. Please try again later.`;
            }
            break;
        
          case 'geocode_address':
            try {
              const geocodeResult = await mcpClient.callTool('mcp://tomtom/geocode', {
                address: location_context.address,
                limit: 1
              });
              
              if (geocodeResult && geocodeResult.results && geocodeResult.results.length > 0) {
                const coords = geocodeResult.results[0].position;
                response = `The coordinates for "${geocodeResult.results[0].address.freeformAddress}" are approximately ${coords.lat.toFixed(6)}° N, ${coords.lon.toFixed(6)}° E.`;
                updated_context = {
                  lastCoordinates: { lat: coords.lat, lon: coords.lon },
                  lastLocation: { source: 'address', address: geocodeResult.results[0].address.freeformAddress }
                };
              } else {
                response = `I couldn't find coordinates for that address.`;
              }
            } catch (error) {
              console.error('MCP geocode tool error:', error);
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
