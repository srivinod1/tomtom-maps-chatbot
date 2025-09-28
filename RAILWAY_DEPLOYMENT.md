# Railway Deployment Guide

This guide explains how to deploy the Google ADK + A2A + MCP Multi-Agent System to Railway.

## 🚂 Deployment Overview

The deployment consists of a **single unified service** on Railway that runs:
- Google ADK Orchestrator with LLM-powered context extraction
- A2A Protocol for inter-agent communication  
- MCP Tool Server for TomTom Maps API integration
- Specialized agents (Maps Agent, General AI Agent)
- Comprehensive observability and analytics
- **LLM-powered intelligent routing** for directions, search, and geocoding queries

## 📋 Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your code pushed to GitHub
3. **TomTom API Key**: Get one from [TomTom Developer Portal](https://developer.tomtom.com/)

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

Ensure your repository contains:
- `package.json` - Node.js dependencies and scripts
- `src/unified-server.js` - Main unified server with orchestrator and maps agent
- `src/mcp-tool-server.js` - MCP tool server for TomTom API integration
- `src/a2a-protocol.js` - Agent-to-Agent communication protocol
- `src/mcp-client.js` - MCP client for tool discovery
- `railway.json` - Railway configuration
- `.env.example` - Environment variable template

### Step 2: Deploy to Railway

#### Option A: Railway Dashboard (Recommended)

1. **Go to Railway Dashboard**:
   - Visit [railway.app/dashboard](https://railway.app/dashboard)
   - Sign in with your GitHub account

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Configure Service**:
   - Railway will automatically detect it's a Node.js app
   - The service will be named after your repository

4. **Set Environment Variables**:
   - Go to your service settings
   - Click "Variables" tab
   - Add the following environment variables:

   **Required:**
   ```
   TOMTOM_API_KEY=your_actual_tomtom_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=production
   ```

   **Optional (for enhanced features):**
   ```
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   GOOGLE_CLOUD_PROJECT=sunlit-precinct-473418-u9
   GOOGLE_APPLICATION_CREDENTIALS=your_service_account_json
   ```

5. **Deploy**:
   - Railway will automatically build and deploy
   - Monitor the deployment logs
   - Wait for "Deployment successful" message

#### Option B: Railway CLI

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Initialize Project**:
   ```bash
   railway init
   ```

4. **Set Environment Variables**:
   ```bash
   railway variables set TOMTOM_API_KEY=your_actual_tomtom_api_key_here
   railway variables set OPENAI_API_KEY=your_openai_api_key_here
   railway variables set ANTHROPIC_API_KEY=your_anthropic_api_key_here
   railway variables set NODE_ENV=production
   railway variables set GOOGLE_CLOUD_PROJECT=your_gcp_project_id
   ```

5. **Deploy**:
   ```bash
   railway up
   ```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TOMTOM_API_KEY` | Your TomTom API key | Yes | - |
| `OPENAI_API_KEY` | Your OpenAI API key | No | For LLM responses |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | No | For LLM responses |
| `NODE_ENV` | Environment mode | No | `production` |
| `PORT` | Server port | No | `3000` (Railway sets this) |

### Railway Configuration

The `railway.json` file configures:
- **Builder**: NIXPACKS (automatic Node.js detection)
- **Start Command**: `npm start` (runs `node src/unified-server.js`)
- **Health Check**: Root path `/`
- **Restart Policy**: On failure with max 10 retries

## 🌐 Accessing Your Deployed Service

Once deployed, your MCP server will be available at:
```
https://your-service-name-production-xxxx.up.railway.app
```

### Health Check
```bash
curl https://your-service-name-production-xxxx.up.railway.app/
```

### Test Multi-Agent System
```bash
# Test orchestrator capabilities
curl -X POST https://your-service-name-production-xxxx.up.railway.app \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "orchestrator.capabilities"}'

# Test location search (Maps Agent)
curl -X POST https://your-service-name-production-xxxx.up.railway.app \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "orchestrator.chat", "params": {"message": "Find coffee shops near me", "user_id": "test_user"}}'

# Test directions (Maps Agent)
curl -X POST https://your-service-name-production-xxxx.up.railway.app \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "orchestrator.chat", "params": {"message": "directions from Times Square to Central Park", "user_id": "test_user"}}'

# Test geocoding (Maps Agent)
curl -X POST https://your-service-name-production-xxxx.up.railway.app \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "orchestrator.chat", "params": {"message": "What are the coordinates for Times Square New York?", "user_id": "test_user"}}'

# Test general chat (General AI Agent)
curl -X POST https://your-service-name-production-xxxx.up.railway.app \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "orchestrator.chat", "params": {"message": "Hello! How are you?", "user_id": "test_user"}}'

# Test analytics
curl https://your-service-name-production-xxxx.up.railway.app/analytics
```

## 🔍 Monitoring & Debugging

### Railway Dashboard
- **Logs**: View real-time application logs
- **Metrics**: Monitor CPU, memory, and network usage
- **Deployments**: Track deployment history and status

### Health Monitoring
- Railway automatically monitors the health check endpoint
- Failed health checks trigger automatic restarts
- Monitor logs for any issues

### Common Issues

1. **Build Failures**:
   - Check `package.json` dependencies
   - Verify Node.js version compatibility
   - Review build logs in Railway dashboard

2. **Runtime Errors**:
   - Check environment variables are set correctly
   - Verify TomTom API key is valid
   - Review application logs

3. **Health Check Failures**:
   - Ensure MCP server starts successfully
   - Check if port is correctly configured
   - Verify health check endpoint responds

## 🔄 Updates & Redeployment

### Automatic Deployments
- Railway automatically redeploys when you push to your main branch
- Each push triggers a new deployment
- Previous deployments are kept for rollback

### Manual Deployments
```bash
# Using Railway CLI
railway up

# Or trigger from Railway dashboard
# Go to your service → Deployments → Redeploy
```

## 📊 Scaling

### Horizontal Scaling
- Railway can automatically scale based on traffic
- Configure scaling in service settings
- Monitor usage and adjust as needed

### Performance Optimization
- Enable Railway's CDN for static assets
- Configure caching headers
- Monitor response times and optimize

## 🛡️ Security

### Environment Variables
- Never commit API keys to your repository
- Use Railway's secure environment variable storage
- Rotate API keys regularly

### Network Security
- Railway provides HTTPS by default
- Configure CORS if needed for frontend integration
- Use Railway's built-in DDoS protection

## 💰 Cost Management

### Railway Pricing
- Railway offers a free tier with usage limits
- Monitor your usage in the dashboard
- Upgrade plans as needed

### Optimization Tips
- Use efficient Node.js practices
- Implement proper error handling
- Monitor memory usage and optimize

## 🔗 Frontend Integration

### JavaScript Example
```javascript
const MCP_SERVER_URL = 'https://your-service-name-production-xxxx.up.railway.app';

async function sendMessage(message, userId = 'default') {
  const response = await fetch(MCP_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'orchestrator.chat',
      params: { message, user_id: userId }
    })
  });
  
  const data = await response.json();
  return data.result.response;
}

// Usage
sendMessage('Find coffee shops near me')
  .then(response => console.log(response));
```

### React Example
```jsx
import React, { useState } from 'react';

const MCP_SERVER_URL = 'https://your-service-name-production-xxxx.up.railway.app';

function ChatComponent() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');

  const sendMessage = async () => {
    try {
      const result = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'orchestrator.chat',
          params: { message, user_id: 'user123' }
        })
      });
      
      const data = await result.json();
      setResponse(data.result.response);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask me anything..."
      />
      <button onClick={sendMessage}>Send</button>
      {response && <div>{response}</div>}
    </div>
  );
}
```

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Node.js on Railway](https://docs.railway.app/deploy/nodejs)
- [Environment Variables](https://docs.railway.app/deploy/environment-variables)
- [Custom Domains](https://docs.railway.app/deploy/custom-domains)

## 🆘 Support

### Railway Support
- [Railway Discord](https://discord.gg/railway)
- [Railway GitHub](https://github.com/railwayapp)
- [Railway Status](https://status.railway.app/)

### Project Support
- Check project documentation
- Review logs for error details
- Test locally before deploying

This deployment guide ensures your Multi-Agent TomTom Maps MCP Server runs smoothly on Railway with proper monitoring and scaling capabilities.