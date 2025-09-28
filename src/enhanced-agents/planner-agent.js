#!/usr/bin/env node
/**
 * Planner Agent - Decompose messy requests into clear, executable steps
 * Purpose: Break complex requests into 3-6 clear, minimal steps mapped to specialists
 */

const A2AProtocol = require('../a2a-protocol');

class PlannerAgent {
  constructor(agentId, baseUrl) {
    this.agentId = agentId;
    this.baseUrl = baseUrl;
    this.a2a = new A2AProtocol(agentId, 'planner', baseUrl);
    this.setupMessageHandlers();
  }

  setupMessageHandlers() {
    this.a2a.processA2AMessage = async (a2aMessage) => {
      const { envelope, payload } = a2aMessage;
      
      if (envelope.intent === 'PLAN_REQUEST') {
        return await this.planRequest(payload);
      }
      
      return {
        success: false,
        error: `Unknown intent: ${envelope.intent}`
      };
    };
  }

  /**
   * System Prompt for Planner Agent
   */
  getSystemPrompt() {
    return `You are a Planner Agent in a multi-agent system. Your role is to:

1. DECOMPOSE complex user requests into 3-6 clear, executable steps
2. MAP each step to the appropriate specialist agent
3. ENSURE each step is minimal and actionable
4. CONSIDER dependencies between steps
5. PROVIDE clear context for each step

SPECIALIST AGENTS AVAILABLE:
- Maps Agent: Location search, geocoding, directions, static maps
- Researcher Agent: Tool calls, evidence gathering, data retrieval
- Writer Agent: Content synthesis, response formatting
- Reviewer Agent: Quality control, validation, safety checks

OUTPUT FORMAT:
{
  "plan_id": "plan_1234567890",
  "steps": [
    {
      "step_id": "step_1",
      "agent": "maps_agent|researcher_agent|writer_agent|reviewer_agent",
      "action": "specific action to take",
      "context": "relevant context for this step",
      "dependencies": ["step_id_1", "step_id_2"],
      "expected_output": "what this step should produce"
    }
  ],
  "estimated_duration": "estimated time in seconds",
  "complexity": "low|medium|high"
}

PLANNING PRINCIPLES:
- Each step should be atomic and executable
- Map location queries to Maps Agent
- Map research needs to Researcher Agent  
- Map content creation to Writer Agent
- Map validation to Reviewer Agent
- Consider parallel execution where possible
- Keep steps minimal and focused`;
  }

  /**
   * Plan a complex request by breaking it into steps
   */
  async planRequest(payload) {
    const { user_request, context, user_id } = payload;
    
    try {
      // Use LLM to analyze and plan the request
      const planningPrompt = `${this.getSystemPrompt()}

USER REQUEST: "${user_request}"

CONTEXT: ${JSON.stringify(context, null, 2)}

USER ID: ${user_id}

Analyze this request and create a detailed execution plan. Break it into 3-6 clear steps, each mapped to the appropriate specialist agent.`;

      // For now, use rule-based planning (can be enhanced with LLM)
      const plan = this.createRuleBasedPlan(user_request, context);
      
      return {
        success: true,
        plan: plan,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Planner Agent error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create a rule-based plan (can be enhanced with LLM)
   */
  createRuleBasedPlan(userRequest, context) {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const steps = [];
    
    // Analyze request type and create appropriate steps
    const requestLower = userRequest.toLowerCase();
    
    if (requestLower.includes('find') || requestLower.includes('search') || requestLower.includes('near')) {
      // Location search request
      steps.push({
        step_id: "step_1",
        agent: "maps_agent",
        action: "search_places",
        context: {
          query: this.extractSearchQuery(userRequest),
          location: context.lastLocation || "user location"
        },
        dependencies: [],
        expected_output: "List of places with details"
      });
      
      steps.push({
        step_id: "step_2", 
        agent: "writer_agent",
        action: "format_places_response",
        context: {
          places_data: "from step_1",
          user_query: userRequest
        },
        dependencies: ["step_1"],
        expected_output: "Formatted response for user"
      });
      
    } else if (requestLower.includes('coordinates') || requestLower.includes('geocode')) {
      // Geocoding request
      steps.push({
        step_id: "step_1",
        agent: "maps_agent", 
        action: "geocode_address",
        context: {
          address: this.extractAddress(userRequest)
        },
        dependencies: [],
        expected_output: "Coordinates and formatted address"
      });
      
      steps.push({
        step_id: "step_2",
        agent: "writer_agent",
        action: "format_coordinates_response", 
        context: {
          geocoding_data: "from step_1",
          user_query: userRequest
        },
        dependencies: ["step_1"],
        expected_output: "Formatted coordinates response"
      });
      
    } else if (requestLower.includes('directions') || requestLower.includes('route')) {
      // Directions request
      steps.push({
        step_id: "step_1",
        agent: "maps_agent",
        action: "calculate_route", 
        context: {
          origin: this.extractOrigin(userRequest),
          destination: this.extractDestination(userRequest)
        },
        dependencies: [],
        expected_output: "Route information with steps"
      });
      
      steps.push({
        step_id: "step_2",
        agent: "writer_agent",
        action: "format_directions_response",
        context: {
          route_data: "from step_1",
          user_query: userRequest
        },
        dependencies: ["step_1"],
        expected_output: "Formatted directions response"
      });
      
    } else {
      // General conversation
      steps.push({
        step_id: "step_1",
        agent: "writer_agent",
        action: "general_response",
        context: {
          user_message: userRequest,
          conversation_context: context
        },
        dependencies: [],
        expected_output: "Appropriate general response"
      });
    }
    
    // Add reviewer step for all plans
    steps.push({
      step_id: `step_${steps.length + 1}`,
      agent: "reviewer_agent", 
      action: "review_response",
      context: {
        response_data: "from previous steps",
        original_request: userRequest
      },
      dependencies: steps.map(s => s.step_id),
      expected_output: "Validated and approved response"
    });
    
    return {
      plan_id: planId,
      steps: steps,
      estimated_duration: this.estimateDuration(steps),
      complexity: this.assessComplexity(steps)
    };
  }

  extractSearchQuery(request) {
    // Simple extraction - can be enhanced with NLP
    const words = request.toLowerCase().split(' ');
    const searchWords = words.filter(word => 
      !['find', 'search', 'near', 'me', 'the', 'a', 'an', 'and', 'or', 'but'].includes(word)
    );
    return searchWords.join(' ') || 'places';
  }

  extractAddress(request) {
    // Simple extraction - can be enhanced with NLP
    return request.replace(/coordinates?|geocode|what are|for/i, '').trim();
  }

  extractOrigin(request) {
    // Simple extraction - can be enhanced with NLP
    const parts = request.split(/to|from/i);
    return parts[0]?.trim() || 'current location';
  }

  extractDestination(request) {
    // Simple extraction - can be enhanced with NLP
    const parts = request.split(/to|from/i);
    return parts[1]?.trim() || 'destination';
  }

  estimateDuration(steps) {
    // Estimate based on number and type of steps
    const baseTime = steps.length * 2; // 2 seconds per step
    const hasLocationSteps = steps.some(s => s.agent === 'maps_agent');
    return hasLocationSteps ? baseTime + 3 : baseTime; // +3 for API calls
  }

  assessComplexity(steps) {
    if (steps.length <= 2) return 'low';
    if (steps.length <= 4) return 'medium';
    return 'high';
  }

  /**
   * Register with other agents
   */
  registerWithAgents() {
    // Register with other agents in the system
    this.a2a.registerAgent('researcher-agent', 'researcher', this.baseUrl);
    this.a2a.registerAgent('writer-agent', 'writer', this.baseUrl);
    this.a2a.registerAgent('reviewer-agent', 'reviewer', this.baseUrl);
    this.a2a.registerAgent('supervisor-agent', 'supervisor', this.baseUrl);
  }
}

module.exports = PlannerAgent;
