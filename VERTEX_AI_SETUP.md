# Vertex AI Observability Setup

This guide shows how to set up Vertex AI observability for tool calling in your A2A + MCP architecture.

## 🔧 Prerequisites

1. **Google Cloud Project**: You need an active Google Cloud project
2. **APIs Enabled**: Enable the following APIs in your project:
   - Cloud Logging API
   - Cloud Monitoring API
   - Cloud Trace API
   - Vertex AI API

## 🚀 Setup Steps

### 1. Enable Required APIs

```bash
# Enable APIs using gcloud CLI
gcloud services enable logging.googleapis.com
gcloud services enable monitoring.googleapis.com
gcloud services enable cloudtrace.googleapis.com
gcloud services enable aiplatform.googleapis.com
```

### 2. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create tomtom-mcp-observability \
    --display-name="TomTom MCP Observability" \
    --description="Service account for TomTom MCP tool calling observability"

# Grant necessary permissions
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

### 3. Set Environment Variables

```bash
# Add to your .env file
GOOGLE_CLOUD_PROJECT=your_gcp_project_id
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### 4. Deploy to Railway

```bash
# Add environment variables in Railway dashboard or CLI
railway variables set GOOGLE_CLOUD_PROJECT=your_gcp_project_id
railway variables set GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json

# Deploy
git add -A
git commit -m "Add Vertex AI observability"
git push origin main
```

## 📊 What You'll See

### Cloud Logging
- **Log Name**: `tomtom-mcp-tool-calls`
- **Logs**: Every tool call with input/output, duration, success/failure
- **Filter**: `resource.type="global" AND logName="projects/YOUR_PROJECT_ID/logs/tomtom-mcp-tool-calls"`

### Cloud Monitoring
- **Custom Metrics**:
  - `custom.googleapis.com/tomtom_mcp/tool_calls_total`
  - `custom.googleapis.com/tomtom_mcp/tool_call_duration`
  - `custom.googleapis.com/tomtom_mcp/tool_call_errors`

### Cloud Trace
- **Traces**: Distributed tracing for tool calls
- **Spans**: Individual tool call spans with timing and metadata

## 🧪 Testing

### 1. Run Test Script
```bash
python3 test_vertex_observability.py
```

### 2. Check Analytics
```bash
curl https://web-production-5f9ea.up.railway.app/analytics
```

### 3. View in Google Cloud Console
- **Logging**: https://console.cloud.google.com/logs
- **Monitoring**: https://console.cloud.google.com/monitoring
- **Trace**: https://console.cloud.google.com/trace

## 📈 Analytics Endpoint

The `/analytics` endpoint provides real-time analytics:

```json
{
  "success": true,
  "analytics": {
    "totalCalls": 150,
    "successfulCalls": 142,
    "failedCalls": 8,
    "errorRate": 5.33,
    "averageDuration": 1250.5,
    "toolBreakdown": {
      "search_places": 45,
      "geocode_address": 23,
      "reverse_geocode": 12
    },
    "agentBreakdown": {
      "maps-agent": 80,
      "orchestrator-agent": 70
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔍 Observability Features

### 1. Tool Call Logging
- **Input/Output**: Complete request/response data
- **Timing**: Precise duration measurements
- **Success/Failure**: Error tracking and categorization
- **User Context**: User ID and correlation tracking

### 2. Custom Metrics
- **Counters**: Total tool calls, errors
- **Distributions**: Duration histograms
- **Labels**: Tool name, agent ID, success status

### 3. Distributed Tracing
- **Trace IDs**: Unique correlation across services
- **Spans**: Individual tool call timing
- **Attributes**: Rich metadata for debugging

### 4. Real-time Analytics
- **Live Dashboard**: Current system state
- **Performance Metrics**: Response times, error rates
- **Usage Patterns**: Tool popularity, agent utilization

## 🛠️ Customization

### Add Custom Metrics
```javascript
// In your tool call handler
await vertexObservability.recordCustomMetric({
  name: 'custom.googleapis.com/tomtom_mcp/special_events',
  value: 1,
  labels: {
    event_type: 'special_search',
    user_tier: 'premium'
  }
});
```

### Custom Logging
```javascript
// Add custom log entries
await vertexObservability.logCustomEvent({
  event: 'user_preference_updated',
  userId: 'user123',
  data: { preference: 'search_radius', value: 5000 }
});
```

## 🚨 Troubleshooting

### Common Issues

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
   - Observability adds ~10-50ms per tool call
   - Consider async logging for high-volume scenarios

### Debug Mode
```javascript
// Enable debug logging
process.env.VERTEX_DEBUG = 'true';
```

## 📚 Additional Resources

- [Google Cloud Logging Documentation](https://cloud.google.com/logging/docs)
- [Google Cloud Monitoring Documentation](https://cloud.google.com/monitoring/docs)
- [Google Cloud Trace Documentation](https://cloud.google.com/trace/docs)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
