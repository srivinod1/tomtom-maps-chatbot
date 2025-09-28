# TomTom MCP Multi-Agent Architecture

## Overview

This project implements a sophisticated multi-agent system that integrates Google ADK (Agent Development Kit), TomTom Maps APIs, and Model Context Protocol (MCP) to provide intelligent location-based services. The architecture follows Google's best practices for multi-agent systems with clean separation of concerns, A2A (Agent-to-Agent) communication, and comprehensive observability.

**Current Status**: ✅ **V1.0 PRODUCTION READY** - 100% success rate on comprehensive test suite with enhanced context management, conversational intelligence, and advanced pronoun resolution. All core functionalities working including directions, matrix routing, geocoding, search, and reverse geocoding with live traffic data.

## V1.0 Key Features

### 🧠 Enhanced Context Management
- **Conversational Memory**: Maintains context across multiple conversation turns
- **Pronoun Resolution**: Intelligently resolves "they", "them", "the same" references
- **Search Type Tracking**: Remembers last search type (restaurants, coffee shops, etc.)
- **Geographic Intelligence**: Smart city recognition (Paris Central → Paris, France)

### 🎯 Advanced Intent Classification
- **Statistical vs Location Queries**: Properly routes "how many restaurants" to General AI
- **Context-Aware Routing**: Uses conversation history for better intent understanding
- **Geographic Bias System**: Accurate city coordinate mapping for international searches

### 🔧 Technical Improvements
- **Enhanced LLM Prompts**: Better conversational reference understanding
- **Comprehensive Context Storage**: lastSearchType, lastSearchResults, lastSearchPlaceNames
- **Improved Error Handling**: Better fallback mechanisms and user feedback
- **100% Test Success Rate**: All 10 comprehensive test scenarios passing

## Architecture Principles

### Core Design Principles
1. **Single Responsibility**: Each agent has a clear, focused purpose
2. **A2A Protocol**: All inter-agent communication uses standardized A2A protocol
3. **MCP Integration**: TomTom APIs are accessed exclusively through MCP tools
4. **Observability First**: Comprehensive logging, monitoring, and tracing
5. **Railway Deployment**: Single service deployment with multiple agent capabilities
6. **Clean Architecture**: Clear separation between protocols, agents, and tools

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Web Client    │  │  Mobile App     │  │   API Client    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ JSON-RPC
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Unified Server (Railway)                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Orchestrator Agent                          │ │
│  │  • Request routing and context management                  │ │
│  │  • LLM integration for intent understanding               │ │
│  │  • Conversation history and memory                        │ │
│  │  • A2A protocol coordination                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                │                                │
│                                │ A2A Protocol                   │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Enhanced Multi-Agent System                 │ │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │ │
│  │  │   Planner   │ │ Researcher  │ │   Writer    │          │ │
│  │  │   Agent     │ │   Agent     │ │   Agent     │          │ │
│  │  └─────────────┘ └─────────────┘ └─────────────┘          │ │
│  │  ┌─────────────┐ ┌─────────────┐                          │ │
│  │  │  Reviewer   │ │ Supervisor  │                          │ │
│  │  │   Agent     │ │   Agent     │                          │ │
│  │  └─────────────┘ └─────────────┘                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                │                                │
│                                │ A2A Protocol                   │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                 Maps Agent                                 │ │
│  │  • Location-based query processing                        │ │
│  │  • TomTom API integration via MCP                        │ │
│  │  • Geocoding, search, routing, static maps               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ MCP Protocol
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Tool Server                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              TomTom Maps API Tools                         │ │
│  │  • mcp://tomtom/search - Place search                     │ │
│  │  • mcp://tomtom/geocode - Address geocoding               │ │
│  │  • mcp://tomtom/reverse-geocode - Coordinate lookup       │ │
│  │  • mcp://tomtom/directions - Route calculation            │ │
│  │  • mcp://tomtom/static-map - Map image generation         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP API
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TomTom Maps API                             │
│  • Orbis Search API                                           │
│  • Geocoding API                                              │
│  • Routing API                                                │
│  • Static Maps API                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Agent Architecture

### 1. Orchestrator Agent
**Purpose**: Central coordination and request routing
**Protocols**: JSON-RPC (external), A2A (internal)
**Responsibilities**:
- Receive user requests via JSON-RPC
- Extract context and intent using LLM
- Route requests to appropriate specialized agents
- Manage conversation history and user context
- Coordinate multi-agent workflows

**Key Methods**:
- `orchestrator.chat` - Main chat interface
- `orchestrator.capabilities` - System capabilities
- Context extraction and memory management

### 2. Enhanced Multi-Agent System

#### Planner Agent
**Purpose**: Decompose complex requests into executable steps
**A2A Messages**: `PLAN_REQUEST`
**Responsibilities**:
- Analyze user requests
- Create step-by-step execution plans
- Assign tasks to appropriate agents
- Define expected outputs and context

#### Researcher Agent
**Purpose**: Gather evidence using MCP tools
**A2A Messages**: `GATHER_EVIDENCE`
**Responsibilities**:
- Call MCP tools for data gathering
- Process TomTom API responses
- Provide structured evidence to other agents
- Handle tool selection and parameter mapping

#### Writer Agent
**Purpose**: Synthesize user-facing responses
**A2A Messages**: `SYNTHESIZE_RESPONSE`
**Responsibilities**:
- Combine evidence into coherent responses
- Format output for user consumption
- Maintain consistent tone and style
- Handle different response types

#### Reviewer Agent
**Purpose**: Quality control and validation
**A2A Messages**: `REVIEW_RESPONSE`
**Responsibilities**:
- Validate response accuracy
- Check for completeness
- Ensure safety and appropriateness
- Provide revision suggestions

#### Supervisor Agent
**Purpose**: Budget enforcement and risk management
**A2A Messages**: `APPROVE_OPERATION`
**Responsibilities**:
- Approve/reject operations based on budgets
- Manage resource allocation
- Risk assessment and mitigation
- Escalation handling

### 3. Maps Agent
**Purpose**: Location-based query processing
**Protocols**: A2A (internal), MCP (external)
**Responsibilities**:
- Process location-based requests
- Coordinate with MCP Tool Server
- Handle geocoding, search, routing, matrix routing
- Provide location context to other agents
- Sequential tool calling for complex operations

**Key Capabilities**:
- ✅ **Geocoding**: Convert addresses/POIs to coordinates using TomTom Fuzzy Search API
- ✅ **Search**: Find nearby places using TomTom Search API
- ✅ **Directions**: Calculate routes using TomTom Orbis Maps API with live traffic
- ✅ **Matrix Routing**: Calculate travel time matrices using TomTom Matrix Routing v2 API
- ✅ **Reverse Geocoding**: Convert coordinates to addresses
- ✅ **Static Maps**: Generate map images (pending implementation)

## A2A Protocol

### Message Structure
```json
{
  "envelope": {
    "a2a_version": "1.0",
    "task_id": "task-1234567890-abc123",
    "trace_id": "trace-1234567890-xyz789",
    "from": "orchestrator-agent",
    "to": "planner-agent",
    "topic": "planning",
    "intent": "PLAN_REQUEST",
    "budget": {
      "tokens": 2000,
      "tool_calls": 3,
      "deadline_ms": 15000
    },
    "ts": "2024-01-15T10:30:00.000Z"
  },
  "payload": {
    "instructions": "Create execution plan for user request",
    "context_refs": ["user_context_123"],
    "needs_tooling": true,
    "expected_output_schema": {
      "plan": "array of step objects"
    },
    "user_request": "Find coffee shops near Central Park",
    "context": {...}
  }
}
```

### Message Types
- `PLAN_REQUEST` - Request execution plan
- `GATHER_EVIDENCE` - Request data gathering
- `SYNTHESIZE_RESPONSE` - Request response synthesis
- `REVIEW_RESPONSE` - Request response review
- `APPROVE_OPERATION` - Request operation approval

## MCP Tool Integration

### Available Tools
1. **mcp://tomtom/search** - Search for places ✅ Working
2. **mcp://tomtom/geocode** - Convert address to coordinates ✅ Working
3. **mcp://tomtom/reverse-geocode** - Convert coordinates to address ✅ Working
4. **mcp://tomtom/directions** - Calculate routes ✅ Working
5. **mcp://tomtom/static-map** - Generate map images ⏳ Pending

### API Integration Status
- **TomTom Fuzzy Search API**: ✅ Fully integrated for geocoding
- **TomTom Search API**: ✅ Fully integrated for place search
- **TomTom Orbis Maps API**: ✅ Fully integrated for directions with live traffic
- **TomTom Matrix Routing v2 API**: ✅ Fully integrated for travel time matrices
- **TomTom Reverse Geocoding API**: ✅ Fully integrated
- **TomTom Static Maps API**: ⏳ Pending implementation

### Tool Server Architecture
- **Port**: 3000 (integrated with main server for Railway deployment)
- **Endpoints**: `/tools`, `/tools/:toolName/execute`
- **Protocol**: HTTP REST
- **Authentication**: TomTom API key
- **Integration**: MCP Tool Server is integrated into the unified server for Railway deployment

## Observability

### Comprehensive Observability System
**Location**: `src/comprehensive-observability.js`
**Integration**: Google Cloud Logging, Monitoring, Trace

#### Observed Components
- Orchestrator Agent operations
- Maps Agent operations
- A2A Protocol communication
- MCP Tool calls
- LLM API calls
- TomTom API calls
- System events and errors

#### Metrics Collected
- Request/response times
- Success/error rates
- Token usage
- Tool call frequency
- Agent interaction patterns
- Performance bottlenecks

#### Analytics Endpoint
- **URL**: `/analytics`
- **Data**: Aggregated metrics and performance data
- **Format**: JSON with comprehensive statistics

## Deployment

### Railway Configuration
**File**: `railway.json`
**Service**: Single unified service with integrated MCP Tool Server
**Ports**: 3000 (main + MCP tools integrated)
**Deployment**: Railway only exposes one port, so MCP Tool Server is integrated into the main server

### Environment Variables
```bash
# TomTom API
TOMTOM_API_KEY=your_tomtom_api_key

# LLM APIs
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key

# Google Cloud Observability
GOOGLE_CLOUD_PROJECT=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=service_account_json

# Server Configuration
NODE_ENV=production
MCP_TOOL_SERVER_URL=http://localhost:3000
```

### Health Checks
- **Main Service**: `GET /`
- **MCP Tools**: `GET /tools` (integrated)
- **Analytics**: `GET /analytics`

## Testing

### Test Scripts
1. **test_adk_a2a_mcp.py** - Comprehensive system testing
2. **test_enhanced_architecture.py** - Enhanced multi-agent testing

### Test Coverage
- ✅ Health checks
- ✅ A2A protocol communication
- ✅ MCP tool integration
- ✅ Location-based queries (geocoding, search, directions, matrix routing)
- ✅ General chat functionality
- ✅ Error handling
- ✅ Performance metrics
- ✅ Sequential tool calling
- ✅ Live traffic integration
- ✅ Railway deployment testing

## Security & Governance

### API Key Management
- Environment variable storage
- Secure credential handling
- No hardcoded secrets

### Error Handling
- Graceful degradation
- Fallback mechanisms
- Comprehensive error logging
- User-friendly error messages

### Rate Limiting
- TomTom API rate limits
- LLM API rate limits
- Internal request throttling

## Development Workflow

### Local Development
```bash
# Start MCP Tool Server
npm run mcp-tools

# Start Unified Server
npm start

# Start Enhanced Orchestrator
npm run enhanced

# Run Tests
npm run test-adk
npm run test-enhanced
```

### Production Deployment
1. Set environment variables in Railway
2. Deploy using `railway.json` configuration
3. Monitor via Google Cloud Console
4. Check health endpoints

## File Structure

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
│       ├── planner-agent.js
│       ├── researcher-agent.js
│       ├── writer-agent.js
│       ├── reviewer-agent.js
│       └── supervisor-agent.js
├── test_adk_a2a_mcp.py               # Main test script
├── test_enhanced_architecture.py     # Enhanced architecture tests
├── railway.json                      # Railway deployment config
├── package.json                      # Node.js dependencies
├── requirements.txt                  # Python dependencies
└── ARCHITECTURE.md                   # This file
```

## Recent Improvements & Fixes

### December 2024 Updates
1. **MCP Client Integration Fix**: Fixed MCP client initialization issues that were causing connection failures
2. **Railway Deployment Optimization**: Integrated MCP Tool Server into the main server for Railway deployment compatibility
3. **Intent Classification Enhancement**: Improved LLM prompt for better classification of travel time queries
4. **Comprehensive Testing**: Implemented 10-scenario test suite with 90% success rate
5. **Environment Configuration**: Fixed `.env` file configuration for proper MCP Tool Server URL

### Current Test Results
- **Local Server**: 9/10 tests passing (90%)
- **Railway Server**: 9/10 tests passing (90%)
- **Working Features**: Place search, geocoding, reverse geocoding, directions, matrix routing
- **Known Issue**: International travel time queries (e.g., "travel time between Paris and Amsterdam") not being classified as directions

### Performance Improvements
- Reduced MCP client initialization time
- Improved error handling and fallback mechanisms
- Enhanced logging for better debugging
- Optimized Railway deployment configuration

## Future Enhancements

### Planned Features
1. **Agent Discovery**: Dynamic agent registration and discovery
2. **Load Balancing**: Distribute load across multiple agent instances
3. **Caching**: Intelligent caching for frequently requested data
4. **Analytics Dashboard**: Real-time monitoring and analytics UI
5. **Multi-language Support**: Support for multiple languages
6. **Custom Tools**: User-defined MCP tools
7. **Agent Marketplace**: Third-party agent integration

### Scalability Considerations
- Horizontal scaling of agent instances
- Database integration for persistent storage
- Message queue for high-volume processing
- CDN integration for static map caching
- Microservices architecture migration

---

This architecture provides a robust, scalable, and maintainable foundation for intelligent location-based services while following Google's best practices for multi-agent systems.