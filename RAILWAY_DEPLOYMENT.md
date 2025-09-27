# Railway Deployment Guide

This guide explains how to deploy the TomTom Maps Chatbot Agent to Railway.

## Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Push your code to GitHub
3. **TomTom API Key**: Get your API key from [TomTom Developer Portal](https://developer.tomtom.com/)

## Deployment Steps

### 1. Prepare Your Repository

Ensure your repository contains:
- `app.py` - Flask API server
- `chatbot_agent.py` - Chatbot agent logic
- `src/mcp-server.js` - TomTom MCP server
- `requirements.txt` - Python dependencies
- `package.json` - Node.js dependencies
- `railway.json` - Railway configuration for Flask app
- `railway-mcp.json` - Railway configuration for MCP server
- `Procfile` - Process definition for Flask app
- `Procfile-mcp` - Process definition for MCP server
- `runtime.txt` - Python version
- `.env.example` - Environment variables template

### 2. Deploy to Railway

You need to deploy **TWO services** on Railway:

#### Service 1: TomTom MCP Server

1. **Create First Service**:
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - **Rename the service to "mcp-server"**

2. **Configure MCP Server**:
   - In the service settings, set the **Root Directory** to the repository root
   - Set **Build Command** to: `npm install`
   - Set **Start Command** to: `npm start`
   - Add environment variable:
     ```
     TOMTOM_API_KEY=your_tomtom_api_key_here
     ```

3. **Get MCP Server URL**:
   - After deployment, copy the service URL (e.g., `https://mcp-server-production-xxx.up.railway.app`)
   - This will be your `MCP_SERVER_URL`

#### Service 2: Flask API Server

1. **Add Second Service**:
   - In the same Railway project, click "New Service"
   - Select "Deploy from GitHub repo"
   - Choose the same repository
   - **Rename the service to "api-server"**

2. **Configure Flask Server**:
   - In the service settings, set the **Root Directory** to the repository root
   - Set **Build Command** to: `pip install -r requirements.txt`
   - Set **Start Command** to: `python app.py`
   - Add environment variables:
     ```
     TOMTOM_API_KEY=your_tomtom_api_key_here
     MCP_SERVER_URL=https://mcp-server-production-xxx.up.railway.app
     FLASK_ENV=production
     ```

#### Option B: Deploy with Railway CLI

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
   railway variables set TOMTOM_API_KEY=your_tomtom_api_key_here
   railway variables set MCP_SERVER_URL=http://localhost:3000
   railway variables set FLASK_ENV=production
   ```

5. **Deploy**:
   ```bash
   railway up
   ```

### 3. Configure Custom Domain (Optional)

1. Go to your project settings in Railway
2. Click "Domains"
3. Add your custom domain
4. Configure DNS records as instructed

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TOMTOM_API_KEY` | Your TomTom API key | Yes | - |
| `MCP_SERVER_URL` | URL of the TomTom MCP server | No | `http://localhost:3000` |
| `FLASK_ENV` | Flask environment | No | `production` |
| `PORT` | Port for the Flask app | No | `5000` (Railway sets this) |

## API Endpoints

Once deployed, your chatbot will be available at:

- **Health Check**: `GET /`
- **Chat**: `POST /api/chat`
- **Chat History**: `GET /api/chat/history`
- **Set Context**: `POST /api/context`
- **Get Context**: `GET /api/context/<user_id>`
- **Capabilities**: `GET /api/capabilities`

### Example API Usage

```bash
# Health check
curl https://your-app.railway.app/

# Send a chat message
curl -X POST https://your-app.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find restaurants near me", "user_id": "user123"}'

# Get chat history
curl https://your-app.railway.app/api/chat/history?user_id=user123&limit=5

# Set user context (e.g., current location)
curl -X POST https://your-app.railway.app/api/context \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user123", "context": {"current_location": {"lat": 47.6062, "lon": -122.3321}}}'
```

## Frontend Integration

### JavaScript Example

```javascript
// Send a message to the chatbot
async function sendMessage(message, userId = 'default') {
  try {
    const response = await fetch('https://your-app.railway.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        user_id: userId
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: error.message };
  }
}

// Usage
sendMessage('Find coffee shops near 47.6062, -122.3321')
  .then(result => {
    if (result.success) {
      console.log('Bot response:', result.response);
    } else {
      console.error('Error:', result.error);
    }
  });
```

### React Example

```jsx
import React, { useState } from 'react';

function Chatbot() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      const result = await fetch('https://your-app.railway.app/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, user_id: 'user123' })
      });
      
      const data = await result.json();
      setResponse(data.response);
    } catch (error) {
      setResponse('Sorry, I encountered an error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask me about places, directions, or coordinates..."
      />
      <button onClick={sendMessage} disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
      {response && <div>{response}</div>}
    </div>
  );
}
```

## Monitoring and Logs

1. **View Logs**: Go to your Railway project dashboard and click "Logs"
2. **Monitor Performance**: Use Railway's built-in metrics
3. **Set up Alerts**: Configure alerts for errors or high usage

## Troubleshooting

### Common Issues

1. **App won't start**:
   - Check logs for dependency issues
   - Ensure `requirements.txt` includes all dependencies
   - Verify Python version in `runtime.txt`

2. **API calls failing**:
   - Check if `TOMTOM_API_KEY` is set correctly
   - Verify MCP server is running (if using external server)
   - Check Railway logs for error details

3. **CORS issues**:
   - Ensure `flask-cors` is installed
   - Check if frontend domain is allowed

### Getting Help

- Check Railway documentation: [docs.railway.app](https://docs.railway.app)
- View your app logs in Railway dashboard
- Test API endpoints using curl or Postman

## Cost Considerations

Railway offers:
- **Free tier**: $5 credit monthly
- **Pro plan**: Pay-as-you-go pricing
- **Team plan**: For collaborative development

Monitor your usage in the Railway dashboard to avoid unexpected charges.
