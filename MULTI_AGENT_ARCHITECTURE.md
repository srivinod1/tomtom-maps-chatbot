# Multi-Agent System Architecture with Google ADK

This document describes the enhanced multi-agent system architecture that combines Google ADK with TomTom MCP tools and LLM integration.

## 🏗️ System Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Main Orchestrator          │
                    │    (Enhanced Multi-Agent System)   │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────┼───────────────────┐
                    │                 │                   │
            ┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
            │  Maps Agent  │  │ General AI   │  │  Context     │
            │  (TomTom)    │  │   Agent      │  │  Manager     │
            │              │  │  (LLM)       │  │              │
            └──────────────┘  └──────────────┘  └──────────────┘
                    │                 │                   │
            ┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
            │  Search      │  │  Knowledge   │  │  User        │
            │  Sub-Agent   │  │  Base        │  │  Profile     │
            │              │  │  Sub-Agent   │  │  Sub-Agent   │
            └──────────────┘  └──────────────┘  └──────────────┘
```

## 🤖 Agent Types

### 1. Main Orchestrator
- **Role**: Coordinates all agents and routes queries
- **Responsibilities**:
  - Query analysis and intent extraction
  - Agent selection and delegation
  - Response aggregation and enhancement
  - Conversation management

### 2. Maps Agent (TomTom)
- **Role**: Handles all location-based queries
- **Capabilities**:
  - Location search using TomTom Orbis Search API
  - Geocoding and reverse geocoding
  - Route calculation and directions
  - Static map generation
  - Matrix routing for multiple destinations
- **Tools**: TomTom MCP Server integration

### 3. General AI Agent (LLM)
- **Role**: Handles general knowledge and conversational queries
- **Capabilities**:
  - Natural language understanding
  - General knowledge responses
  - Intent extraction and entity recognition
  - Response enhancement and naturalization
- **Tools**: OpenAI GPT or Anthropic Claude

### 4. Context Manager Agent
- **Role**: Manages user context and conversation history
- **Capabilities**:
  - User preference storage
  - Location memory
  - Conversation history management
  - Session state maintenance

## 🔄 Query Processing Flow

1. **Query Reception**: User query received via API
2. **Intent Extraction**: LLM analyzes query and extracts intent
3. **Agent Selection**: Orchestrator selects best agent(s) based on confidence scores
4. **Query Processing**: Selected agent processes the query using appropriate tools
5. **Response Enhancement**: LLM enhances the response for naturalness
6. **Response Delivery**: Final response returned to user

## 🛠️ Technical Implementation

### Core Components

#### 1. Multi-Agent System (`src/multi_agent_system.py`)
```python
class MultiAgentOrchestrator:
    def __init__(self):
        self.agents = {}
        self._initialize_agents()
    
    def process_query(self, query: str, user_id: str) -> Dict[str, Any]:
        # Route query to appropriate agent
        # Aggregate and enhance response
```

#### 2. LLM Integration (`src/llm_agent.py`)
```python
class LLMAgent:
    def __init__(self, provider: str = "openai"):
        self.llm = OpenAIProvider(api_key)
    
    def process_query(self, query: str) -> Dict[str, Any]:
        # Extract intent and generate response
```

#### 3. Enhanced Orchestrator (`src/enhanced_multi_agent.py`)
```python
class EnhancedMultiAgentOrchestrator:
    def __init__(self, llm_provider: str = "openai"):
        super().__init__()
        self.llm_agent = LLMAgent(provider=llm_provider)
    
    def process_query(self, query: str, use_llm: bool = True):
        # LLM-enhanced query processing
```

### API Endpoints

#### Enhanced Flask API (`src/enhanced_app.py`)
- `POST /api/chat` - Main chat endpoint with multi-agent processing
- `GET /api/capabilities` - System capabilities and status
- `GET /api/agents` - Information about all agents
- `POST /api/context` - Set user context
- `GET /api/context/<user_id>` - Get user context
- `GET /api/chat/history` - Conversation history
- `POST /api/test` - System validation endpoint

## 🚀 Deployment Architecture

### Local Development
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   TomTom MCP    │    │  Enhanced API   │    │   Frontend      │
│   Server        │    │   Server        │    │   Application   │
│   (Port 3000)   │    │   (Port 5000)   │    │   (Port 3001)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   LLM Provider  │
                    │  (OpenAI/Claude)│
                    └─────────────────┘
```

### Railway Deployment
```
┌─────────────────┐    ┌─────────────────┐
│   TomTom MCP    │    │  Enhanced API   │
│   Service       │    │   Service       │
│   (Railway)     │    │   (Railway)     │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────────────────┼───────────────────────┐
                                 │                       │
                    ┌─────────────────┐    ┌─────────────────┐
                    │   LLM Provider  │    │   Frontend      │
                    │  (OpenAI/Claude)│    │   (External)    │
                    └─────────────────┘    └─────────────────┘
```

## 🔧 Configuration

### Environment Variables
```bash
# TomTom API
TOMTOM_API_KEY=your_tomtom_api_key

# LLM Provider (choose one)
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# LLM Configuration
LLM_PROVIDER=openai  # or anthropic

# Server Configuration
MCP_SERVER_URL=http://localhost:3000
PORT=5000
FLASK_ENV=production
```

### Dependencies
```txt
# Core ADK
adk>=0.0.1
python-dotenv>=1.0.0

# Flask API
flask>=2.3.0
flask-cors>=4.0.0
gunicorn>=21.2.0

# LLM Integration
openai>=1.0.0
anthropic>=0.7.0

# Multi-agent System
asyncio-mqtt>=0.11.0
pydantic>=2.0.0
```

## 🧪 Testing

### Test Suite (`test_enhanced_system.py`)
```bash
# Run comprehensive test suite
python test_enhanced_system.py
```

### Manual Testing
```bash
# Start MCP server
npm start

# Start enhanced API server
python src/enhanced_app.py

# Test with curl
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Find coffee shops near me", "user_id": "test_user"}'
```

## 📊 Performance Metrics

### Agent Confidence Scores
- **Maps Agent**: 0.9 for location queries
- **General AI Agent**: 0.8 for conversational queries
- **Context Manager**: 0.9 for context-related queries

### Response Times
- **MCP Queries**: ~200-500ms
- **LLM Queries**: ~1-3s
- **Enhanced Responses**: ~1.5-4s

## 🔮 Future Enhancements

### Planned Features
1. **Parallel Agent Processing**: Run multiple agents simultaneously
2. **Agent Learning**: Improve agent selection based on user feedback
3. **Custom Agent Creation**: Allow users to create specialized agents
4. **Agent Communication**: Direct agent-to-agent communication
5. **Advanced Context**: Multi-modal context (images, voice, etc.)

### Scalability Considerations
1. **Agent Pooling**: Multiple instances of each agent type
2. **Load Balancing**: Distribute queries across agent instances
3. **Caching**: Cache frequent queries and responses
4. **Monitoring**: Real-time agent performance monitoring

## 🛡️ Security & Privacy

### Data Protection
- User context encrypted at rest
- API keys stored securely
- Conversation history with retention policies
- GDPR compliance for user data

### Access Control
- API authentication and authorization
- Rate limiting per user
- Agent access controls
- Audit logging for all operations

## 📚 Usage Examples

### Basic Chat
```python
from src.enhanced_multi_agent import MultiAgentChatbot

chatbot = MultiAgentChatbot(llm_provider="openai")
result = chatbot.chat("Find coffee shops near 47.6062, -122.3321")
print(result["response"])
```

### API Integration
```javascript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: "How do I get to the airport?",
    user_id: "user123",
    use_llm: true
  })
});

const data = await response.json();
console.log(data.response);
```

### Context Management
```python
# Set user context
chatbot.set_user_context("user123", {
  "current_location": {"lat": 47.6062, "lon": -122.3321},
  "preferences": {"travel_mode": "car"}
})

# Query with context
result = chatbot.chat("Find restaurants near me", "user123")
```

This multi-agent architecture provides a robust, scalable foundation for building intelligent applications that can handle complex queries through specialized agents working together.
