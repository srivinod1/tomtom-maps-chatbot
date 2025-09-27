# 🔍 Comprehensive Vertex AI Observability

Complete observability solution for all agents, tools, protocols, and operations in the TomTom MCP multi-agent system.

## 🏗️ **What's Observed**

### **1. Orchestrator Agent**
- **Operations**: Chat requests, query routing, agent coordination
- **Metrics**: Total operations, success/failure rates, response times
- **Logs**: Input/output, user context, conversation history
- **Traces**: End-to-end request flow, performance bottlenecks

### **2. Maps Agent**
- **Tools**: Search places, geocoding, reverse geocoding, directions, static maps
- **Metrics**: Tool usage, success rates, TomTom API integration
- **Logs**: Tool inputs/outputs, API responses, error handling
- **Traces**: Tool execution flow, external API calls

### **3. A2A Protocol**
- **Communication**: Inter-agent message passing
- **Metrics**: Message volume, success rates, latency
- **Logs**: Source/target agents, message types, payloads
- **Traces**: Message flow between agents

### **4. MCP Protocol**
- **Operations**: Tool calls, method invocations
- **Metrics**: Operation counts, success rates, duration
- **Logs**: Method names, parameters, responses
- **Traces**: Protocol-level operations

### **5. LLM Integration**
- **Calls**: OpenAI, Anthropic API calls
- **Metrics**: Token usage, response times, provider breakdown
- **Logs**: Prompts, responses, token counts
- **Traces**: LLM request/response cycles

### **6. TomTom API**
- **Calls**: Search, geocoding, routing, static maps
- **Metrics**: API usage, response times, error rates
- **Logs**: Endpoints, parameters, responses
- **Traces**: External API integration

### **7. System Events**
- **Events**: Server startup, errors, configuration changes
- **Metrics**: Event counts, severity levels
- **Logs**: Event details, system state
- **Traces**: System lifecycle events

## 📊 **Analytics Dashboard**

### **Real-time Metrics**
```json
{
  "orchestrator": {
    "totalOperations": 150,
    "successfulOperations": 142,
    "failedOperations": 8,
    "errorRate": 5.33,
    "averageDuration": 1250.5
  },
  "mapsAgent": {
    "totalTools": 80,
    "successfulTools": 75,
    "failedTools": 5,
    "errorRate": 6.25,
    "toolBreakdown": {
      "search_places": 45,
      "geocode_address": 20,
      "reverse_geocode": 10,
      "directions": 5
    }
  },
  "llmCalls": {
    "totalCalls": 70,
    "successfulCalls": 68,
    "totalTokens": 15420,
    "providerBreakdown": {
      "openai": 45,
      "anthropic": 23
    }
  },
  "tomtomApi": {
    "totalCalls": 80,
    "successfulCalls": 75,
    "errorRate": 6.25,
    "endpointBreakdown": {
      "search": 45,
      "geocoding": 20,
      "routing": 10,
      "staticmap": 5
    }
  },
  "a2aProtocol": {
    "totalMessages": 60,
    "successfulMessages": 58,
    "errorRate": 3.33
  },
  "mcpProtocol": {
    "totalOperations": 80,
    "successfulOperations": 75,
    "errorRate": 6.25
  },
  "systemEvents": {
    "totalEvents": 5,
    "eventBreakdown": {
      "server_startup": 1,
      "agent_registration": 2,
      "error_occurred": 2
    }
  },
  "overall": {
    "totalOperations": 520,
    "errorRate": 5.19
  }
}
```

## 🚀 **Setup Instructions**

### **1. Google Cloud Setup**
```bash
# Enable required APIs
gcloud services enable logging.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable cloudtrace.googleapis.com
gcloud services enable aiplatform.googleapis.com

# Create service account
gcloud iam service-accounts create tomtom-mcp-observability \
    --display-name="TomTom MCP Comprehensive Observability"

# Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:tomtom-mcp-observability@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:tomtom-mcp-observability@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/monitoring.metricWriter"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:tomtom-mcp-observability@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudtrace.agent"

# Create and download key
gcloud iam service-accounts keys create ./service-account-key.json \
    --iam-account=tomtom-mcp-observability@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

### **2. Environment Variables**
```bash
# Add to your .env file
GOOGLE_CLOUD_PROJECT=your_gcp_project_id
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### **3. Deploy to Railway**
```bash
# Add environment variables in Railway
railway variables set GOOGLE_CLOUD_PROJECT=your_project_id
railway variables set GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

# Deploy
git add -A
git commit -m "Add comprehensive observability"
git push origin main
```

## 🧪 **Testing**

### **Run Comprehensive Tests**
```bash
python3 test_comprehensive_observability.py
```

### **Check Analytics**
```bash
curl https://web-production-5f9ea.up.railway.app/analytics
```

### **Monitor in Google Cloud Console**
- **Logging**: https://console.cloud.google.com/logs
- **Monitoring**: https://console.cloud.google.com/monitoring
- **Trace**: https://console.cloud.google.com/trace

## 📈 **Custom Metrics**

### **Available Metrics**
- `custom.googleapis.com/tomtom_mcp/orchestrator_operations_total`
- `custom.googleapis.com/tomtom_mcp/orchestrator_operation_duration`
- `custom.googleapis.com/tomtom_mcp/maps_agent_tools_total`
- `custom.googleapis.com/tomtom_mcp/maps_agent_tool_duration`
- `custom.googleapis.com/tomtom_mcp/a2a_messages_total`
- `custom.googleapis.com/tomtom_mcp/a2a_message_duration`
- `custom.googleapis.com/tomtom_mcp/mcp_operations_total`
- `custom.googleapis.com/tomtom_mcp/mcp_operation_duration`
- `custom.googleapis.com/tomtom_mcp/llm_calls_total`
- `custom.googleapis.com/tomtom_mcp/llm_tokens_used`
- `custom.googleapis.com/tomtom_mcp/tomtom_api_calls_total`
- `custom.googleapis.com/tomtom_mcp/tomtom_api_duration`
- `custom.googleapis.com/tomtom_mcp/errors_total`

### **Log Names**
- `tomtom-mcp-orchestrator`
- `tomtom-mcp-maps-agent`
- `tomtom-mcp-a2a-protocol`
- `tomtom-mcp-mcp-protocol`
- `tomtom-mcp-llm-calls`
- `tomtom-mcp-api-calls`
- `tomtom-mcp-system-events`

## 🔍 **Observability Features**

### **1. Comprehensive Logging**
- **Structured Logs**: JSON format with consistent schema
- **Component Separation**: Separate logs for each component
- **Rich Context**: User IDs, correlation IDs, timestamps
- **Error Tracking**: Detailed error information and stack traces

### **2. Custom Metrics**
- **Counters**: Total operations, errors, successes
- **Distributions**: Response times, durations
- **Labels**: Component, operation type, success status
- **Real-time**: Live metrics collection and reporting

### **3. Distributed Tracing**
- **Trace IDs**: Unique correlation across components
- **Spans**: Individual operation timing
- **Attributes**: Rich metadata for debugging
- **Flow Visualization**: End-to-end request tracing

### **4. Real-time Analytics**
- **Live Dashboard**: Current system state
- **Performance Metrics**: Response times, error rates
- **Usage Patterns**: Component utilization
- **Health Monitoring**: System health indicators

## 🛠️ **Customization**

### **Add Custom Metrics**
```javascript
// In your operation handler
await observability.recordMetrics({
  component: 'customComponent',
  operationType: 'customOperation',
  duration: 1500,
  success: true,
  labels: {
    custom_label: 'custom_value'
  }
});
```

### **Add Custom Logs**
```javascript
// Log custom events
await observability.logSystemEvent({
  eventType: 'custom_event',
  component: 'my_component',
  message: 'Custom event occurred',
  data: { customData: 'value' },
  severity: 'INFO'
});
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Permission Denied**
   - Check service account permissions
   - Verify API enablement

2. **No Logs Appearing**
   - Check project ID configuration
   - Verify service account key path

3. **Metrics Not Showing**
   - Wait 5-10 minutes for metrics to appear
   - Check metric descriptor creation

4. **High Latency**
   - Observability adds ~10-50ms per operation
   - Consider async logging for high-volume scenarios

### **Debug Mode**
```javascript
// Enable debug logging
process.env.VERTEX_DEBUG = 'true';
```

## 📚 **Additional Resources**

- [Google Cloud Logging Documentation](https://cloud.google.com/logging/docs)
- [Google Cloud Monitoring Documentation](https://cloud.google.com/monitoring/docs)
- [Google Cloud Trace Documentation](https://cloud.google.com/trace/docs)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)

## 🎯 **Benefits**

1. **Complete Visibility**: Monitor every component and operation
2. **Performance Optimization**: Identify bottlenecks and optimize
3. **Error Debugging**: Track and resolve issues quickly
4. **Usage Analytics**: Understand system utilization patterns
5. **Health Monitoring**: Proactive system health management
6. **Cost Optimization**: Monitor resource usage and costs
7. **Compliance**: Audit trails and compliance reporting
