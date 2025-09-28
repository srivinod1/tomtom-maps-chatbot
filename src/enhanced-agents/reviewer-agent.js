#!/usr/bin/env node
/**
 * Reviewer Agent - Quality control, validation, safety checks
 * Purpose: Apply rubric for citations, math/units, safety, style
 */

const A2AProtocol = require('../a2a-protocol');

class ReviewerAgent {
  constructor(agentId, baseUrl) {
    this.agentId = agentId;
    this.baseUrl = baseUrl;
    this.a2a = new A2AProtocol(agentId, 'reviewer', baseUrl);
    this.setupMessageHandlers();
  }

  setupMessageHandlers() {
    this.a2a.processA2AMessage = async (a2aMessage) => {
      const { envelope, payload } = a2aMessage;
      
      if (envelope.intent === 'REVIEW_RESPONSE') {
        return await this.reviewResponse(payload);
      }
      
      if (envelope.intent === 'VALIDATE_DATA') {
        return await this.validateData(payload);
      }
      
      return {
        success: false,
        error: `Unknown intent: ${envelope.intent}`
      };
    };
  }

  /**
   * System Prompt for Reviewer Agent
   */
  getSystemPrompt() {
    return `You are a Reviewer Agent in a multi-agent system. Your role is to:

1. APPLY strict quality rubric to all responses
2. VALIDATE citations and source attribution
3. CHECK mathematical accuracy and units
4. ENSURE safety and appropriateness
5. VERIFY style and formatting consistency
6. APPROVE or request revisions

REVIEW RUBRIC:
- Citations: All data must be properly cited
- Math/Units: Numerical accuracy and correct units
- Safety: No harmful or inappropriate content
- Style: Consistent tone and formatting
- Completeness: All required information present
- Accuracy: Factual correctness

VALIDATION CHECKS:
- Citation format: [1], [2], [3] with source list
- Coordinate accuracy: Valid lat/lon ranges
- Distance units: Consistent km/miles usage
- Time units: Consistent minutes/hours
- Address format: Proper formatting
- Response structure: Logical organization

SAFETY CHECKS:
- No personal information exposure
- No harmful location data
- Appropriate language
- No misleading information
- Proper disclaimers for uncertain data

OUTPUT FORMAT:
{
  "success": true/false,
  "approved": true/false,
  "issues": [
    {
      "type": "citation|math|safety|style|completeness|accuracy",
      "severity": "low|medium|high|critical",
      "description": "specific issue description",
      "suggestion": "how to fix"
    }
  ],
  "revisions_needed": true/false,
  "confidence": 0.0-1.0,
  "recommendations": ["suggestion1", "suggestion2"]
}`;
  }

  /**
   * Review a response for quality and compliance
   */
  async reviewResponse(payload) {
    const { response, original_request, evidence, context } = payload;
    
    try {
      console.log(`🔍 Reviewer Agent: Reviewing response for quality`);
      
      const review = {
        approved: true,
        issues: [],
        revisions_needed: false,
        confidence: 1.0,
        recommendations: []
      };
      
      // Apply review rubric
      this.checkCitations(response, evidence, review);
      this.checkMathAndUnits(response, review);
      this.checkSafety(response, review);
      this.checkStyle(response, review);
      this.checkCompleteness(response, original_request, review);
      this.checkAccuracy(response, evidence, review);
      
      // Calculate overall confidence
      review.confidence = this.calculateConfidence(review.issues);
      
      // Determine if revisions are needed
      review.revisions_needed = review.issues.some(issue => 
        issue.severity === 'high' || issue.severity === 'critical'
      );
      
      // Generate recommendations
      review.recommendations = this.generateRecommendations(review.issues);
      
      return {
        success: true,
        approved: review.approved && !review.revisions_needed,
        issues: review.issues,
        revisions_needed: review.revisions_needed,
        confidence: review.confidence,
        recommendations: review.recommendations,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Reviewer Agent error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate data for accuracy and consistency
   */
  async validateData(payload) {
    const { data, data_type, context } = payload;
    
    try {
      console.log(`🔍 Reviewer Agent: Validating ${data_type} data`);
      
      const validation = {
        valid: true,
        issues: [],
        confidence: 1.0
      };
      
      switch (data_type) {
        case 'coordinates':
          this.validateCoordinates(data, validation);
          break;
          
        case 'places':
          this.validatePlaces(data, validation);
          break;
          
        case 'routes':
          this.validateRoutes(data, validation);
          break;
          
        default:
          this.validateGeneric(data, validation);
      }
      
      return {
        success: true,
        valid: validation.valid,
        issues: validation.issues,
        confidence: validation.confidence,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Data validation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check citations in response
   */
  checkCitations(response, evidence, review) {
    // Check if response has citations
    const hasCitations = response.includes('[') && response.includes(']');
    const hasSources = response.includes('Sources:') || response.includes('**Sources:**');
    
    if (!hasCitations && evidence?.citations?.length > 0) {
      review.issues.push({
        type: 'citation',
        severity: 'high',
        description: 'Response lacks proper citations for data sources',
        suggestion: 'Add inline citations [1], [2] and source list'
      });
    }
    
    if (hasCitations && !hasSources) {
      review.issues.push({
        type: 'citation',
        severity: 'medium',
        description: 'Response has inline citations but no source list',
        suggestion: 'Add source list at the end of response'
      });
    }
  }

  /**
   * Check mathematical accuracy and units
   */
  checkMathAndUnits(response, review) {
    // Check coordinate ranges
    const coordMatches = response.match(/(-?\d+\.?\d*)\s*°\s*[NS]?\s*,?\s*(-?\d+\.?\d*)\s*°\s*[EW]?/g);
    if (coordMatches) {
      coordMatches.forEach(match => {
        const coords = match.match(/(-?\d+\.?\d*)/g);
        if (coords) {
          const lat = parseFloat(coords[0]);
          const lon = parseFloat(coords[1]);
          
          if (lat < -90 || lat > 90) {
            review.issues.push({
              type: 'math',
              severity: 'critical',
              description: `Invalid latitude: ${lat} (must be -90 to 90)`,
              suggestion: 'Check coordinate calculation'
            });
          }
          
          if (lon < -180 || lon > 180) {
            review.issues.push({
              type: 'math',
              severity: 'critical',
              description: `Invalid longitude: ${lon} (must be -180 to 180)`,
              suggestion: 'Check coordinate calculation'
            });
          }
        }
      });
    }
    
    // Check distance units consistency
    const distanceMatches = response.match(/(\d+\.?\d*)\s*(km|miles|m|meters)/g);
    if (distanceMatches) {
      const units = distanceMatches.map(match => match.match(/(km|miles|m|meters)/)[0]);
      const uniqueUnits = [...new Set(units)];
      
      if (uniqueUnits.length > 1) {
        review.issues.push({
          type: 'math',
          severity: 'medium',
          description: 'Inconsistent distance units used',
          suggestion: 'Use consistent units (preferably km)'
        });
      }
    }
  }

  /**
   * Check safety and appropriateness
   */
  checkSafety(response, review) {
    // Check for potentially harmful content
    const harmfulPatterns = [
      /private\s+information/i,
      /personal\s+data/i,
      /exact\s+address/i,
      /home\s+address/i
    ];
    
    harmfulPatterns.forEach(pattern => {
      if (pattern.test(response)) {
        review.issues.push({
          type: 'safety',
          severity: 'high',
          description: 'Response may contain sensitive information',
          suggestion: 'Remove or generalize personal information'
        });
      }
    });
    
    // Check for appropriate language
    const inappropriatePatterns = [
      /damn|hell|shit|fuck/i,
      /hate|kill|destroy/i
    ];
    
    inappropriatePatterns.forEach(pattern => {
      if (pattern.test(response)) {
        review.issues.push({
          type: 'safety',
          severity: 'medium',
          description: 'Inappropriate language detected',
          suggestion: 'Use professional language'
        });
      }
    });
  }

  /**
   * Check style and formatting
   */
  checkStyle(response, review) {
    // Check for consistent formatting
    const hasConsistentFormatting = this.checkConsistentFormatting(response);
    if (!hasConsistentFormatting) {
      review.issues.push({
        type: 'style',
        severity: 'low',
        description: 'Inconsistent formatting detected',
        suggestion: 'Use consistent formatting for similar elements'
      });
    }
    
    // Check for proper capitalization
    const hasProperCapitalization = this.checkCapitalization(response);
    if (!hasProperCapitalization) {
      review.issues.push({
        type: 'style',
        severity: 'low',
        description: 'Inconsistent capitalization',
        suggestion: 'Use proper capitalization for place names and sentences'
      });
    }
  }

  /**
   * Check completeness
   */
  checkCompleteness(response, originalRequest, review) {
    // Check if response addresses the original request
    const requestKeywords = originalRequest.toLowerCase().split(' ').filter(word => 
      word.length > 3 && !['the', 'and', 'or', 'but', 'for', 'with'].includes(word)
    );
    
    const responseLower = response.toLowerCase();
    const addressedKeywords = requestKeywords.filter(keyword => 
      responseLower.includes(keyword)
    );
    
    const completenessRatio = addressedKeywords.length / requestKeywords.length;
    
    if (completenessRatio < 0.5) {
      review.issues.push({
        type: 'completeness',
        severity: 'high',
        description: 'Response does not adequately address the original request',
        suggestion: 'Include more relevant information from the request'
      });
    }
  }

  /**
   * Check accuracy
   */
  checkAccuracy(response, evidence, review) {
    // Check if response matches evidence
    if (evidence?.data) {
      const evidenceData = JSON.stringify(evidence.data).toLowerCase();
      const responseLower = response.toLowerCase();
      
      // Check for contradictory information
      if (evidenceData.includes('no results') && responseLower.includes('found')) {
        review.issues.push({
          type: 'accuracy',
          severity: 'critical',
          description: 'Response claims to have found results when evidence shows none',
          suggestion: 'Align response with actual evidence'
        });
      }
    }
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(data, validation) {
    if (!data.coordinates) {
      validation.issues.push({
        type: 'accuracy',
        severity: 'critical',
        description: 'No coordinates provided'
      });
      validation.valid = false;
      return;
    }
    
    const { lat, lon } = data.coordinates;
    
    if (lat < -90 || lat > 90) {
      validation.issues.push({
        type: 'accuracy',
        severity: 'critical',
        description: `Invalid latitude: ${lat}`
      });
      validation.valid = false;
    }
    
    if (lon < -180 || lon > 180) {
      validation.issues.push({
        type: 'accuracy',
        severity: 'critical',
        description: `Invalid longitude: ${lon}`
      });
      validation.valid = false;
    }
  }

  /**
   * Validate places data
   */
  validatePlaces(data, validation) {
    if (!data.places || !Array.isArray(data.places)) {
      validation.issues.push({
        type: 'accuracy',
        severity: 'critical',
        description: 'Invalid places data format'
      });
      validation.valid = false;
      return;
    }
    
    data.places.forEach((place, index) => {
      if (!place.name) {
        validation.issues.push({
          type: 'accuracy',
          severity: 'medium',
          description: `Place ${index + 1} missing name`
        });
      }
      
      if (place.rating && (place.rating < 0 || place.rating > 5)) {
        validation.issues.push({
          type: 'accuracy',
          severity: 'medium',
          description: `Place ${index + 1} has invalid rating: ${place.rating}`
        });
      }
    });
  }

  /**
   * Validate routes data
   */
  validateRoutes(data, validation) {
    if (!data.routes || !Array.isArray(data.routes)) {
      validation.issues.push({
        type: 'accuracy',
        severity: 'critical',
        description: 'Invalid routes data format'
      });
      validation.valid = false;
      return;
    }
    
    data.routes.forEach((route, index) => {
      if (!route.summary) {
        validation.issues.push({
          type: 'accuracy',
          severity: 'high',
          description: `Route ${index + 1} missing summary`
        });
      }
    });
  }

  /**
   * Validate generic data
   */
  validateGeneric(data, validation) {
    if (!data || typeof data !== 'object') {
      validation.issues.push({
        type: 'accuracy',
        severity: 'medium',
        description: 'Invalid data format'
      });
      validation.valid = false;
    }
  }

  /**
   * Check consistent formatting
   */
  checkConsistentFormatting(response) {
    // Check if similar elements use consistent formatting
    const placeMatches = response.match(/\d+\.\s+\*\*.*?\*\*/g);
    if (placeMatches && placeMatches.length > 1) {
      const firstFormat = placeMatches[0];
      return placeMatches.every(match => match.includes('**'));
    }
    return true;
  }

  /**
   * Check capitalization
   */
  checkCapitalization(response) {
    // Check if place names are properly capitalized
    const placeMatches = response.match(/\*\*([^*]+)\*\*/g);
    if (placeMatches) {
      return placeMatches.every(match => {
        const name = match.replace(/\*\*/g, '');
        return name[0] === name[0].toUpperCase();
      });
    }
    return true;
  }

  /**
   * Calculate confidence based on issues
   */
  calculateConfidence(issues) {
    if (issues.length === 0) return 1.0;
    
    const severityScores = {
      'low': 0.1,
      'medium': 0.3,
      'high': 0.6,
      'critical': 0.9
    };
    
    const totalScore = issues.reduce((sum, issue) => 
      sum + (severityScores[issue.severity] || 0), 0
    );
    
    return Math.max(0.0, 1.0 - (totalScore / issues.length));
  }

  /**
   * Generate recommendations based on issues
   */
  generateRecommendations(issues) {
    const recommendations = [];
    
    if (issues.some(i => i.type === 'citation')) {
      recommendations.push('Add proper citations and source attribution');
    }
    
    if (issues.some(i => i.type === 'math')) {
      recommendations.push('Verify numerical accuracy and unit consistency');
    }
    
    if (issues.some(i => i.type === 'safety')) {
      recommendations.push('Review content for safety and appropriateness');
    }
    
    if (issues.some(i => i.type === 'style')) {
      recommendations.push('Improve formatting and style consistency');
    }
    
    if (issues.some(i => i.type === 'completeness')) {
      recommendations.push('Ensure response fully addresses the request');
    }
    
    if (issues.some(i => i.type === 'accuracy')) {
      recommendations.push('Verify factual accuracy against source data');
    }
    
    return recommendations;
  }

  /**
   * Register with other agents
   */
  registerWithAgents() {
    this.a2a.registerAgent('planner-agent', 'planner', this.baseUrl);
    this.a2a.registerAgent('researcher-agent', 'researcher', this.baseUrl);
    this.a2a.registerAgent('writer-agent', 'writer', this.baseUrl);
    this.a2a.registerAgent('supervisor-agent', 'supervisor', this.baseUrl);
  }
}

module.exports = ReviewerAgent;
