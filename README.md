# TomTom MCP Multi-Agent System

A sophisticated multi-agent system that integrates Google ADK (Agent Development Kit), TomTom Maps APIs, and Model Context Protocol (MCP) to provide intelligent location-based services.

## 🏗️ Architecture

This project implements a clean, scalable multi-agent architecture with:

- **Unified Server**: Single Railway deployment with multiple agent capabilities
- **A2A Protocol**: Standardized Agent-to-Agent communication
- **MCP Integration**: TomTom APIs accessed through Model Context Protocol
- **Enhanced Multi-Agent System**: Planner, Researcher, Writer, Reviewer, Supervisor agents
- **Comprehensive Observability**: Google Cloud Logging, Monitoring, and Trace

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+
- TomTom API key
- OpenAI/Anthropic API keys (optional)
- Google Cloud Project (for observability)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ADK-Agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   pip install -r requirements.txt
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your API keys
   ```

4. **Start the services**
   ```bash
   # Terminal 1: Start MCP Tool Server
   npm run mcp-tools
   
   # Terminal 2: Start Unified Server
   npm start
   
   # Terminal 3: Start Enhanced Orchestrator (optional)
   npm run enhanced
   ```

### Testing

```bash
# Test the complete system
npm run test-adk

# Test enhanced multi-agent system
npm run test-enhanced
```

## 📡 API Endpoints

### Unified Server (Port 3000)
- `POST /` - JSON-RPC endpoint for chat
- `GET /health` - Health check
- `GET /analytics` - System analytics
- `POST /a2a` - A2A protocol endpoint

### MCP Tool Server (Port 3003)
- `GET /manifest` - Tool manifest
- `GET /tools` - Available tools
- `POST /tools/:toolName` - Execute tool
- `GET /health` - Health check

## 🤖 Agents

### Orchestrator Agent
- Central coordination and request routing
- LLM integration for intent understanding
- Conversation history and context management

### Enhanced Multi-Agent System
- **Planner Agent**: Decomposes requests into steps
- **Researcher Agent**: Gathers evidence via MCP tools
- **Writer Agent**: Synthesizes user-facing responses
- **Reviewer Agent**: Quality control and validation
- **Supervisor Agent**: Budget enforcement and risk management

### Maps Agent
- Location-based query processing
- TomTom API integration via MCP
- Geocoding, search, routing, static maps

## 🛠️ MCP Tools

Available TomTom MCP tools:
- `mcp://tomtom/search` - Place search
- `mcp://tomtom/geocode` - Address geocoding
- `mcp://tomtom/reverse-geocode` - Coordinate lookup
- `mcp://tomtom/directions` - Route calculation
- `mcp://tomtom/static-map` - Map image generation

## 📊 Observability

The system includes comprehensive observability with:
- Google Cloud Logging for detailed logs
- Google Cloud Monitoring for metrics
- Google Cloud Trace for request tracing
- Analytics endpoint for system insights

## 🚀 Deployment

### Railway Deployment

1. **Set up Railway project**
   ```bash
   railway login
   railway init
   ```

2. **Configure environment variables**
   - `TOMTOM_API_KEY`
   - `OPENAI_API_KEY` (optional)
   - `ANTHROPIC_API_KEY` (optional)
   - `GEMINI_API_KEY` (optional)
   - `GOOGLE_CLOUD_PROJECT`
   - `GOOGLE_APPLICATION_CREDENTIALS`

3. **Deploy**
   ```bash
   railway up
   ```

### Environment Variables

See `env.example` for all required environment variables.

## 📁 Project Structure

```
ADK-Agent/
├── src/
│   ├── unified-server.js              # Main unified server
│   ├── enhanced-orchestrator.js       # Enhanced multi-agent orchestrator
│   ├── mcp-tool-server.js            # MCP tool server
│   ├── mcp-client.js                 # MCP client library
│   ├── a2a-protocol.js               # A2A protocol implementation
│   ├── comprehensive-observability.js # Observability system
│   └── enhanced-agents/              # Enhanced agent implementations
├── test_adk_a2a_mcp.py               # Main test script
├── test_enhanced_architecture.py     # Enhanced architecture tests
├── railway.json                      # Railway deployment config
├── package.json                      # Node.js dependencies
├── requirements.txt                  # Python dependencies
└── ARCHITECTURE.md                   # Detailed architecture documentation
```

## 🔧 Development

### Scripts

- `npm start` - Start unified server
- `npm run dev` - Start with nodemon
- `npm run enhanced` - Start enhanced orchestrator
- `npm run mcp-tools` - Start MCP tool server
- `npm run test-adk` - Run main tests
- `npm run test-enhanced` - Run enhanced tests

### Adding New Agents

1. Create agent file in `src/enhanced-agents/`
2. Implement A2A protocol methods
3. Register agent in orchestrator
4. Add tests

### Adding New MCP Tools

1. Define tool in `src/mcp-tool-server.js`
2. Implement tool execution logic
3. Update MCP client if needed
4. Add tests

## 📚 Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - Detailed architecture documentation
- [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) - Deployment guide
- [POSTMAN_TESTS.md](POSTMAN_TESTS.md) - API testing guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the [ARCHITECTURE.md](ARCHITECTURE.md) documentation
2. Review existing issues
3. Create a new issue with detailed information

---

Built with ❤️ using Google ADK, TomTom Maps, and Model Context Protocol.