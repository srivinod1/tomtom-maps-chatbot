# TomTom Maps Chatbot Agent

A powerful chatbot agent that combines TomTom Maps API with general knowledge to answer location-based queries. Deployable on Railway with a Flask API backend.

## 🚀 Features

- **🗺️ Location Search**: Find restaurants, hotels, gas stations, and more
- **🚗 Directions**: Get turn-by-turn directions between locations
- **📍 Geocoding**: Convert addresses to coordinates and vice versa
- **🗺️ Static Maps**: Generate map images for locations
- **📊 Matrix Routing**: Calculate distance/time matrices
- **💬 Conversational AI**: Natural language processing for location queries
- **🔧 REST API**: Easy integration with any frontend
- **☁️ Railway Ready**: One-click deployment to Railway

## 🏗️ Architecture

```
Frontend (Your App)
       ↓
Flask API Server (app.py)
       ↓
Chatbot Agent (chatbot_agent.py)
       ↓
TomTom MCP Server (src/mcp-server.js)
       ↓
TomTom Maps API
```

## 📋 Prerequisites

- Python 3.9+
- Node.js 16+
- TomTom API Key ([Get one here](https://developer.tomtom.com/))
- Railway account ([Sign up here](https://railway.app))

## 🚀 Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/YOUR_USERNAME/tomtom-maps-chatbot.git
cd tomtom-maps-chatbot
```

### 2. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
npm install
```

### 3. Configure Environment

```bash
# Copy environment template
cp env.example .env

# Edit .env and add your TomTom API key
echo "TOMTOM_API_KEY=your_api_key_here" >> .env
```

### 4. Start Services

```bash
# Start TomTom MCP server (Terminal 1)
npm start

# Start Flask API server (Terminal 2)
python app.py
```

### 5. Test the API

```bash
# Run the test suite
python test_api.py
```

## 🌐 API Endpoints

### Health Check
```http
GET /
```

### Chat with Bot
```http
POST /api/chat
Content-Type: application/json

{
  "message": "Find restaurants near 47.6062, -122.3321",
  "user_id": "user123"
}
```

### Get Chat History
```http
GET /api/chat/history?user_id=user123&limit=10
```

### Set User Context
```http
POST /api/context
Content-Type: application/json

{
  "user_id": "user123",
  "context": {
    "current_location": {"lat": 47.6062, "lon": -122.3321}
  }
}
```

### Get Capabilities
```http
GET /api/capabilities
```

## 💬 Example Queries

The chatbot can handle various types of location queries:

- **Search**: "Find coffee shops near me"
- **Directions**: "How do I get from Seattle to Portland?"
- **Geocoding**: "What are the coordinates for 123 Main Street?"
- **Reverse Geocoding**: "What's at 47.6062, -122.3321?"
- **General**: "Hello! What can you do?"

## 🚂 Railway Deployment

### Option 1: Deploy from GitHub

1. Push your code to GitHub
2. Go to [Railway](https://railway.app)
3. Create new project from GitHub repo
4. Set environment variables:
   ```
   TOMTOM_API_KEY=your_api_key_here
   MCP_SERVER_URL=http://localhost:3000
   FLASK_ENV=production
   ```
5. Deploy!

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for detailed instructions.

## 🧪 Testing

### Run All Tests
```bash
# Test TomTom MCP server
python test_all_endpoints.py

# Test Flask API
python test_api.py

# Test chatbot integration
python test_agent_queries.py
```

### Manual Testing
```bash
# Test health endpoint
curl http://localhost:5001/

# Test chat endpoint
curl -X POST http://localhost:5001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find restaurants near 47.6062, -122.3321"}'
```

## 🔧 Frontend Integration

### JavaScript Example
```javascript
async function sendMessage(message, userId = 'default') {
  const response = await fetch('https://your-app.railway.app/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, user_id: userId })
  });
  
  const data = await response.json();
  return data.response;
}

// Usage
sendMessage('Find coffee shops near me')
  .then(response => console.log(response));
```

### React Example
```jsx
import React, { useState } from 'react';

function Chatbot() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');

  const sendMessage = async () => {
    const result = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, user_id: 'user123' })
    });
    
    const data = await result.json();
    setResponse(data.response);
  };

  return (
    <div>
      <input value={message} onChange={(e) => setMessage(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
      {response && <div>{response}</div>}
    </div>
  );
}
```

## 📁 Project Structure

```
tomtom-maps-chatbot/
├── app.py                    # Flask API server
├── chatbot_agent.py          # Chatbot agent logic
├── src/
│   ├── mcp-server.js         # TomTom MCP server
│   ├── tomtom-maps/
│   │   └── index.js          # TomTom API integration
│   └── tools.py              # ADK tools
├── examples/                 # Example scripts
├── scripts/                  # Utility scripts
├── docs/                     # Documentation
├── railway.json              # Railway deployment config
├── requirements.txt          # Python dependencies
├── package.json              # Node.js dependencies
└── test_*.py                 # Test suites
```

## 🔑 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TOMTOM_API_KEY` | Your TomTom API key | Yes | - |
| `MCP_SERVER_URL` | TomTom MCP server URL | No | `http://localhost:3000` |
| `FLASK_ENV` | Flask environment | No | `production` |
| `PORT` | Flask port | No | `5000` (Railway sets this) |

## 🐛 Troubleshooting

### Common Issues

1. **MCP Server Not Running**
   ```bash
   # Check if server is running
   curl http://localhost:3000/
   
   # Start the server
   npm start
   ```

2. **API Key Issues**
   - Verify your TomTom API key is correct
   - Check if the key has the required permissions
   - Ensure the key is set in environment variables

3. **Port Conflicts**
   ```bash
   # Use different port
   PORT=5001 python app.py
   ```

4. **Dependencies Issues**
   ```bash
   # Reinstall dependencies
   pip install -r requirements.txt
   npm install
   ```

## 📚 Documentation

- [Railway Deployment Guide](RAILWAY_DEPLOYMENT.md)
- [GitHub Setup Instructions](GITHUB_SETUP.md)
- [TomTom API Documentation](https://developer.tomtom.com/)
- [Flask Documentation](https://flask.palletsprojects.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [TomTom](https://www.tomtom.com/) for the Maps API
- [Railway](https://railway.app/) for the deployment platform
- [Flask](https://flask.palletsprojects.com/) for the web framework

## 📞 Support

- Create an issue on GitHub
- Check the troubleshooting section
- Review the documentation
- Test with the provided test suites
