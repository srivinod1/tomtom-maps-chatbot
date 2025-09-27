#!/usr/bin/env node
/**
 * Comprehensive Vertex AI Observability
 * Covers all agents, tools, protocols, and operations
 */

const { VertexAI } = require('@google-cloud/vertexai');
const { Logging } = require('@google-cloud/logging');
const monitoring = require('@google-cloud/monitoring');

class ComprehensiveObservability {
  constructor(projectId, location = 'us-central1', credentials = null) {
    this.projectId = projectId;
    this.location = location;
    
    // Parse credentials if provided as JSON string
    let parsedCredentials = null;
    if (credentials) {
      try {
        parsedCredentials = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
      } catch (error) {
        console.warn('Warning: Failed to parse credentials JSON:', error.message);
      }
    }
    
    // Initialize Vertex AI
    this.vertexAI = new VertexAI({
      project: projectId,
      location: location,
      ...(parsedCredentials && { credentials: parsedCredentials })
    });
    
    // Initialize Cloud Logging
    this.logging = new Logging({
      projectId: projectId,
      ...(parsedCredentials && { credentials: parsedCredentials })
    });
    
    // Initialize Cloud Monitoring
    this.monitoring = new monitoring.MetricServiceClient({
      projectId: projectId,
      ...(parsedCredentials && { credentials: parsedCredentials })
    });
    
    // Create log names for different components
    this.logNames = {
      orchestrator: 'tomtom-mcp-orchestrator',
      mapsAgent: 'tomtom-mcp-maps-agent',
      a2aProtocol: 'tomtom-mcp-a2a-protocol',
      mcpProtocol: 'tomtom-mcp-protocol',
      llmCalls: 'tomtom-mcp-llm-calls',
      tomtomApi: 'tomtom-mcp-api-calls',
      systemEvents: 'tomtom-mcp-system-events'
    };
    
    // Create logs
    this.logs = {};
    Object.keys(this.logNames).forEach(key => {
      this.logs[key] = this.logging.log(this.logNames[key]);
    });
    
    console.log(`🔍 Comprehensive Observability initialized for project: ${projectId}`);
  }

  /**
   * Log Orchestrator Agent operations
   */
  async logOrchestratorOperation(operation) {
    const {
      operationType,
      userId,
      input,
      output,
      duration,
      success,
      error,
      agentUsed,
      queryType,
      correlationId
    } = operation;

    const logEntry = {
      severity: success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      labels: {
        operation_type: operationType,
        user_id: userId || 'anonymous',
        agent_used: agentUsed || 'unknown',
        query_type: queryType || 'unknown',
        success: success.toString()
      },
      jsonPayload: {
        orchestrator: {
          operationType,
          userId,
          input,
          output,
          duration,
          success,
          error,
          agentUsed,
          queryType,
          correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      await this.logs.orchestrator.write(logEntry);
      console.log(`📊 Logged orchestrator operation: ${operationType}`);
    } catch (error) {
      console.error('❌ Failed to log orchestrator operation:', error.message);
    }
  }

  /**
   * Log Maps Agent operations
   */
  async logMapsAgentOperation(operation) {
    const {
      toolName,
      input,
      output,
      duration,
      success,
      error,
      tomtomApiCall,
      correlationId
    } = operation;

    const logEntry = {
      severity: success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      labels: {
        tool_name: toolName,
        tomtom_api_call: tomtomApiCall || 'none',
        success: success.toString()
      },
      jsonPayload: {
        mapsAgent: {
          toolName,
          input,
          output,
          duration,
          success,
          error,
          tomtomApiCall,
          correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      await this.logs.mapsAgent.write(logEntry);
      console.log(`📊 Logged maps agent operation: ${toolName}`);
    } catch (error) {
      console.error('❌ Failed to log maps agent operation:', error.message);
    }
  }

  /**
   * Log A2A Protocol communication
   */
  async logA2ACommunication(communication) {
    const {
      sourceAgent,
      targetAgent,
      messageType,
      payload,
      response,
      duration,
      success,
      error,
      correlationId
    } = communication;

    const logEntry = {
      severity: success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      labels: {
        source_agent: sourceAgent,
        target_agent: targetAgent,
        message_type: messageType,
        success: success.toString()
      },
      jsonPayload: {
        a2aProtocol: {
          sourceAgent,
          targetAgent,
          messageType,
          payload,
          response,
          duration,
          success,
          error,
          correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      await this.logs.a2aProtocol.write(logEntry);
      console.log(`📊 Logged A2A communication: ${sourceAgent} -> ${targetAgent}`);
    } catch (error) {
      console.error('❌ Failed to log A2A communication:', error.message);
    }
  }

  /**
   * Log MCP Protocol operations
   */
  async logMCPOperation(operation) {
    const {
      method,
      toolName,
      input,
      output,
      duration,
      success,
      error,
      correlationId
    } = operation;

    const logEntry = {
      severity: success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      labels: {
        method: method,
        tool_name: toolName || 'none',
        success: success.toString()
      },
      jsonPayload: {
        mcpProtocol: {
          method,
          toolName,
          input,
          output,
          duration,
          success,
          error,
          correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      await this.logs.mcpProtocol.write(logEntry);
      console.log(`📊 Logged MCP operation: ${method}`);
    } catch (error) {
      console.error('❌ Failed to log MCP operation:', error.message);
    }
  }

  /**
   * Log LLM calls and responses
   */
  async logLLMCall(llmCall) {
    const {
      provider,
      model,
      prompt,
      response,
      tokensUsed,
      duration,
      success,
      error,
      userId,
      correlationId
    } = llmCall;

    const logEntry = {
      severity: success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      labels: {
        provider: provider,
        model: model || 'unknown',
        user_id: userId || 'anonymous',
        success: success.toString()
      },
      jsonPayload: {
        llmCall: {
          provider,
          model,
          prompt: prompt.substring(0, 1000), // Truncate for logging
          response: response ? response.substring(0, 1000) : null,
          tokensUsed,
          duration,
          success,
          error,
          userId,
          correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      await this.logs.llmCalls.write(logEntry);
      console.log(`📊 Logged LLM call: ${provider} (${model})`);
    } catch (error) {
      console.error('❌ Failed to log LLM call:', error.message);
    }
  }

  /**
   * Log TomTom API calls
   */
  async logTomTomAPICall(apiCall) {
    const {
      endpoint,
      method,
      params,
      response,
      statusCode,
      duration,
      success,
      error,
      correlationId
    } = apiCall;

    const logEntry = {
      severity: success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      labels: {
        endpoint: endpoint,
        method: method,
        status_code: statusCode?.toString() || 'unknown',
        success: success.toString()
      },
      jsonPayload: {
        tomtomApi: {
          endpoint,
          method,
          params,
          response: response ? JSON.stringify(response).substring(0, 2000) : null,
          statusCode,
          duration,
          success,
          error,
          correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      await this.logs.tomtomApi.write(logEntry);
      console.log(`📊 Logged TomTom API call: ${method} ${endpoint}`);
    } catch (error) {
      console.error('❌ Failed to log TomTom API call:', error.message);
    }
  }

  /**
   * Log system events
   */
  async logSystemEvent(event) {
    const {
      eventType,
      component,
      message,
      data,
      severity = 'INFO',
      correlationId
    } = event;

    const logEntry = {
      severity: severity,
      timestamp: new Date().toISOString(),
      labels: {
        event_type: eventType,
        component: component,
        severity: severity
      },
      jsonPayload: {
        systemEvent: {
          eventType,
          component,
          message,
          data,
          severity,
          correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      await this.logs.systemEvents.write(logEntry);
      console.log(`📊 Logged system event: ${eventType} (${component})`);
    } catch (error) {
      console.error('❌ Failed to log system event:', error.message);
    }
  }

  /**
   * Create comprehensive metrics
   */
  async createComprehensiveMetrics() {
    const metrics = [
      // Orchestrator metrics
      {
        type: 'custom.googleapis.com/tomtom_mcp/orchestrator_operations_total',
        displayName: 'Orchestrator Operations Total',
        description: 'Total number of orchestrator operations',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      },
      {
        type: 'custom.googleapis.com/tomtom_mcp/orchestrator_operation_duration',
        displayName: 'Orchestrator Operation Duration',
        description: 'Duration of orchestrator operations',
        metricKind: 'GAUGE',
        valueType: 'DISTRIBUTION'
      },
      
      // Maps Agent metrics
      {
        type: 'custom.googleapis.com/tomtom_mcp/maps_agent_tools_total',
        displayName: 'Maps Agent Tools Total',
        description: 'Total number of maps agent tool calls',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      },
      {
        type: 'custom.googleapis.com/tomtom_mcp/maps_agent_tool_duration',
        displayName: 'Maps Agent Tool Duration',
        description: 'Duration of maps agent tool calls',
        metricKind: 'GAUGE',
        valueType: 'DISTRIBUTION'
      },
      
      // A2A Protocol metrics
      {
        type: 'custom.googleapis.com/tomtom_mcp/a2a_messages_total',
        displayName: 'A2A Messages Total',
        description: 'Total number of A2A protocol messages',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      },
      {
        type: 'custom.googleapis.com/tomtom_mcp/a2a_message_duration',
        displayName: 'A2A Message Duration',
        description: 'Duration of A2A protocol messages',
        metricKind: 'GAUGE',
        valueType: 'DISTRIBUTION'
      },
      
      // MCP Protocol metrics
      {
        type: 'custom.googleapis.com/tomtom_mcp/mcp_operations_total',
        displayName: 'MCP Operations Total',
        description: 'Total number of MCP protocol operations',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      },
      {
        type: 'custom.googleapis.com/tomtom_mcp/mcp_operation_duration',
        displayName: 'MCP Operation Duration',
        description: 'Duration of MCP protocol operations',
        metricKind: 'GAUGE',
        valueType: 'DISTRIBUTION'
      },
      
      // LLM metrics
      {
        type: 'custom.googleapis.com/tomtom_mcp/llm_calls_total',
        displayName: 'LLM Calls Total',
        description: 'Total number of LLM calls',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      },
      {
        type: 'custom.googleapis.com/tomtom_mcp/llm_tokens_used',
        displayName: 'LLM Tokens Used',
        description: 'Total tokens used in LLM calls',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      },
      
      // TomTom API metrics
      {
        type: 'custom.googleapis.com/tomtom_mcp/tomtom_api_calls_total',
        displayName: 'TomTom API Calls Total',
        description: 'Total number of TomTom API calls',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      },
      {
        type: 'custom.googleapis.com/tomtom_mcp/tomtom_api_duration',
        displayName: 'TomTom API Duration',
        description: 'Duration of TomTom API calls',
        metricKind: 'GAUGE',
        valueType: 'DISTRIBUTION'
      },
      
      // Error metrics
      {
        type: 'custom.googleapis.com/tomtom_mcp/errors_total',
        displayName: 'Total Errors',
        description: 'Total number of errors across all components',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      }
    ];

    for (const metric of metrics) {
      try {
        await this.monitoring.createMetricDescriptor({
          name: `projects/${this.projectId}`,
          metricDescriptor: metric
        });
        console.log(`📈 Created metric: ${metric.displayName}`);
      } catch (error) {
        if (error.code === 6) { // Already exists
          console.log(`📈 Metric already exists: ${metric.displayName}`);
        } else {
          console.error(`❌ Failed to create metric ${metric.displayName}:`, error.message);
        }
      }
    }
  }

  /**
   * Record metrics for any operation
   */
  async recordMetrics(operation) {
    const {
      component,
      operationType,
      duration,
      success,
      labels = {},
      value = 1
    } = operation;

    const timestamp = new Date();
    const projectName = `projects/${this.projectId}`;

    // Map component to metric type
    const metricMap = {
      'orchestrator': 'custom.googleapis.com/tomtom_mcp/orchestrator_operations_total',
      'mapsAgent': 'custom.googleapis.com/tomtom_mcp/maps_agent_tools_total',
      'a2aProtocol': 'custom.googleapis.com/tomtom_mcp/a2a_messages_total',
      'mcpProtocol': 'custom.googleapis.com/tomtom_mcp/mcp_operations_total',
      'llmCalls': 'custom.googleapis.com/tomtom_mcp/llm_calls_total',
      'tomtomApi': 'custom.googleapis.com/tomtom_mcp/tomtom_api_calls_total'
    };

    const metricType = metricMap[component];
    if (!metricType) return;

    try {
      await this.monitoring.createTimeSeries({
        name: projectName,
        timeSeries: [{
          metric: {
            type: metricType,
            labels: {
              operation_type: operationType,
              success: success.toString(),
              ...labels
            }
          },
          resource: {
            type: 'global',
            labels: {
              project_id: this.projectId
            }
          },
          points: [{
            interval: {
              endTime: {
                seconds: Math.floor(timestamp.getTime() / 1000)
              }
            },
            value: {
              int64Value: value.toString()
            }
          }]
        }]
      });
    } catch (error) {
      console.error(`❌ Failed to record ${component} metric:`, error.message);
    }

    // Record duration if provided
    if (duration && component !== 'llmCalls') {
      const durationMetricType = metricType.replace('_total', '_duration');
      try {
        await this.monitoring.createTimeSeries({
          name: projectName,
          timeSeries: [{
            metric: {
              type: durationMetricType,
              labels: {
                operation_type: operationType,
                success: success.toString(),
                ...labels
              }
            },
            resource: {
              type: 'global',
              labels: {
                project_id: this.projectId
              }
            },
            points: [{
              interval: {
                endTime: {
                  seconds: Math.floor(timestamp.getTime() / 1000)
                }
              },
              value: {
                distributionValue: {
                  count: '1',
                  mean: duration,
                  sumOfSquaredDeviation: '0',
                  bucketCounts: ['0', '1', '0'],
                  bucketOptions: {
                    linearBuckets: {
                      numFiniteBuckets: 2,
                      width: 1000,
                      offset: 0
                    }
                  }
                }
              }
            }]
          }]
        });
      } catch (error) {
        console.error(`❌ Failed to record ${component} duration metric:`, error.message);
      }
    }

    // Record error if failed
    if (!success) {
      try {
        await this.monitoring.createTimeSeries({
          name: projectName,
          timeSeries: [{
            metric: {
              type: 'custom.googleapis.com/tomtom_mcp/errors_total',
              labels: {
                component: component,
                operation_type: operationType,
                ...labels
              }
            },
            resource: {
              type: 'global',
              labels: {
                project_id: this.projectId
              }
            },
            points: [{
              interval: {
                endTime: {
                  seconds: Math.floor(timestamp.getTime() / 1000)
                }
              },
              value: {
                int64Value: '1'
              }
            }]
          }]
        });
      } catch (error) {
        console.error(`❌ Failed to record error metric:`, error.message);
      }
    }
  }

  /**
   * Get comprehensive analytics
   */
  async getComprehensiveAnalytics(timeRange = '1h') {
    try {
      const analytics = {
        orchestrator: { totalOperations: 0, successfulOperations: 0, failedOperations: 0, averageDuration: 0 },
        mapsAgent: { totalTools: 0, successfulTools: 0, failedTools: 0, averageDuration: 0, toolBreakdown: {} },
        a2aProtocol: { totalMessages: 0, successfulMessages: 0, failedMessages: 0, averageDuration: 0 },
        mcpProtocol: { totalOperations: 0, successfulOperations: 0, failedOperations: 0, averageDuration: 0 },
        llmCalls: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, totalTokens: 0, providerBreakdown: {} },
        tomtomApi: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, averageDuration: 0, endpointBreakdown: {} },
        systemEvents: { totalEvents: 0, eventBreakdown: {} },
        overall: { totalOperations: 0, errorRate: 0, averageResponseTime: 0 }
      };

      // Get logs from all components
      for (const [component, log] of Object.entries(this.logs)) {
        const filter = `resource.type="global" AND logName="projects/${this.projectId}/logs/${this.logNames[component]}"`;
        const [entries] = await this.logging.getEntries({
          filter: filter,
          pageSize: 1000
        });

        entries.forEach(entry => {
          const payload = entry.metadata.jsonPayload;
          if (!payload) return;

          const data = payload[component] || payload;
          if (!data) return;

          // Update component analytics
          if (component === 'orchestrator') {
            analytics.orchestrator.totalOperations++;
            if (data.success) analytics.orchestrator.successfulOperations++;
            else analytics.orchestrator.failedOperations++;
            if (data.duration) analytics.orchestrator.averageDuration += data.duration;
          } else if (component === 'mapsAgent') {
            analytics.mapsAgent.totalTools++;
            if (data.success) analytics.mapsAgent.successfulTools++;
            else analytics.mapsAgent.failedTools++;
            if (data.duration) analytics.mapsAgent.averageDuration += data.duration;
            if (data.toolName) {
              analytics.mapsAgent.toolBreakdown[data.toolName] = 
                (analytics.mapsAgent.toolBreakdown[data.toolName] || 0) + 1;
            }
          } else if (component === 'a2aProtocol') {
            analytics.a2aProtocol.totalMessages++;
            if (data.success) analytics.a2aProtocol.successfulMessages++;
            else analytics.a2aProtocol.failedMessages++;
            if (data.duration) analytics.a2aProtocol.averageDuration += data.duration;
          } else if (component === 'mcpProtocol') {
            analytics.mcpProtocol.totalOperations++;
            if (data.success) analytics.mcpProtocol.successfulOperations++;
            else analytics.mcpProtocol.failedOperations++;
            if (data.duration) analytics.mcpProtocol.averageDuration += data.duration;
          } else if (component === 'llmCalls') {
            analytics.llmCalls.totalCalls++;
            if (data.success) analytics.llmCalls.successfulCalls++;
            else analytics.llmCalls.failedCalls++;
            if (data.tokensUsed) analytics.llmCalls.totalTokens += data.tokensUsed;
            if (data.provider) {
              analytics.llmCalls.providerBreakdown[data.provider] = 
                (analytics.llmCalls.providerBreakdown[data.provider] || 0) + 1;
            }
          } else if (component === 'tomtomApi') {
            analytics.tomtomApi.totalCalls++;
            if (data.success) analytics.tomtomApi.successfulCalls++;
            else analytics.tomtomApi.failedCalls++;
            if (data.duration) analytics.tomtomApi.averageDuration += data.duration;
            if (data.endpoint) {
              analytics.tomtomApi.endpointBreakdown[data.endpoint] = 
                (analytics.tomtomApi.endpointBreakdown[data.endpoint] || 0) + 1;
            }
          } else if (component === 'systemEvents') {
            analytics.systemEvents.totalEvents++;
            if (data.eventType) {
              analytics.systemEvents.eventBreakdown[data.eventType] = 
                (analytics.systemEvents.eventBreakdown[data.eventType] || 0) + 1;
            }
          }

          analytics.overall.totalOperations++;
        });
      }

      // Calculate averages and rates
      Object.keys(analytics).forEach(component => {
        if (component === 'overall') return;
        const data = analytics[component];
        if (data.totalOperations > 0) {
          data.averageDuration = data.averageDuration / data.totalOperations;
        }
        if (data.totalOperations > 0) {
          data.errorRate = ((data.totalOperations - data.successfulOperations) / data.totalOperations) * 100;
        }
      });

      // Calculate overall metrics
      const totalOps = analytics.orchestrator.totalOperations + analytics.mapsAgent.totalTools + 
                      analytics.a2aProtocol.totalMessages + analytics.mcpProtocol.totalOperations;
      const totalErrors = (analytics.orchestrator.totalOperations - analytics.orchestrator.successfulOperations) +
                         (analytics.mapsAgent.totalTools - analytics.mapsAgent.successfulTools) +
                         (analytics.a2aProtocol.totalMessages - analytics.a2aProtocol.successfulMessages) +
                         (analytics.mcpProtocol.totalOperations - analytics.mcpProtocol.successfulOperations);

      analytics.overall.totalOperations = totalOps;
      analytics.overall.errorRate = totalOps > 0 ? (totalErrors / totalOps) * 100 : 0;

      return analytics;
    } catch (error) {
      console.error('❌ Failed to get comprehensive analytics:', error.message);
      return null;
    }
  }

  /**
   * Comprehensive observation wrapper
   */
  async observeOperation(operation) {
    const startTime = Date.now();
    
    try {
      // Log based on component type
      switch (operation.component) {
        case 'orchestrator':
          await this.logOrchestratorOperation(operation);
          break;
        case 'mapsAgent':
          await this.logMapsAgentOperation(operation);
          break;
        case 'a2aProtocol':
          await this.logA2ACommunication(operation);
          break;
        case 'mcpProtocol':
          await this.logMCPOperation(operation);
          break;
        case 'llmCalls':
          await this.logLLMCall(operation);
          break;
        case 'tomtomApi':
          await this.logTomTomAPICall(operation);
          break;
        case 'systemEvents':
          await this.logSystemEvent(operation);
          break;
        default:
          console.warn(`Unknown component for observation: ${operation.component}`);
      }
      
      // Record metrics
      await this.recordMetrics(operation);
      
      console.log(`🔍 Observed ${operation.component} operation: ${operation.operationType || operation.toolName || operation.eventType}`);
      
      return {
        success: true,
        observationTime: Date.now() - startTime
      };
    } catch (error) {
      console.error(`❌ Failed to observe ${operation.component} operation:`, error.message);
      return {
        success: false,
        error: error.message,
        observationTime: Date.now() - startTime
      };
    }
  }
}

module.exports = ComprehensiveObservability;
