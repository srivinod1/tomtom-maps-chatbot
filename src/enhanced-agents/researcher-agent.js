#!/usr/bin/env node
/**
 * Researcher Agent - Tool calls, evidence gathering, data retrieval
 * Purpose: Decide when/how to call MCP tools; gather & normalize evidence with citations
 */

const A2AProtocol = require('../a2a-protocol');
const MCPClient = require('../mcp-client');

class ResearcherAgent {
  constructor(agentId, baseUrl, mcpToolServerUrl) {
    this.agentId = agentId;
    this.baseUrl = baseUrl;
    this.a2a = new A2AProtocol(agentId, 'researcher', baseUrl);
    this.mcpClient = new MCPClient(mcpToolServerUrl);
    this.setupMessageHandlers();
    this.initializeMCP();
  }

  async initializeMCP() {
    try {
      await this.mcpClient.discoverTools();
      console.log(`🔍 Researcher Agent initialized with ${this.mcpClient.getAvailableTools().length} tools`);
    } catch (error) {
      console.warn('⚠️  Researcher Agent MCP initialization failed:', error.message);
    }
  }

  setupMessageHandlers() {
    this.a2a.processA2AMessage = async (a2aMessage) => {
      const { envelope, payload } = a2aMessage;
      
      if (envelope.intent === 'GATHER_EVIDENCE') {
        return await this.gatherEvidence(payload);
      }
      
      if (envelope.intent === 'CALL_TOOL') {
        return await this.callTool(payload);
      }
      
      return {
        success: false,
        error: `Unknown intent: ${envelope.intent}`
      };
    };
  }

  /**
   * System Prompt for Researcher Agent
   */
  getSystemPrompt() {
    return `You are a Researcher Agent in a multi-agent system. Your role is to:

1. DECIDE when tool calls are needed based on the research task
2. EXECUTE appropriate MCP tool calls to gather evidence
3. NORMALIZE and structure the gathered data
4. PROVIDE citations and source attribution
5. HANDLE tool failures gracefully with fallbacks

AVAILABLE TOOLS:
- mcp://tomtom/search: Search for places
- mcp://tomtom/geocode: Convert address to coordinates
- mcp://tomtom/reverse-geocode: Convert coordinates to address
- mcp://tomtom/directions: Calculate routes
- mcp://tomtom/static-map: Generate map images

DECISION FRAMEWORK:
- If location search needed → use mcp://tomtom/search
- If address geocoding needed → use mcp://tomtom/geocode
- If coordinates to address needed → use mcp://tomtom/reverse-geocode
- If route calculation needed → use mcp://tomtom/directions
- If map visualization needed → use mcp://tomtom/static-map

OUTPUT FORMAT:
{
  "success": true/false,
  "evidence": {
    "data": "structured data from tools",
    "sources": ["source1", "source2"],
    "citations": ["citation1", "citation2"],
    "confidence": 0.0-1.0
  },
  "tool_calls": [
    {
      "tool": "tool_name",
      "input": {...},
      "output": {...},
      "success": true/false
    }
  ],
  "fallbacks_used": ["fallback1", "fallback2"]
}

RESEARCH PRINCIPLES:
- Always cite sources
- Normalize data formats
- Handle errors gracefully
- Use fallbacks when tools fail
- Provide confidence scores
- Structure data for downstream agents`;
  }

  /**
   * Gather evidence for a research task
   */
  async gatherEvidence(payload) {
    const { task, context, requirements } = payload;
    
    try {
      console.log(`🔍 Researcher Agent: Gathering evidence for task: ${task}`);
      
      const evidence = {
        data: {},
        sources: [],
        citations: [],
        confidence: 0.0
      };
      
      const toolCalls = [];
      const fallbacksUsed = [];
      
      // Analyze task and determine required tools
      const requiredTools = this.analyzeTaskRequirements(task, context);
      
      // Execute tool calls
      for (const toolReq of requiredTools) {
        try {
          const toolResult = await this.executeToolCall(toolReq);
          toolCalls.push(toolResult);
          
          if (toolResult.success) {
            evidence.data = { ...evidence.data, ...toolResult.normalizedData };
            evidence.sources.push(toolResult.source);
            evidence.citations.push(toolResult.citation);
            evidence.confidence = Math.max(evidence.confidence, toolResult.confidence);
          } else {
            // Try fallback
            const fallbackResult = await this.tryFallback(toolReq);
            if (fallbackResult.success) {
              fallbacksUsed.push(toolReq.tool);
              evidence.data = { ...evidence.data, ...fallbackResult.normalizedData };
              evidence.sources.push(fallbackResult.source);
              evidence.citations.push(fallbackResult.citation);
              evidence.confidence = Math.max(evidence.confidence, fallbackResult.confidence * 0.8); // Lower confidence for fallbacks
            }
          }
        } catch (error) {
          console.error(`Tool call failed for ${toolReq.tool}:`, error);
          toolCalls.push({
            tool: toolReq.tool,
            input: toolReq.input,
            output: null,
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        success: true,
        evidence: evidence,
        tool_calls: toolCalls,
        fallbacks_used: fallbacksUsed,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Researcher Agent error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Call a specific tool
   */
  async callTool(payload) {
    const { tool, input, context } = payload;
    
    try {
      console.log(`🔧 Researcher Agent: Calling tool ${tool}`);
      
      const result = await this.executeToolCall({
        tool: tool,
        input: input,
        context: context
      });
      
      return {
        success: true,
        result: result,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Tool call error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze task requirements and determine needed tools
   */
  analyzeTaskRequirements(task, context) {
    const requirements = [];
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('search') || taskLower.includes('find') || taskLower.includes('places')) {
      requirements.push({
        tool: 'mcp://tomtom/search',
        input: {
          query: this.extractSearchQuery(task),
          lat: context.lat || 52.3676, // Default to Amsterdam
          lon: context.lon || 4.9041,
          radius: 5000,
          limit: 10
        },
        priority: 'high'
      });
    }
    
    if (taskLower.includes('geocode') || taskLower.includes('coordinates')) {
      requirements.push({
        tool: 'mcp://tomtom/geocode',
        input: {
          address: this.extractAddress(task),
          limit: 1
        },
        priority: 'high'
      });
    }
    
    if (taskLower.includes('reverse') || taskLower.includes('address from coordinates')) {
      requirements.push({
        tool: 'mcp://tomtom/reverse-geocode',
        input: {
          lat: context.lat,
          lon: context.lon
        },
        priority: 'high'
      });
    }
    
    if (taskLower.includes('directions') || taskLower.includes('route')) {
      requirements.push({
        tool: 'mcp://tomtom/directions',
        input: {
          origin: { lat: context.originLat, lon: context.originLon },
          destination: { lat: context.destLat, lon: context.destLon }
        },
        priority: 'high'
      });
    }
    
    return requirements;
  }

  /**
   * Execute a tool call
   */
  async executeToolCall(toolReq) {
    try {
      const result = await this.mcpClient.callTool(toolReq.tool, toolReq.input);
      
      return {
        success: true,
        tool: toolReq.tool,
        input: toolReq.input,
        output: result,
        normalizedData: this.normalizeToolOutput(toolReq.tool, result),
        source: `TomTom ${toolReq.tool.split('//')[1]}`,
        citation: this.generateCitation(toolReq.tool, toolReq.input),
        confidence: this.calculateConfidence(toolReq.tool, result)
      };
      
    } catch (error) {
      return {
        success: false,
        tool: toolReq.tool,
        input: toolReq.input,
        output: null,
        error: error.message
      };
    }
  }

  /**
   * Try fallback method when tool fails
   */
  async tryFallback(toolReq) {
    // Implement fallback logic (e.g., direct API calls)
    console.log(`🔄 Trying fallback for ${toolReq.tool}`);
    
    // For now, return a basic fallback
    return {
      success: false,
      error: 'No fallback available'
    };
  }

  /**
   * Normalize tool output for consistent format
   */
  normalizeToolOutput(tool, output) {
    switch (tool) {
      case 'mcp://tomtom/search':
        return {
          places: output.places || [],
          total_results: output.places?.length || 0
        };
        
      case 'mcp://tomtom/geocode':
        return {
          coordinates: output.results?.[0]?.position || null,
          address: output.results?.[0]?.address?.freeformAddress || null
        };
        
      case 'mcp://tomtom/reverse-geocode':
        return {
          address: output.addresses?.[0]?.address?.freeformAddress || null
        };
        
      case 'mcp://tomtom/directions':
        return {
          routes: output.routes || [],
          total_routes: output.routes?.length || 0
        };
        
      default:
        return output;
    }
  }

  /**
   * Generate citation for tool output
   */
  generateCitation(tool, input) {
    const toolName = tool.split('//')[1];
    return `TomTom ${toolName} API - ${new Date().toISOString()}`;
  }

  /**
   * Calculate confidence score for tool output
   */
  calculateConfidence(tool, output) {
    // Simple confidence calculation based on output quality
    if (!output) return 0.0;
    
    switch (tool) {
      case 'mcp://tomtom/search':
        return output.places?.length > 0 ? 0.9 : 0.1;
        
      case 'mcp://tomtom/geocode':
        return output.results?.length > 0 ? 0.95 : 0.0;
        
      case 'mcp://tomtom/reverse-geocode':
        return output.addresses?.length > 0 ? 0.95 : 0.0;
        
      case 'mcp://tomtom/directions':
        return output.routes?.length > 0 ? 0.9 : 0.0;
        
      default:
        return 0.5;
    }
  }

  extractSearchQuery(task) {
    const words = task.toLowerCase().split(' ');
    const searchWords = words.filter(word => 
      !['find', 'search', 'for', 'near', 'me', 'the', 'a', 'an', 'and', 'or', 'but'].includes(word)
    );
    return searchWords.join(' ') || 'places';
  }

  extractAddress(task) {
    return task.replace(/geocode|coordinates?|what are|for/i, '').trim();
  }

  /**
   * Register with other agents
   */
  registerWithAgents() {
    this.a2a.registerAgent('planner-agent', 'planner', this.baseUrl);
    this.a2a.registerAgent('writer-agent', 'writer', this.baseUrl);
    this.a2a.registerAgent('reviewer-agent', 'reviewer', this.baseUrl);
    this.a2a.registerAgent('supervisor-agent', 'supervisor', this.baseUrl);
  }
}

module.exports = ResearcherAgent;
