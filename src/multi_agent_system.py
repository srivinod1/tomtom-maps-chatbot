#!/usr/bin/env python3
"""
Multi-Agent System with Google ADK
This module implements a hierarchical multi-agent system for handling complex queries
"""

import os
import sys
import json
import asyncio
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import logging
from dataclasses import dataclass
from enum import Enum

# Add the src directory to the path
sys.path.append(os.path.dirname(__file__))

from tools import create_tomtom_mcp_toolset
from adk import Agent, MCPToolset

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentType(Enum):
    """Types of agents in the system"""
    ORCHESTRATOR = "orchestrator"
    MAPS = "maps"
    GENERAL_AI = "general_ai"
    CONTEXT_MANAGER = "context_manager"
    SEARCH = "search"
    KNOWLEDGE_BASE = "knowledge_base"
    USER_PROFILE = "user_profile"

@dataclass
class AgentMessage:
    """Message structure for agent communication"""
    sender: str
    recipient: str
    message_type: str
    content: Dict[str, Any]
    timestamp: str
    conversation_id: str

@dataclass
class AgentResponse:
    """Response structure from agents"""
    agent_id: str
    success: bool
    result: Any
    confidence: float
    metadata: Dict[str, Any]
    timestamp: str

class BaseAgent:
    """Base class for all agents in the system"""
    
    def __init__(self, agent_id: str, agent_type: AgentType, description: str):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.description = description
        self.conversation_history = []
        self.capabilities = []
        self.toolsets = []
        
    def add_toolset(self, toolset: MCPToolset):
        """Add a toolset to the agent"""
        self.toolsets.append(toolset)
        
    def process_message(self, message: AgentMessage) -> AgentResponse:
        """Process a message and return a response"""
        raise NotImplementedError("Subclasses must implement process_message")
        
    def get_capabilities(self) -> List[str]:
        """Get list of agent capabilities"""
        return self.capabilities
        
    def can_handle(self, query: str) -> float:
        """Return confidence score for handling a query (0-1)"""
        raise NotImplementedError("Subclasses must implement can_handle")

class MapsAgent(BaseAgent):
    """Specialized agent for TomTom Maps operations"""
    
    def __init__(self):
        super().__init__(
            agent_id="maps_agent",
            agent_type=AgentType.MAPS,
            description="Handles all location-based queries using TomTom Maps"
        )
        self.capabilities = [
            "location_search",
            "geocoding",
            "reverse_geocoding", 
            "routing",
            "static_maps",
            "matrix_routing"
        ]
        
        # Initialize TomTom MCP toolset
        try:
            tomtom_toolset = create_tomtom_mcp_toolset()
            self.add_toolset(tomtom_toolset)
            logger.info("✅ Maps Agent initialized with TomTom MCP tools")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Maps Agent: {e}")
    
    def can_handle(self, query: str) -> float:
        """Determine if this agent can handle the query"""
        location_keywords = [
            'where', 'location', 'address', 'place', 'find', 'search', 'near', 'nearby',
            'directions', 'route', 'how to get', 'distance', 'map', 'coordinates',
            'geocode', 'reverse geocode', 'latitude', 'longitude', 'lat', 'lon',
            'restaurant', 'hotel', 'gas station', 'coffee', 'shopping', 'hospital'
        ]
        
        query_lower = query.lower()
        matches = sum(1 for keyword in location_keywords if keyword in query_lower)
        return min(matches / 3, 1.0)  # Normalize to 0-1
    
    def process_message(self, message: AgentMessage) -> AgentResponse:
        """Process location-based queries"""
        try:
            query = message.content.get('query', '')
            
            # Route to appropriate TomTom MCP method
            if self._is_search_query(query):
                result = self._handle_search(query, message.content)
            elif self._is_directions_query(query):
                result = self._handle_directions(query, message.content)
            elif self._is_geocoding_query(query):
                result = self._handle_geocoding(query, message.content)
            elif self._is_reverse_geocoding_query(query):
                result = self._handle_reverse_geocoding(query, message.content)
            else:
                result = {"error": "Unsupported location query type"}
            
            return AgentResponse(
                agent_id=self.agent_id,
                success="error" not in result,
                result=result,
                confidence=0.9 if "error" not in result else 0.1,
                metadata={"query_type": "location", "tools_used": "tomtom_mcp"},
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            logger.error(f"Maps Agent error: {e}")
            return AgentResponse(
                agent_id=self.agent_id,
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                metadata={"error": str(e)},
                timestamp=datetime.now().isoformat()
            )
    
    def _is_search_query(self, query: str) -> bool:
        """Check if query is a search query"""
        search_keywords = ['find', 'search', 'look for', 'show me', 'where is', 'what is near']
        return any(keyword in query.lower() for keyword in search_keywords)
    
    def _is_directions_query(self, query: str) -> bool:
        """Check if query is a directions query"""
        directions_keywords = ['directions', 'route', 'how to get', 'navigate', 'drive to', 'walk to']
        return any(keyword in query.lower() for keyword in directions_keywords)
    
    def _is_geocoding_query(self, query: str) -> bool:
        """Check if query is a geocoding query"""
        geocoding_keywords = ['coordinates', 'geocode', 'latitude', 'longitude']
        return any(keyword in query.lower() for keyword in geocoding_keywords)
    
    def _is_reverse_geocoding_query(self, query: str) -> bool:
        """Check if query is a reverse geocoding query"""
        reverse_keywords = ['address', 'reverse', 'what is at', 'what\'s at']
        return any(keyword in query.lower() for keyword in reverse_keywords)
    
    def _handle_search(self, query: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Handle search queries"""
        # Extract search parameters from content
        search_params = {
            "query": content.get('search_term', ''),
            "location": content.get('location', {}),
            "type": content.get('place_type', '')
        }
        
        # Call TomTom MCP search method
        # This would integrate with the actual MCP server
        return {"places": [], "message": "Search functionality would be implemented here"}
    
    def _handle_directions(self, query: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Handle directions queries"""
        # Extract routing parameters
        route_params = {
            "origin": content.get('origin', {}),
            "destination": content.get('destination', {}),
            "travelMode": content.get('travel_mode', 'car')
        }
        
        return {"routes": [], "message": "Directions functionality would be implemented here"}
    
    def _handle_geocoding(self, query: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Handle geocoding queries"""
        address = content.get('address', '')
        return {"coordinates": {}, "message": f"Geocoding for {address} would be implemented here"}
    
    def _handle_reverse_geocoding(self, query: str, content: Dict[str, Any]) -> Dict[str, Any]:
        """Handle reverse geocoding queries"""
        location = content.get('location', {})
        return {"address": "", "message": f"Reverse geocoding for {location} would be implemented here"}

class GeneralAIAgent(BaseAgent):
    """General AI agent for non-location queries"""
    
    def __init__(self):
        super().__init__(
            agent_id="general_ai_agent",
            agent_type=AgentType.GENERAL_AI,
            description="Handles general knowledge and conversational queries"
        )
        self.capabilities = [
            "general_knowledge",
            "conversation",
            "weather_info",
            "time_queries",
            "help_queries"
        ]
    
    def can_handle(self, query: str) -> float:
        """Determine if this agent can handle the query"""
        general_keywords = [
            'hello', 'hi', 'help', 'what can you do', 'weather', 'time',
            'how are you', 'thank you', 'goodbye', 'explain', 'tell me about'
        ]
        
        query_lower = query.lower()
        matches = sum(1 for keyword in general_keywords if keyword in query_lower)
        return min(matches / 2, 1.0)
    
    def process_message(self, message: AgentMessage) -> AgentResponse:
        """Process general queries"""
        try:
            query = message.content.get('query', '')
            
            if 'hello' in query.lower() or 'hi' in query.lower():
                result = {"response": "Hello! I'm your multi-agent assistant. How can I help you today?"}
            elif 'help' in query.lower():
                result = {"response": "I can help you with location searches, directions, geocoding, and general questions. What would you like to know?"}
            elif 'weather' in query.lower():
                result = {"response": "I don't have access to real-time weather data, but I can help you find weather services or plan your travel based on locations."}
            elif 'time' in query.lower():
                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                result = {"response": f"The current time is {current_time}."}
            else:
                result = {"response": "I'm here to help! I can assist with location-based queries using TomTom Maps or answer general questions. What would you like to know?"}
            
            return AgentResponse(
                agent_id=self.agent_id,
                success=True,
                result=result,
                confidence=0.8,
                metadata={"query_type": "general", "response_type": "conversational"},
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            logger.error(f"General AI Agent error: {e}")
            return AgentResponse(
                agent_id=self.agent_id,
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                metadata={"error": str(e)},
                timestamp=datetime.now().isoformat()
            )

class ContextManagerAgent(BaseAgent):
    """Agent for managing user context and conversation history"""
    
    def __init__(self):
        super().__init__(
            agent_id="context_manager_agent",
            agent_type=AgentType.CONTEXT_MANAGER,
            description="Manages user context, preferences, and conversation history"
        )
        self.capabilities = [
            "context_management",
            "user_preferences",
            "conversation_history",
            "session_management"
        ]
        self.user_contexts = {}
        self.conversation_histories = {}
    
    def can_handle(self, query: str) -> float:
        """Context manager can handle context-related queries"""
        context_keywords = ['remember', 'forget', 'my location', 'preferences', 'history']
        query_lower = query.lower()
        matches = sum(1 for keyword in context_keywords if keyword in query_lower)
        return min(matches / 2, 1.0)
    
    def process_message(self, message: AgentMessage) -> AgentResponse:
        """Process context management queries"""
        try:
            query = message.content.get('query', '')
            user_id = message.content.get('user_id', 'default')
            
            if 'remember' in query.lower():
                # Store user context
                context_data = message.content.get('context', {})
                self.user_contexts[user_id] = context_data
                result = {"response": "I've saved your information. I'll remember it for our conversation."}
            elif 'my location' in query.lower():
                # Retrieve user location
                user_context = self.user_contexts.get(user_id, {})
                location = user_context.get('current_location', {})
                if location:
                    result = {"response": f"Your current location is {location}"}
                else:
                    result = {"response": "I don't have your current location. Please share it with me."}
            else:
                result = {"response": "I can help manage your context and preferences. What would you like me to remember?"}
            
            return AgentResponse(
                agent_id=self.agent_id,
                success=True,
                result=result,
                confidence=0.9,
                metadata={"query_type": "context", "user_id": user_id},
                timestamp=datetime.now().isoformat()
            )
            
        except Exception as e:
            logger.error(f"Context Manager Agent error: {e}")
            return AgentResponse(
                agent_id=self.agent_id,
                success=False,
                result={"error": str(e)},
                confidence=0.0,
                metadata={"error": str(e)},
                timestamp=datetime.now().isoformat()
            )

class MultiAgentOrchestrator:
    """Main orchestrator for the multi-agent system"""
    
    def __init__(self):
        self.agents = {}
        self.conversation_id = None
        self._initialize_agents()
    
    def _initialize_agents(self):
        """Initialize all agents in the system"""
        try:
            # Create specialized agents
            self.agents[AgentType.MAPS] = MapsAgent()
            self.agents[AgentType.GENERAL_AI] = GeneralAIAgent()
            self.agents[AgentType.CONTEXT_MANAGER] = ContextManagerAgent()
            
            logger.info("✅ Multi-agent system initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize multi-agent system: {e}")
            raise
    
    def process_query(self, query: str, user_id: str = "default") -> Dict[str, Any]:
        """Process a user query using the multi-agent system"""
        try:
            # Generate conversation ID
            self.conversation_id = f"{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            
            # Create message for agents
            message = AgentMessage(
                sender="user",
                recipient="orchestrator",
                message_type="query",
                content={"query": query, "user_id": user_id},
                timestamp=datetime.now().isoformat(),
                conversation_id=self.conversation_id
            )
            
            # Determine which agent(s) can handle the query
            agent_scores = {}
            for agent_type, agent in self.agents.items():
                score = agent.can_handle(query)
                if score > 0.1:  # Only consider agents with reasonable confidence
                    agent_scores[agent_type] = score
            
            if not agent_scores:
                # No agent can handle the query well
                return {
                    "success": False,
                    "response": "I'm not sure how to help with that query. Could you rephrase it?",
                    "query_type": "unknown",
                    "timestamp": datetime.now().isoformat()
                }
            
            # Select the best agent(s)
            best_agent_type = max(agent_scores, key=agent_scores.get)
            best_agent = self.agents[best_agent_type]
            
            # Process the query
            response = best_agent.process_message(message)
            
            # Format the response
            return {
                "success": response.success,
                "response": response.result.get("response", str(response.result)),
                "query_type": response.metadata.get("query_type", "unknown"),
                "agent_used": response.agent_id,
                "confidence": response.confidence,
                "timestamp": response.timestamp,
                "conversation_id": self.conversation_id
            }
            
        except Exception as e:
            logger.error(f"Orchestrator error: {e}")
            return {
                "success": False,
                "response": f"Sorry, I encountered an error: {str(e)}",
                "query_type": "error",
                "timestamp": datetime.now().isoformat()
            }
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get status of all agents in the system"""
        status = {
            "total_agents": len(self.agents),
            "agents": {}
        }
        
        for agent_type, agent in self.agents.items():
            status["agents"][agent_type.value] = {
                "id": agent.agent_id,
                "type": agent.agent_type.value,
                "description": agent.description,
                "capabilities": agent.capabilities,
                "toolsets_count": len(agent.toolsets)
            }
        
        return status

# Example usage
if __name__ == "__main__":
    # Initialize the multi-agent system
    orchestrator = MultiAgentOrchestrator()
    
    # Test queries
    test_queries = [
        "Hello! What can you do?",
        "Find coffee shops near 47.6062, -122.3321",
        "How do I get from Seattle to Portland?",
        "What are the coordinates for 123 Main Street, Seattle?",
        "What's the weather like today?",
        "Remember my location is 47.6062, -122.3321"
    ]
    
    print("🤖 Multi-Agent System with Google ADK")
    print("=" * 50)
    
    for query in test_queries:
        print(f"\n👤 User: {query}")
        result = orchestrator.process_query(query)
        print(f"🤖 System: {result['response']}")
        print(f"📊 Agent: {result.get('agent_used', 'unknown')}")
        print(f"🎯 Type: {result['query_type']}")
        print(f"📈 Confidence: {result.get('confidence', 0):.2f}")
        print("-" * 50)
    
    # Show system status
    print("\n🔧 System Status:")
    status = orchestrator.get_system_status()
    print(json.dumps(status, indent=2))
