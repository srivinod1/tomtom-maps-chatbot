# Railway Deployment Guide - TomTom MCP Server

This guide will help you deploy the TomTom MCP Server as a separate service on Railway.

## 🚀 Quick Deployment Steps

### 1. Create New Railway Project

1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository: `srivinod1/tomtom-maps-chatbot`

### 2. Configure Railway Service

1. **Service Name**: `tomtom-mcp-server`
2. **Root Directory**: `/` (root of repository)
3. **Build Command**: `npm install`
4. **Start Command**: `npm run mcp-server`
5. **Port**: Railway will auto-assign (usually 8080)

### 3. Environment Variables

Set these environment variables in Railway dashboard:

```bash
# Required
TOMTOM_API_KEY=lo7LLQ3sNOEPcVad8LH7zq8UH3M5kGXG

# Optional (Railway will set these automatically)
PORT=8080
NODE_ENV=production
```

### 4. Railway Configuration File

The project includes `railway-mcp.json` with optimized settings:

```json
{
  "deploy": {
    "startCommand": "npm run mcp-server",
    "healthcheckPath": "/tools",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

## 🔧 MCP Server Endpoints

Once deployed, your MCP server will be available at:

- **Health Check**: `https://your-app-name.up.railway.app/`
- **Tools List**: `https://your-app-name.up.railway.app/tools`
- **Tool Execution**: `https://your-app-name.up.railway.app/tools/:toolName/execute`

## 🧪 Testing Your Deployment

### Test Health Check
```bash
curl https://your-app-name.up.railway.app/
```

### Test Tools Endpoint
```bash
curl https://your-app-name.up.railway.app/tools
```

### Test Tool Execution
```bash
curl -X POST https://your-app-name.up.railway.app/tools/search/execute \
  -H "Content-Type: application/json" \
  -d '{
    "query": "restaurants",
    "lat": 52.3676,
    "lon": 4.9041,
    "radius": 5000,
    "limit": 5
  }'
```

## 🔗 Integration with Main Server

After deploying the MCP server, update your main server's environment variables:

```bash
# In your main server's Railway deployment
MCP_TOOL_SERVER_URL=https://your-mcp-server-name.up.railway.app
```

## 📊 Monitoring

Railway provides built-in monitoring:
- **Logs**: View real-time logs in Railway dashboard
- **Metrics**: CPU, Memory, Network usage
- **Health Checks**: Automatic health monitoring

## 🚨 Troubleshooting

### Common Issues

1. **Port Issues**: Railway auto-assigns ports, don't hardcode PORT=3003
2. **Environment Variables**: Ensure TOMTOM_API_KEY is set
3. **Build Failures**: Check Node.js version compatibility
4. **Health Check Failures**: Verify `/tools` endpoint is accessible

### Debug Commands

```bash
# Check if server is running
curl https://your-app-name.up.railway.app/

# Test specific tool
curl -X POST https://your-app-name.up.railway.app/tools/geocode/execute \
  -H "Content-Type: application/json" \
  -d '{"address": "Amsterdam"}'
```

## 🔄 Updates and Redeployment

Railway automatically redeploys when you push to your main branch:

```bash
git add .
git commit -m "Update MCP server"
git push origin main
```

## 💰 Cost Considerations

- Railway offers a free tier with usage limits
- Monitor your usage in the Railway dashboard
- Consider upgrading for production workloads

## 📝 Next Steps

1. Deploy the MCP server using this guide
2. Update your main server to use the external MCP server URL
3. Test the integration thoroughly
4. Monitor performance and usage

---

**Need Help?** Check Railway's documentation or create an issue in the repository.
