#!/usr/bin/env node
/**
 * Enhanced Orchestrator - Coordinates the 5-agent framework
 * Purpose: Manage the complete workflow from planning to delivery
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Import A2A protocol
const A2AProtocol = require('./a2a-protocol');

// Import enhanced agents
const PlannerAgent = require('./enhanced-agents/planner-agent');
const ResearcherAgent = require('./enhanced-agents/researcher-agent');
const WriterAgent = require('./enhanced-agents/writer-agent');
const ReviewerAgent = require('./enhanced-agents/reviewer-agent');
const SupervisorAgent = require('./enhanced-agents/supervisor-agent');

// Import observability
const ComprehensiveObservability = require('./comprehensive-observability');

class EnhancedOrchestrator {
  constructor() {
    this.app = express();
    this.port = process.env.ORCHESTRATOR_PORT || 3000;
    this.mcpToolServerUrl = process.env.MCP_TOOL_SERVER_URL || 'http://localhost:3003';
    
    // Initialize orchestrator's own A2A protocol
    this.a2a = new A2AProtocol('orchestrator-agent', 'orchestrator', `http://localhost:${this.port}`);
    
    // Initialize agents
    this.planner = new PlannerAgent('planner-agent', `http://localhost:${this.port}`);
    this.researcher = new ResearcherAgent('researcher-agent', `http://localhost:${this.port}`, this.mcpToolServerUrl);
    this.writer = new WriterAgent('writer-agent', `http://localhost:${this.port}`);
    this.reviewer = new ReviewerAgent('reviewer-agent', `http://localhost:${this.port}`);
    this.supervisor = new SupervisorAgent('supervisor-agent', `http://localhost:${this.port}`);
    
    // Initialize observability
    this.observability = new ComprehensiveObservability(
      process.env.GOOGLE_CLOUD_PROJECT,
      'us-central1',
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );
    
    // User context and conversation history
    this.userContexts = new Map();
    this.conversationHistory = [];
    
    this.setupMiddleware();
    this.setupRoutes();
    this.registerAgents();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/', (req, res) => {
      res.json({
        status: 'healthy',
        server: 'enhanced-multi-agent-orchestrator',
        version: '2.0.0',
        agents: ['planner', 'researcher', 'writer', 'reviewer', 'supervisor'],
        timestamp: new Date().toISOString()
      });
    });

    // JSON-RPC endpoint for frontend
    this.app.post('/', async (req, res) => {
      try {
        const { method, params, id } = req.body;
        
        console.log(`📨 Received JSON-RPC request: ${method}`);
        
        let result;
        switch (method) {
          case 'orchestrator.chat':
            result = await this.handleChat(params);
            break;
          case 'orchestrator.capabilities':
            result = await this.handleCapabilities();
            break;
          case 'orchestrator.context':
            result = await this.handleContext(params);
            break;
          default:
            throw new Error(`Method ${method} not implemented`);
        }
        
        res.json({
          jsonrpc: '2.0',
          id: id,
          result: result
        });
        
      } catch (error) {
        console.error('JSON-RPC error:', error);
        res.json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: error.message
          }
        });
      }
    });

    // A2A endpoint for inter-agent communication
    this.app.post('/a2a', async (req, res) => {
      try {
        const a2aMessage = req.body;
        const { envelope } = a2aMessage;
        
        console.log(`📡 A2A Message: ${envelope.from} -> ${envelope.to}`);
        
        let result;
        switch (envelope.to) {
          case 'planner-agent':
            result = await this.planner.a2a.processA2AMessage(a2aMessage);
            break;
          case 'researcher-agent':
            result = await this.researcher.a2a.processA2AMessage(a2aMessage);
            break;
          case 'writer-agent':
            result = await this.writer.a2a.processA2AMessage(a2aMessage);
            break;
          case 'reviewer-agent':
            result = await this.reviewer.a2a.processA2AMessage(a2aMessage);
            break;
          case 'supervisor-agent':
            result = await this.supervisor.a2a.processA2AMessage(a2aMessage);
            break;
          default:
            throw new Error(`Unknown agent: ${envelope.to}`);
        }
        
        res.json(result);
        
      } catch (error) {
        console.error('A2A error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Analytics endpoint
    this.app.get('/analytics', async (req, res) => {
      try {
        const analytics = await this.observability.getComprehensiveAnalytics();
        res.json(analytics);
      } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  registerAgents() {
    // Register all agents with each other using proper A2A registration
    const baseUrl = `http://localhost:${this.port}`;
    
    // Register agents in the orchestrator's A2A protocol
    this.a2a.registerAgent('planner-agent', 'planner', baseUrl);
    this.a2a.registerAgent('researcher-agent', 'researcher', baseUrl);
    this.a2a.registerAgent('writer-agent', 'writer', baseUrl);
    this.a2a.registerAgent('reviewer-agent', 'reviewer', baseUrl);
    this.a2a.registerAgent('supervisor-agent', 'supervisor', baseUrl);
    
    // Register agents with each other
    this.planner.a2a.registerAgent('researcher-agent', 'researcher', baseUrl);
    this.planner.a2a.registerAgent('writer-agent', 'writer', baseUrl);
    this.planner.a2a.registerAgent('reviewer-agent', 'reviewer', baseUrl);
    this.planner.a2a.registerAgent('supervisor-agent', 'supervisor', baseUrl);
    
    this.researcher.a2a.registerAgent('planner-agent', 'planner', baseUrl);
    this.researcher.a2a.registerAgent('writer-agent', 'writer', baseUrl);
    this.researcher.a2a.registerAgent('reviewer-agent', 'reviewer', baseUrl);
    this.researcher.a2a.registerAgent('supervisor-agent', 'supervisor', baseUrl);
    
    this.writer.a2a.registerAgent('planner-agent', 'planner', baseUrl);
    this.writer.a2a.registerAgent('researcher-agent', 'researcher', baseUrl);
    this.writer.a2a.registerAgent('reviewer-agent', 'reviewer', baseUrl);
    this.writer.a2a.registerAgent('supervisor-agent', 'supervisor', baseUrl);
    
    this.reviewer.a2a.registerAgent('planner-agent', 'planner', baseUrl);
    this.reviewer.a2a.registerAgent('researcher-agent', 'researcher', baseUrl);
    this.reviewer.a2a.registerAgent('writer-agent', 'writer', baseUrl);
    this.reviewer.a2a.registerAgent('supervisor-agent', 'supervisor', baseUrl);
    
    this.supervisor.a2a.registerAgent('planner-agent', 'planner', baseUrl);
    this.supervisor.a2a.registerAgent('researcher-agent', 'researcher', baseUrl);
    this.supervisor.a2a.registerAgent('writer-agent', 'writer', baseUrl);
    this.supervisor.a2a.registerAgent('reviewer-agent', 'reviewer', baseUrl);
    
    console.log('📡 All agents registered with A2A protocol');
  }

  /**
   * Handle chat requests using the 5-agent framework
   */
  async handleChat(params) {
    const { message, user_id } = params;
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Enhanced Orchestrator: Processing chat for user ${user_id}`);
      
      // Get user context
      const userContext = this.getUserContext(user_id);
      
      // Step 1: Supervisor approves the overall operation
      const operationApproval = await this.a2a.sendMessage('supervisor-agent', 'APPROVE_OPERATION', {
        operation: {
          type: 'chat_request',
          message: message,
          user_id: user_id
        },
        agent: 'orchestrator',
        budget: {
          tokens: 2000,
          tool_calls: 5,
          deadline_ms: 30000
        },
        context: userContext
      });
      
      if (!operationApproval.success || !operationApproval.data.approved) {
        return {
          response: "I'm unable to process your request at this time due to system constraints.",
          agent_used: 'supervisor',
          query_type: 'rejected',
          timestamp: new Date().toISOString(),
          success: false
        };
      }
      
      // Step 2: Planner creates execution plan
      const planResult = await this.a2a.sendMessage('planner-agent', 'PLAN_REQUEST', {
        user_request: message,
        context: userContext,
        user_id: user_id
      });
      
      if (!planResult.success) {
        return {
          response: "I'm having trouble understanding your request. Could you please rephrase it?",
          agent_used: 'planner',
          query_type: 'planning_failed',
          timestamp: new Date().toISOString(),
          success: false
        };
      }
      
      const plan = planResult.data.plan;
      console.log(`📋 Execution plan created with ${plan.steps.length} steps`);
      
      // Step 3: Execute plan steps
      const executionResults = [];
      let finalResponse = '';
      
      for (const step of plan.steps) {
        console.log(`🔄 Executing step: ${step.step_id} (${step.agent})`);
        
        // Supervisor approves each step
        const stepApproval = await this.a2a.sendMessage('supervisor-agent', 'APPROVE_OPERATION', {
          operation: {
            type: 'step_execution',
            step: step,
            context: userContext
          },
          agent: step.agent,
          budget: {
            tokens: 1000,
            tool_calls: 2,
            deadline_ms: 15000
          },
          context: userContext
        });
        
        if (!stepApproval.success || !stepApproval.data.approved) {
          console.log(`❌ Step ${step.step_id} rejected by supervisor`);
          continue;
        }
        
        // Execute step based on agent type
        let stepResult;
        switch (step.agent) {
          case 'researcher_agent':
            stepResult = await this.executeResearcherStep(step, userContext);
            break;
          case 'writer_agent':
            stepResult = await this.executeWriterStep(step, executionResults, userContext);
            break;
          case 'reviewer_agent':
            stepResult = await this.executeReviewerStep(step, executionResults, userContext);
            break;
          default:
            console.log(`⚠️  Unknown agent type: ${step.agent}`);
            continue;
        }
        
        if (stepResult.success) {
          executionResults.push({
            step_id: step.step_id,
            agent: step.agent,
            result: stepResult.data,
            timestamp: new Date().toISOString()
          });
          
          // Update final response if this is a writer step
          if (step.agent === 'writer_agent' && stepResult.data.response) {
            finalResponse = stepResult.data.response;
          }
        }
      }
      
      // Step 4: Final review by reviewer
      const finalReview = await this.a2a.sendMessage('reviewer-agent', 'REVIEW_RESPONSE', {
        response: finalResponse,
        original_request: message,
        evidence: this.consolidateEvidence(executionResults),
        context: userContext
      });
      
      if (finalReview.success && !finalReview.data.approved) {
        console.log(`⚠️  Final response needs revision: ${finalReview.data.issues.length} issues`);
        // For now, we'll use the response as-is, but in production we'd revise
      }
      
      // Update user context
      this.updateUserContext(user_id, message, finalResponse, executionResults);
      
      // Log the operation
      if (this.observability) {
        await this.observability.observeOperation('enhanced_chat', {
          user_id: user_id,
          message: message,
          response: finalResponse,
          agents_used: executionResults.map(r => r.agent),
          execution_time: Date.now() - startTime,
          success: true
        });
      }
      
      return {
        response: finalResponse || "I've processed your request, but I'm having trouble generating a response.",
        agent_used: 'enhanced_multi_agent',
        query_type: this.determineQueryType(message),
        execution_plan: plan,
        steps_executed: executionResults.length,
        timestamp: new Date().toISOString(),
        success: true
      };
      
    } catch (error) {
      console.error('Enhanced chat error:', error);
      
      if (this.observability) {
        await this.observability.observeOperation('enhanced_chat', {
          user_id: user_id,
          message: message,
          error: error.message,
          execution_time: Date.now() - startTime,
          success: false
        });
      }
      
      return {
        response: "I'm experiencing technical difficulties. Please try again later.",
        agent_used: 'enhanced_multi_agent',
        query_type: 'error',
        timestamp: new Date().toISOString(),
        success: false
      };
    }
  }

  /**
   * Execute researcher step
   */
  async executeResearcherStep(step, userContext) {
    return await this.a2a.sendMessage('researcher-agent', 'GATHER_EVIDENCE', {
      task: step.action,
      context: step.context,
      requirements: step.expected_output
    });
  }

  /**
   * Execute writer step
   */
  async executeWriterStep(step, executionResults, userContext) {
    const evidence = this.consolidateEvidence(executionResults);
    
    return await this.a2a.sendMessage('writer-agent', 'SYNTHESIZE_RESPONSE', {
      evidence: evidence,
      original_request: step.context?.user_query || 'User request',
      context: userContext,
      target_audience: 'general'
    });
  }

  /**
   * Execute reviewer step
   */
  async executeReviewerStep(step, executionResults, userContext) {
    const evidence = this.consolidateEvidence(executionResults);
    const response = executionResults.find(r => r.agent === 'writer_agent')?.result?.response || '';
    
    return await this.a2a.sendMessage('reviewer-agent', 'REVIEW_RESPONSE', {
      response: response,
      original_request: step.context?.user_query || 'User request',
      evidence: evidence,
      context: userContext
    });
  }

  /**
   * Consolidate evidence from execution results
   */
  consolidateEvidence(executionResults) {
    const evidence = {
      data: {},
      sources: [],
      citations: [],
      confidence: 0.0
    };
    
    executionResults.forEach(result => {
      if (result.agent === 'researcher_agent' && result.result?.evidence) {
        evidence.data = { ...evidence.data, ...result.result.evidence.data };
        evidence.sources.push(...(result.result.evidence.sources || []));
        evidence.citations.push(...(result.result.evidence.citations || []));
        evidence.confidence = Math.max(evidence.confidence, result.result.evidence.confidence || 0);
      }
    });
    
    return evidence;
  }

  /**
   * Handle capabilities request
   */
  async handleCapabilities() {
    return {
      capabilities: [
        'location_search',
        'geocoding',
        'directions',
        'general_conversation',
        'multi_agent_coordination'
      ],
      agents: [
        'planner_agent',
        'researcher_agent', 
        'writer_agent',
        'reviewer_agent',
        'supervisor_agent'
      ],
      features: [
        'intelligent_planning',
        'evidence_gathering',
        'quality_review',
        'budget_enforcement',
        'risk_assessment'
      ]
    };
  }

  /**
   * Handle context request
   */
  async handleContext(params) {
    const { user_id } = params;
    const userContext = this.getUserContext(user_id);
    
    return {
      user_id: user_id,
      context: userContext,
      conversation_history: userContext.conversationHistory || [],
      last_location: userContext.lastLocation,
      last_coordinates: userContext.lastCoordinates
    };
  }

  /**
   * Get user context
   */
  getUserContext(userId) {
    if (!this.userContexts.has(userId)) {
      this.userContexts.set(userId, {
        conversationHistory: [],
        lastLocation: null,
        lastCoordinates: null,
        preferences: {}
      });
    }
    return this.userContexts.get(userId);
  }

  /**
   * Update user context
   */
  updateUserContext(userId, message, response, executionResults) {
    const context = this.getUserContext(userId);
    
    // Add to conversation history
    context.conversationHistory.push({
      timestamp: new Date().toISOString(),
      user_message: message,
      agent_response: response
    });
    
    // Keep only last 10 messages
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-10);
    }
    
    // Update location context if found
    const locationData = this.extractLocationFromResults(executionResults);
    if (locationData) {
      context.lastLocation = locationData.address;
      context.lastCoordinates = locationData.coordinates;
    }
    
    this.userContexts.set(userId, context);
  }

  /**
   * Extract location data from execution results
   */
  extractLocationFromResults(executionResults) {
    for (const result of executionResults) {
      if (result.agent === 'researcher_agent' && result.result?.evidence?.data) {
        const data = result.result.evidence.data;
        if (data.coordinates && data.address) {
          return {
            coordinates: data.coordinates,
            address: data.address
          };
        }
      }
    }
    return null;
  }

  /**
   * Determine query type
   */
  determineQueryType(message) {
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('find') || messageLower.includes('search') || messageLower.includes('near')) {
      return 'location_search';
    }
    
    if (messageLower.includes('coordinates') || messageLower.includes('geocode')) {
      return 'geocoding';
    }
    
    if (messageLower.includes('directions') || messageLower.includes('route')) {
      return 'directions';
    }
    
    return 'general';
  }

  /**
   * Start the server
   */
  start() {
    this.app.listen(this.port, () => {
      console.log(`🚀 Enhanced Multi-Agent Orchestrator running on port ${this.port}`);
      console.log(`📋 JSON-RPC Endpoint: http://localhost:${this.port}/`);
      console.log(`🤝 A2A Endpoint: http://localhost:${this.port}/a2a`);
      console.log(`📊 Analytics: http://localhost:${this.port}/analytics`);
      console.log(`🔍 Health Check: http://localhost:${this.port}/`);
      console.log(`\n🤖 Agents:`);
      console.log(`   • Planner Agent: Decomposes requests into steps`);
      console.log(`   • Researcher Agent: Gathers evidence via MCP tools`);
      console.log(`   • Writer Agent: Synthesizes responses`);
      console.log(`   • Reviewer Agent: Quality control and validation`);
      console.log(`   • Supervisor Agent: Budget enforcement and risk management`);
    });
  }
}

// Start the enhanced orchestrator
if (require.main === module) {
  const orchestrator = new EnhancedOrchestrator();
  orchestrator.start();
}

module.exports = EnhancedOrchestrator;
