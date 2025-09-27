#!/usr/bin/env node
/**
 * Vertex AI Observability Module
 * Provides tool calling observability and monitoring
 */

const { VertexAI } = require('@google-cloud/vertexai');
const { Logging } = require('@google-cloud/logging');
const { Monitoring } = require('@google-cloud/monitoring');

class VertexAIObservability {
  constructor(projectId, location = 'us-central1') {
    this.projectId = projectId;
    this.location = location;
    
    // Initialize Vertex AI
    this.vertexAI = new VertexAI({
      project: projectId,
      location: location
    });
    
    // Initialize Cloud Logging
    this.logging = new Logging({
      projectId: projectId
    });
    
    // Initialize Cloud Monitoring
    this.monitoring = new Monitoring({
      projectId: projectId
    });
    
    // Create log name
    this.logName = 'tomtom-mcp-tool-calls';
    this.log = this.logging.log(this.logName);
    
    console.log(`🔍 Vertex AI Observability initialized for project: ${projectId}`);
  }

  /**
   * Log tool call execution
   */
  async logToolCall(toolCall) {
    const {
      toolName,
      agentId,
      agentType,
      input,
      output,
      duration,
      success,
      error,
      userId,
      correlationId
    } = toolCall;

    const logEntry = {
      severity: success ? 'INFO' : 'ERROR',
      timestamp: new Date().toISOString(),
      labels: {
        tool_name: toolName,
        agent_id: agentId,
        agent_type: agentType,
        user_id: userId || 'anonymous',
        success: success.toString()
      },
      jsonPayload: {
        toolCall: {
          name: toolName,
          agent: {
            id: agentId,
            type: agentType
          },
          input: input,
          output: output,
          duration: duration,
          success: success,
          error: error,
          userId: userId,
          correlationId: correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };

    try {
      await this.log.write(logEntry);
      console.log(`📊 Logged tool call: ${toolName} (${agentId})`);
    } catch (error) {
      console.error('❌ Failed to log tool call:', error.message);
    }
  }

  /**
   * Create custom metrics for tool calling
   */
  async createCustomMetrics() {
    const metrics = [
      {
        type: 'custom.googleapis.com/tomtom_mcp/tool_calls_total',
        displayName: 'TomTom MCP Tool Calls Total',
        description: 'Total number of tool calls made',
        metricKind: 'CUMULATIVE',
        valueType: 'INT64'
      },
      {
        type: 'custom.googleapis.com/tomtom_mcp/tool_call_duration',
        displayName: 'TomTom MCP Tool Call Duration',
        description: 'Duration of tool calls in milliseconds',
        metricKind: 'GAUGE',
        valueType: 'DISTRIBUTION'
      },
      {
        type: 'custom.googleapis.com/tomtom_mcp/tool_call_errors',
        displayName: 'TomTom MCP Tool Call Errors',
        description: 'Number of tool call errors',
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
   * Record tool call metrics
   */
  async recordToolCallMetrics(toolCall) {
    const {
      toolName,
      agentId,
      duration,
      success
    } = toolCall;

    const timestamp = new Date();
    const projectName = `projects/${this.projectId}`;

    // Record total tool calls
    try {
      await this.monitoring.createTimeSeries({
        name: projectName,
        timeSeries: [{
          metric: {
            type: 'custom.googleapis.com/tomtom_mcp/tool_calls_total',
            labels: {
              tool_name: toolName,
              agent_id: agentId
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
      console.error('❌ Failed to record tool calls metric:', error.message);
    }

    // Record duration
    try {
      await this.monitoring.createTimeSeries({
        name: projectName,
        timeSeries: [{
          metric: {
            type: 'custom.googleapis.com/tomtom_mcp/tool_call_duration',
            labels: {
              tool_name: toolName,
              agent_id: agentId
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
      console.error('❌ Failed to record duration metric:', error.message);
    }

    // Record errors if any
    if (!success) {
      try {
        await this.monitoring.createTimeSeries({
          name: projectName,
          timeSeries: [{
            metric: {
              type: 'custom.googleapis.com/tomtom_mcp/tool_call_errors',
              labels: {
                tool_name: toolName,
                agent_id: agentId
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
        console.error('❌ Failed to record error metric:', error.message);
      }
    }
  }

  /**
   * Create a trace for tool calling
   */
  async createToolCallTrace(toolCall) {
    const {
      toolName,
      agentId,
      agentType,
      input,
      output,
      duration,
      success,
      userId,
      correlationId
    } = toolCall;

    const traceId = correlationId || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const traceData = {
      traceId: traceId,
      spans: [{
        spanId: `span-${Date.now()}`,
        parentSpanId: null,
        displayName: {
          value: `Tool Call: ${toolName}`,
          truncatedByteCount: 0
        },
        startTime: new Date(Date.now() - duration).toISOString(),
        endTime: new Date().toISOString(),
        attributes: {
          attributeMap: {
            'tool.name': { stringValue: { value: toolName } },
            'agent.id': { stringValue: { value: agentId } },
            'agent.type': { stringValue: { value: agentType } },
            'user.id': { stringValue: { value: userId || 'anonymous' } },
            'tool.success': { boolValue: success },
            'tool.duration_ms': { intValue: duration.toString() }
          }
        },
        status: {
          code: success ? 1 : 2, // OK = 1, ERROR = 2
          message: success ? 'Tool call successful' : 'Tool call failed'
        }
      }]
    };

    try {
      // Log trace data (in a real implementation, you'd use Cloud Trace API)
      console.log(`🔍 Trace created: ${traceId} for tool ${toolName}`);
      return traceId;
    } catch (error) {
      console.error('❌ Failed to create trace:', error.message);
      return null;
    }
  }

  /**
   * Comprehensive tool call observation
   */
  async observeToolCall(toolCall) {
    const startTime = Date.now();
    
    try {
      // Log the tool call
      await this.logToolCall(toolCall);
      
      // Record metrics
      await this.recordToolCallMetrics(toolCall);
      
      // Create trace
      const traceId = await this.createToolCallTrace(toolCall);
      
      console.log(`🔍 Observed tool call: ${toolCall.toolName} (${toolCall.agentId}) - Trace: ${traceId}`);
      
      return {
        success: true,
        traceId: traceId,
        observationTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('❌ Failed to observe tool call:', error.message);
      return {
        success: false,
        error: error.message,
        observationTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get tool call analytics
   */
  async getToolCallAnalytics(timeRange = '1h') {
    try {
      const filter = `resource.type="global" AND logName="projects/${this.projectId}/logs/${this.logName}"`;
      const [entries] = await this.logging.getEntries({
        filter: filter,
        pageSize: 1000
      });

      const analytics = {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageDuration: 0,
        toolBreakdown: {},
        agentBreakdown: {},
        errorRate: 0
      };

      let totalDuration = 0;

      entries.forEach(entry => {
        const payload = entry.metadata.jsonPayload?.toolCall;
        if (payload) {
          analytics.totalCalls++;
          
          if (payload.success) {
            analytics.successfulCalls++;
          } else {
            analytics.failedCalls++;
          }

          if (payload.duration) {
            totalDuration += payload.duration;
          }

          // Tool breakdown
          const toolName = payload.name;
          analytics.toolBreakdown[toolName] = (analytics.toolBreakdown[toolName] || 0) + 1;

          // Agent breakdown
          const agentId = payload.agent?.id;
          analytics.agentBreakdown[agentId] = (analytics.agentBreakdown[agentId] || 0) + 1;
        }
      });

      analytics.averageDuration = analytics.totalCalls > 0 ? totalDuration / analytics.totalCalls : 0;
      analytics.errorRate = analytics.totalCalls > 0 ? (analytics.failedCalls / analytics.totalCalls) * 100 : 0;

      return analytics;
    } catch (error) {
      console.error('❌ Failed to get analytics:', error.message);
      return null;
    }
  }
}

module.exports = VertexAIObservability;
