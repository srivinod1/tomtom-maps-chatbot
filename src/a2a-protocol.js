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

    const a2aMessage = {
      protocol: 'A2A',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: {
        agentId: this.agentId,
        agentType: this.agentType,
        url: this.baseUrl
      },
      target: {
        agentId: targetAgentId,
        agentType: targetAgent.type,
        url: targetAgent.url
      },
      message: {
        type: messageType,
        payload: payload,
        correlationId: options.correlationId || this.generateCorrelationId(),
        timeout: options.timeout || 30000
      }
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
