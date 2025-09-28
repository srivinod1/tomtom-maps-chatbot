#!/usr/bin/env node
/**
 * Supervisor Agent - Control loops, enforce budgets, approve/reject risky operations
 * Purpose: Control loops, enforce budgets, approve/reject risky tool calls
 */

const A2AProtocol = require('../a2a-protocol');

class SupervisorAgent {
  constructor(agentId, baseUrl) {
    this.agentId = agentId;
    this.baseUrl = baseUrl;
    this.a2a = new A2AProtocol(agentId, 'supervisor', baseUrl);
    this.setupMessageHandlers();
    
    // Budget tracking
    this.budgets = new Map();
    this.riskyOperations = new Set();
    this.approvalQueue = [];
  }

  setupMessageHandlers() {
    this.a2a.processA2AMessage = async (a2aMessage) => {
      const { envelope, payload } = a2aMessage;
      
      if (envelope.intent === 'APPROVE_OPERATION') {
        return await this.approveOperation(payload);
      }
      
      if (envelope.intent === 'ENFORCE_BUDGET') {
        return await this.enforceBudget(payload);
      }
      
      if (envelope.intent === 'CONTROL_LOOP') {
        return await this.controlLoop(payload);
      }
      
      if (envelope.intent === 'RISK_ASSESSMENT') {
        return await this.assessRisk(payload);
      }
      
      return {
        success: false,
        error: `Unknown intent: ${envelope.intent}`
      };
    };
  }

  /**
   * System Prompt for Supervisor Agent
   */
  getSystemPrompt() {
    return `You are a Supervisor Agent in a multi-agent system. Your role is to:

1. CONTROL execution loops and prevent infinite cycles
2. ENFORCE budgets and resource limits
3. APPROVE or REJECT risky operations
4. MONITOR system health and performance
5. ESCALATE issues when necessary
6. NEVER generate content directly

SUPERVISION PRINCIPLES:
- Always approve/reject, never generate content
- Enforce strict budget limits
- Prevent infinite loops
- Monitor for risky operations
- Escalate critical issues
- Maintain system stability

BUDGET ENFORCEMENT:
- Token limits per request
- Tool call limits per agent
- Time limits per operation
- Rate limiting for API calls
- Memory usage monitoring

RISK ASSESSMENT:
- High-risk tool calls (external APIs)
- Sensitive data operations
- Resource-intensive operations
- Potential security issues
- Compliance violations

LOOP CONTROL:
- Maximum iterations per request
- Timeout enforcement
- Deadlock detection
- Circuit breaker patterns
- Graceful degradation

OUTPUT FORMAT:
{
  "success": true/false,
  "approved": true/false,
  "reason": "approval/rejection reason",
  "budget_status": {
    "remaining_tokens": 1000,
    "remaining_tool_calls": 5,
    "remaining_time_ms": 10000
  },
  "risk_level": "low|medium|high|critical",
  "recommendations": ["suggestion1", "suggestion2"],
  "escalation_required": true/false
}`;
  }

  /**
   * Approve or reject an operation
   */
  async approveOperation(payload) {
    const { operation, agent, budget, context } = payload;
    
    try {
      console.log(`🔍 Supervisor Agent: Evaluating operation from ${agent}`);
      
      const approval = {
        approved: false,
        reason: '',
        budget_status: this.getBudgetStatus(budget),
        risk_level: 'low',
        recommendations: [],
        escalation_required: false
      };
      
      // Check budget constraints
      if (!this.checkBudgetConstraints(budget, approval)) {
        return {
          success: true,
          approved: false,
          reason: 'Budget exceeded',
          budget_status: approval.budget_status,
          risk_level: approval.risk_level,
          recommendations: approval.recommendations,
          escalation_required: approval.escalation_required,
          timestamp: new Date().toISOString()
        };
      }
      
      // Assess risk level
      approval.risk_level = this.assessOperationRisk(operation, context);
      
      // Check if operation is risky
      if (approval.risk_level === 'high' || approval.risk_level === 'critical') {
        approval.approved = this.evaluateRiskyOperation(operation, context);
        approval.reason = approval.approved ? 'Risky operation approved with conditions' : 'Risky operation rejected';
      } else {
        approval.approved = true;
        approval.reason = 'Operation approved';
      }
      
      // Generate recommendations
      approval.recommendations = this.generateRecommendations(operation, approval.risk_level);
      
      // Check if escalation is required
      approval.escalation_required = this.requiresEscalation(operation, approval.risk_level);
      
      return {
        success: true,
        approved: approval.approved,
        reason: approval.reason,
        budget_status: approval.budget_status,
        risk_level: approval.risk_level,
        recommendations: approval.recommendations,
        escalation_required: approval.escalation_required,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Supervisor Agent error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Enforce budget constraints
   */
  async enforceBudget(payload) {
    const { budget, operation } = payload;
    
    try {
      console.log(`💰 Supervisor Agent: Enforcing budget constraints`);
      
      const budgetStatus = this.getBudgetStatus(budget);
      const violations = [];
      
      // Check token budget
      if (budgetStatus.remaining_tokens <= 0) {
        violations.push('Token budget exceeded');
      }
      
      // Check tool call budget
      if (budgetStatus.remaining_tool_calls <= 0) {
        violations.push('Tool call budget exceeded');
      }
      
      // Check time budget
      if (budgetStatus.remaining_time_ms <= 0) {
        violations.push('Time budget exceeded');
      }
      
      return {
        success: true,
        budget_status: budgetStatus,
        violations: violations,
        can_proceed: violations.length === 0,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Budget enforcement error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Control execution loops
   */
  async controlLoop(payload) {
    const { loop_info, iteration_count, max_iterations } = payload;
    
    try {
      console.log(`🔄 Supervisor Agent: Controlling loop (iteration ${iteration_count})`);
      
      const control = {
        continue: true,
        reason: '',
        recommendations: []
      };
      
      // Check iteration limit
      if (iteration_count >= max_iterations) {
        control.continue = false;
        control.reason = 'Maximum iterations reached';
        control.recommendations.push('Consider breaking the loop or increasing max_iterations');
      }
      
      // Check for infinite loop patterns
      if (this.detectInfiniteLoop(loop_info, iteration_count)) {
        control.continue = false;
        control.reason = 'Infinite loop detected';
        control.recommendations.push('Review loop logic and add proper exit conditions');
      }
      
      // Check timeout
      if (loop_info.start_time && Date.now() - loop_info.start_time > 30000) { // 30 second timeout
        control.continue = false;
        control.reason = 'Loop timeout exceeded';
        control.recommendations.push('Optimize loop performance or increase timeout');
      }
      
      return {
        success: true,
        continue: control.continue,
        reason: control.reason,
        recommendations: control.recommendations,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Loop control error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Assess risk level of an operation
   */
  async assessRisk(payload) {
    const { operation, context, agent } = payload;
    
    try {
      console.log(`⚠️  Supervisor Agent: Assessing risk for operation`);
      
      const riskAssessment = {
        risk_level: 'low',
        factors: [],
        mitigation: []
      };
      
      // Check operation type
      if (operation.type === 'external_api_call') {
        riskAssessment.risk_level = 'medium';
        riskAssessment.factors.push('External API dependency');
        riskAssessment.mitigation.push('Implement retry logic and fallbacks');
      }
      
      if (operation.type === 'data_modification') {
        riskAssessment.risk_level = 'high';
        riskAssessment.factors.push('Data modification risk');
        riskAssessment.mitigation.push('Require explicit confirmation');
      }
      
      if (operation.type === 'sensitive_data_access') {
        riskAssessment.risk_level = 'critical';
        riskAssessment.factors.push('Sensitive data access');
        riskAssessment.mitigation.push('Require additional authorization');
      }
      
      // Check context for risk factors
      if (context?.user_data?.sensitive) {
        riskAssessment.risk_level = this.escalateRiskLevel(riskAssessment.risk_level);
        riskAssessment.factors.push('Sensitive user data in context');
      }
      
      if (context?.high_volume_operation) {
        riskAssessment.risk_level = this.escalateRiskLevel(riskAssessment.risk_level);
        riskAssessment.factors.push('High volume operation');
      }
      
      return {
        success: true,
        risk_level: riskAssessment.risk_level,
        factors: riskAssessment.factors,
        mitigation: riskAssessment.mitigation,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Risk assessment error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current budget status
   */
  getBudgetStatus(budget) {
    return {
      remaining_tokens: budget?.tokens || 2000,
      remaining_tool_calls: budget?.tool_calls || 10,
      remaining_time_ms: budget?.deadline_ms || 30000
    };
  }

  /**
   * Check budget constraints
   */
  checkBudgetConstraints(budget, approval) {
    const status = this.getBudgetStatus(budget);
    
    if (status.remaining_tokens <= 0) {
      approval.reason = 'Token budget exceeded';
      return false;
    }
    
    if (status.remaining_tool_calls <= 0) {
      approval.reason = 'Tool call budget exceeded';
      return false;
    }
    
    if (status.remaining_time_ms <= 0) {
      approval.reason = 'Time budget exceeded';
      return false;
    }
    
    return true;
  }

  /**
   * Assess operation risk level
   */
  assessOperationRisk(operation, context) {
    let riskLevel = 'low';
    
    // Check operation type
    if (operation.type === 'external_api_call') {
      riskLevel = 'medium';
    }
    
    if (operation.type === 'data_modification') {
      riskLevel = 'high';
    }
    
    if (operation.type === 'sensitive_data_access') {
      riskLevel = 'critical';
    }
    
    // Check context factors
    if (context?.sensitive_data) {
      riskLevel = this.escalateRiskLevel(riskLevel);
    }
    
    if (context?.high_volume) {
      riskLevel = this.escalateRiskLevel(riskLevel);
    }
    
    return riskLevel;
  }

  /**
   * Evaluate risky operation
   */
  evaluateRiskyOperation(operation, context) {
    // For now, approve with conditions
    // In production, this would have more sophisticated logic
    return operation.type !== 'sensitive_data_access';
  }

  /**
   * Detect infinite loop patterns
   */
  detectInfiniteLoop(loopInfo, iterationCount) {
    // Simple infinite loop detection
    if (iterationCount > 10) {
      return true;
    }
    
    // Check for repeated states
    if (loopInfo.states && loopInfo.states.length > 5) {
      const recentStates = loopInfo.states.slice(-3);
      const allSame = recentStates.every(state => state === recentStates[0]);
      if (allSame) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Escalate risk level
   */
  escalateRiskLevel(currentLevel) {
    const levels = ['low', 'medium', 'high', 'critical'];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.min(currentIndex + 1, levels.length - 1)];
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(operation, riskLevel) {
    const recommendations = [];
    
    if (riskLevel === 'medium') {
      recommendations.push('Monitor operation closely');
    }
    
    if (riskLevel === 'high') {
      recommendations.push('Implement additional safety checks');
      recommendations.push('Consider breaking into smaller operations');
    }
    
    if (riskLevel === 'critical') {
      recommendations.push('Require explicit user confirmation');
      recommendations.push('Implement comprehensive logging');
      recommendations.push('Consider manual review');
    }
    
    return recommendations;
  }

  /**
   * Check if escalation is required
   */
  requiresEscalation(operation, riskLevel) {
    return riskLevel === 'critical' || 
           operation.type === 'sensitive_data_access' ||
           operation.type === 'system_configuration';
  }

  /**
   * Register with other agents
   */
  registerWithAgents() {
    this.a2a.registerAgent('planner-agent', 'planner', this.baseUrl);
    this.a2a.registerAgent('researcher-agent', 'researcher', this.baseUrl);
    this.a2a.registerAgent('writer-agent', 'writer', this.baseUrl);
    this.a2a.registerAgent('reviewer-agent', 'reviewer', this.baseUrl);
  }
}

module.exports = SupervisorAgent;
