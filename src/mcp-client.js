#!/usr/bin/env node
/**
 * MCP Client for Agent Tool Access
 * Follows Model Context Protocol best practices
 */

const axios = require('axios');

class MCPClient {
  constructor(toolServerUrl) {
    this.toolServerUrl = toolServerUrl;
    this.manifest = null;
    this.tools = [];
  }

  /**
   * Discover available tools from MCP server
   */
  async discoverTools() {
    try {
      const response = await axios.get(`${this.toolServerUrl}/tools`);
      // Handle both array and object responses
      this.tools = Array.isArray(response.data) ? response.data : response.data.tools || [];
      console.log(`🔍 Discovered ${this.tools.length} tools from MCP server`);
      return this.tools;
    } catch (error) {
      console.error('Failed to discover tools:', error.message);
      throw error;
    }
  }

  /**
   * Get tool manifest
   */
  async getManifest() {
    try {
      const response = await axios.get(`${this.toolServerUrl}/manifest`);
      this.manifest = response.data;
      return this.manifest;
    } catch (error) {
      console.error('Failed to get manifest:', error.message);
      throw error;
    }
  }

  /**
   * Execute a tool with input parameters
   */
  async callTool(toolName, input) {
    try {
      // Validate tool exists
      const tool = this.tools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      // Validate input against schema
      this.validateInput(tool, input);

      // Execute tool
      const response = await axios.post(`${this.toolServerUrl}/tools/${encodeURIComponent(toolName)}/execute`, input);
      
      if (response.data.success) {
        return response.data.result;
      } else {
        throw new Error(response.data.error || 'Tool execution failed');
      }
    } catch (error) {
      console.error(`Tool call failed for ${toolName}:`, error.message);
      throw error;
    }
  }

  /**
   * Validate input against tool schema
   */
  validateInput(tool, input) {
    const schema = tool.inputSchema;
    const required = schema.required || [];
    
    // Check required fields
    for (const field of required) {
      if (!(field in input)) {
        throw new Error(`Required field '${field}' missing for tool ${tool.name}`);
      }
    }

    // Basic type validation
    for (const [key, value] of Object.entries(input)) {
      const property = schema.properties[key];
      if (property) {
        this.validateProperty(key, value, property);
      }
    }
  }

  /**
   * Validate individual property
   */
  validateProperty(key, value, property) {
    const expectedType = property.type;
    const actualType = typeof value;

    if (expectedType === 'string' && actualType !== 'string') {
      throw new Error(`Property '${key}' must be a string`);
    }
    if (expectedType === 'number' && actualType !== 'number') {
      throw new Error(`Property '${key}' must be a number`);
    }
    if (expectedType === 'boolean' && actualType !== 'boolean') {
      throw new Error(`Property '${key}' must be a boolean`);
    }
    if (expectedType === 'array' && !Array.isArray(value)) {
      throw new Error(`Property '${key}' must be an array`);
    }
    if (expectedType === 'object' && (actualType !== 'object' || Array.isArray(value))) {
      throw new Error(`Property '${key}' must be an object`);
    }
  }

  /**
   * Get available tool names
   */
  getAvailableTools() {
    return this.tools.map(tool => tool.name);
  }

  /**
   * Get tool by name
   */
  getTool(toolName) {
    return this.tools.find(tool => tool.name === toolName);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.toolServerUrl}/health`);
      return response.data;
    } catch (error) {
      throw new Error(`MCP server health check failed: ${error.message}`);
    }
  }
}

module.exports = MCPClient;
