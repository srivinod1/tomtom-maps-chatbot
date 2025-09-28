#!/usr/bin/env node
/**
 * Agent-to-Agent (A2A) Communication Protocol
 * Standardized protocol for inter-agent communication
 */

const axios = require('axios');

class A2AProtocol {
  constructor(agentId, agentType, baseUrl) {
    this.agentId = agentId;
    this.agentType = agentType;
    this.baseUrl = baseUrl;
    this.registeredAgents = new Map();
  }

  /**
   * Register another agent for A2A communication
   */
  registerAgent(agentId, agentType, url) {
    this.registeredAgents.set(agentId, {
      id: agentId,
      type: agentType,
      url: url,
      capabilities: [],
      status: 'unknown'
    });
    console.log(`📡 Registered agent: ${agentId} (${agentType}) at ${url}`);
  }

  /**
   * Send A2A message to another agent
   */
  async sendMessage(targetAgentId, messageType, payload, options = {}) {
    const targetAgent = this.registeredAgents.get(targetAgentId);
    if (!targetAgent) {
      throw new Error(`Agent ${targetAgentId} not registered`);
    }

    // Generate task and trace IDs for observability
    const taskId = options.taskId || this.generateTaskId();
    const traceId = options.traceId || this.generateTraceId();

    // A2A Envelope following best practices
    const envelope = {
      a2a_version: "1.0",
      task_id: taskId,
      trace_id: traceId,
      from: this.agentId,
      to: targetAgentId,
      topic: options.topic || this.getTopicForMessageType(messageType),
      intent: messageType.toUpperCase(),
      budget: {
        tokens: options.budget?.tokens || 2000,
        tool_calls: options.budget?.tool_calls || 3,
        deadline_ms: options.budget?.deadline_ms || 15000
      },
      ts: new Date().toISOString()
    };

    // A2A Payload (strict JSON)
    const a2aPayload = {
      instructions: payload.instructions || this.getDefaultInstructions(messageType),
      context_refs: payload.context_refs || [],
      needs_tooling: payload.needs_tooling || false,
      expected_output_schema: payload.expected_output_schema || this.getDefaultOutputSchema(messageType),
      ...payload
    };

    const a2aMessage = {
      envelope: envelope,
      payload: a2aPayload
    };

    try {
      console.log(`📤 A2A Message: ${this.agentId} -> ${targetAgentId} (${messageType})`);
      const response = await axios.post(`${targetAgent.url}/a2a`, a2aMessage, {
        headers: { 'Content-Type': 'application/json' },
        timeout: options.timeout || 30000
      });

      return {
        success: true,
        data: response.data,
        correlationId: a2aMessage.message.correlationId
      };
    } catch (error) {
      console.error(`❌ A2A Error: ${this.agentId} -> ${targetAgentId}:`, error.message);
      return {
        success: false,
        error: error.message,
        correlationId: a2aMessage.message.correlationId
      };
    }
  }

  /**
   * Handle incoming A2A message
   */
  handleA2AMessage(req, res) {
    const a2aMessage = req.body;
    
    // Validate A2A message format
    if (!this.validateA2AMessage(a2aMessage)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid A2A message format'
      });
    }

    console.log(`📥 A2A Message received: ${a2aMessage.source.agentId} -> ${this.agentId} (${a2aMessage.message.type})`);

    // Process the message based on type
    this.processA2AMessage(a2aMessage)
      .then(result => {
        res.json({
          success: true,
          data: result,
          correlationId: a2aMessage.message.correlationId
        });
      })
      .catch(error => {
        console.error(`❌ A2A Processing Error:`, error);
        res.status(500).json({
          success: false,
          error: error.message,
          correlationId: a2aMessage.message.correlationId
        });
      });
  }

  /**
   * Validate A2A message format
   */
  validateA2AMessage(message) {
    return (
      message.protocol === 'A2A' &&
      message.version &&
      message.timestamp &&
      message.source &&
      message.source.agentId &&
      message.source.agentType &&
      message.target &&
      message.target.agentId &&
      message.message &&
      message.message.type
    );
  }

  /**
   * Process incoming A2A message (to be implemented by specific agents)
   */
  async processA2AMessage(a2aMessage) {
    throw new Error('processA2AMessage must be implemented by specific agents');
  }

  /**
   * Generate correlation ID for message tracking
   */
  generateCorrelationId() {
    return `${this.agentId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate task ID for observability
   */
  generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate trace ID for observability
   */
  generateTraceId() {
    return `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get A2A topic for message type
   */
  getTopicForMessageType(messageType) {
    const topicMap = {
      'search_places': 'execution',
      'geocode_address': 'execution',
      'reverse_geocode': 'execution',
      'calculate_route': 'execution',
      'generate_static_map': 'execution',
      'process_location_request': 'execution',
      'chat_message': 'planning',
      'get_capabilities': 'analysis'
    };
    return topicMap[messageType] || 'execution';
  }

  /**
   * Get default instructions for message type
   */
  getDefaultInstructions(messageType) {
    const instructionMap = {
      'search_places': 'Search for places near the specified location',
      'geocode_address': 'Convert the address to coordinates',
      'reverse_geocode': 'Convert coordinates to an address',
      'calculate_route': 'Calculate route between two points',
      'generate_static_map': 'Generate a static map image',
      'process_location_request': 'Process the location-based request',
      'chat_message': 'Handle the chat message appropriately',
      'get_capabilities': 'Return agent capabilities'
    };
    return instructionMap[messageType] || 'Process the request';
  }

  /**
   * Get default output schema for message type
   */
  getDefaultOutputSchema(messageType) {
    const schemaMap = {
      'search_places': {
        places: [
          { name: 'string', address: 'string', rating: 'number', distance: 'number' }
        ]
      },
      'geocode_address': {
        coordinates: { lat: 'number', lon: 'number' },
        address: 'string'
      },
      'reverse_geocode': {
        address: 'string',
        formatted_address: 'string'
      },
      'calculate_route': {
        distance: 'number',
        duration: 'number',
        steps: 'array'
      },
      'generate_static_map': {
        url: 'string'
      },
      'process_location_request': {
        success: 'boolean',
        response: 'string',
        updated_context: 'object'
      },
      'chat_message': {
        response: 'string',
        agent_used: 'string',
        query_type: 'string'
      },
      'get_capabilities': {
        capabilities: 'array'
      }
    };
    return schemaMap[messageType] || { result: 'any' };
  }

  /**
   * Discover other agents (service discovery)
   */
  async discoverAgents(discoveryUrl) {
    try {
      const response = await axios.get(`${discoveryUrl}/agents`);
      const agents = response.data.agents || [];
      
      agents.forEach(agent => {
        if (agent.id !== this.agentId) {
          this.registerAgent(agent.id, agent.type, agent.url);
        }
      });
      
      console.log(`🔍 Discovered ${agents.length} agents`);
    } catch (error) {
      console.error('❌ Agent discovery failed:', error.message);
    }
  }

  /**
   * Get agent status
   */
  getAgentStatus() {
    return {
      agentId: this.agentId,
      agentType: this.agentType,
      url: this.baseUrl,
      registeredAgents: Array.from(this.registeredAgents.values()),
      status: 'active'
    };
  }
}

module.exports = A2AProtocol;
