#!/usr/bin/env python3
"""
TomTom Maps Chatbot Agent
Combines TomTom MCP tools with general knowledge to answer user queries
"""

import os
import sys
import json
import requests
import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import logging

# Add the src directory to the path so we can import tools
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TomTomChatbotAgent:
    """Chatbot agent that combines TomTom MCP tools with general knowledge"""
    
    def __init__(self, mcp_server_url: str = "http://localhost:3000"):
        self.mcp_server_url = mcp_server_url
        self.conversation_history = []
        self.user_context = {}
        
        # TomTom MCP methods
        self.tomtom_methods = {
            'search': 'maps.search',
            'directions': 'maps.directions', 
            'geocode': 'maps.geocode',
            'reverse_geocode': 'maps.reverseGeocode',
            'static_map': 'maps.staticMap',
            'matrix': 'maps.matrix'
        }
        
        # Initialize MCP connection
        self._initialize_mcp()
    
    def _initialize_mcp(self):
        """Initialize connection to TomTom MCP server"""
        try:
            response = requests.post(self.mcp_server_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {}
            }, timeout=5)
            
            if response.status_code == 200:
                result = response.json()
                if "result" in result:
                    logger.info("✅ Connected to TomTom MCP server")
                    return True
            
            logger.error("❌ Failed to connect to TomTom MCP server")
            return False
            
        except Exception as e:
            logger.error(f"❌ Error connecting to MCP server: {e}")
            return False
    
    def _call_mcp_method(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Call a TomTom MCP method"""
        try:
            response = requests.post(self.mcp_server_url, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": method,
                "params": params
            }, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                if "result" in result:
                    return result["result"]
                elif "error" in result:
                    logger.error(f"MCP Error: {result['error']}")
                    return {"error": result["error"]["message"]}
            
            return {"error": "Failed to call MCP method"}
            
        except Exception as e:
            logger.error(f"Error calling MCP method {method}: {e}")
            return {"error": str(e)}
    
    def _extract_location_from_query(self, query: str) -> Optional[Dict[str, float]]:
        """Extract location coordinates from user query or context"""
        # Check if user has provided coordinates in context
        if 'current_location' in self.user_context:
            return self.user_context['current_location']
        
        # Look for coordinate patterns in the query
        coord_pattern = r'(-?\d+\.?\d*),\s*(-?\d+\.?\d*)'
        match = re.search(coord_pattern, query)
        if match:
            try:
                lat, lon = float(match.group(1)), float(match.group(2))
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    return {"lat": lat, "lon": lon}
            except ValueError:
                pass
        
        return None
    
    def _extract_address_from_query(self, query: str) -> Optional[str]:
        """Extract address from user query"""
        # Common address patterns
        address_patterns = [
            r'(?:at|near|in|to|from)\s+([A-Za-z\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl))',
            r'(?:at|near|in|to|from)\s+([A-Za-z\s,]+(?:,\s*[A-Z]{2})?)',
            r'([A-Za-z\s,]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl))',
        ]
        
        for pattern in address_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        return None
    
    def _is_location_query(self, query: str) -> bool:
        """Determine if the query is location-related"""
        location_keywords = [
            'where', 'location', 'address', 'place', 'find', 'search', 'near', 'nearby',
            'directions', 'route', 'how to get', 'distance', 'map', 'coordinates',
            'geocode', 'reverse geocode', 'latitude', 'longitude', 'lat', 'lon'
        ]
        
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in location_keywords)
    
    def _is_search_query(self, query: str) -> bool:
        """Determine if the query is a search query"""
        search_keywords = [
            'find', 'search', 'look for', 'show me', 'where is', 'what is near',
            'restaurant', 'hotel', 'gas station', 'coffee', 'shopping', 'hospital',
            'pharmacy', 'bank', 'atm', 'parking', 'park'
        ]
        
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in search_keywords)
    
    def _is_directions_query(self, query: str) -> bool:
        """Determine if the query is a directions query"""
        directions_keywords = [
            'directions', 'route', 'how to get', 'navigate', 'drive to', 'walk to',
            'from', 'to', 'between', 'distance', 'travel time', 'how long'
        ]
        
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in directions_keywords)
    
    def _handle_search_query(self, query: str) -> str:
        """Handle search-related queries"""
        # Extract search term
        search_terms = []
        common_places = ['restaurant', 'hotel', 'gas station', 'coffee', 'shopping', 'hospital', 'pharmacy', 'bank', 'atm', 'parking', 'park']
        
        query_lower = query.lower()
        for place in common_places:
            if place in query_lower:
                search_terms.append(place)
                break
        
        if not search_terms:
            # Extract general search terms
            words = query.split()
            search_terms = [word for word in words if len(word) > 3 and word.lower() not in ['find', 'search', 'show', 'me', 'where', 'is', 'near', 'nearby']]
            if search_terms:
                search_terms = [search_terms[0]]  # Take first meaningful word
        
        if not search_terms:
            return "I'd be happy to help you search for places! Could you tell me what you're looking for? (e.g., 'Find restaurants near me' or 'Search for coffee shops')"
        
        search_term = search_terms[0]
        location = self._extract_location_from_query(query)
        
        if not location:
            return f"I can help you find {search_term}, but I need a location. Please provide coordinates (lat, lon) or tell me where you are."
        
        # Call TomTom search
        result = self._call_mcp_method(self.tomtom_methods['search'], {
            "query": search_term,
            "location": location
        })
        
        if "error" in result:
            return f"Sorry, I couldn't search for {search_term} right now. {result['error']}"
        
        if "places" in result and result["places"]:
            places = result["places"][:5]  # Limit to 5 results
            response = f"I found {len(result['places'])} places for '{search_term}':\n\n"
            
            for i, place in enumerate(places, 1):
                response += f"{i}. **{place['name']}**\n"
                response += f"   📍 {place['formatted_address']}\n"
                if 'rating' in place:
                    response += f"   ⭐ {place['rating']}/5\n"
                response += "\n"
            
            return response
        else:
            return f"I couldn't find any {search_term} in that area. Try a different location or search term."
    
    def _handle_directions_query(self, query: str) -> str:
        """Handle directions-related queries"""
        # Extract origin and destination
        origin = None
        destination = None
        
        # Look for "from X to Y" pattern
        from_to_pattern = r'from\s+(.+?)\s+to\s+(.+)'
        match = re.search(from_to_pattern, query, re.IGNORECASE)
        if match:
            origin_text = match.group(1).strip()
            destination_text = match.group(2).strip()
            
            # Try to geocode both
            origin_result = self._call_mcp_method(self.tomtom_methods['geocode'], {"address": origin_text})
            destination_result = self._call_mcp_method(self.tomtom_methods['geocode'], {"address": destination_text})
            
            if "results" in origin_result and origin_result["results"]:
                origin = origin_result["results"][0]["geometry"]["location"]
                origin = {"lat": origin["lat"], "lon": origin["lng"]}
            
            if "results" in destination_result and destination_result["results"]:
                destination = destination_result["results"][0]["geometry"]["location"]
                destination = {"lat": destination["lat"], "lon": destination["lng"]}
        
        if not origin or not destination:
            return "I can help you get directions! Please provide both origin and destination. For example: 'How do I get from Seattle to Portland?' or 'Directions from 123 Main St to 456 Oak Ave'"
        
        # Call TomTom directions
        result = self._call_mcp_method(self.tomtom_methods['directions'], {
            "origin": origin,
            "destination": destination,
            "travelMode": "car"
        })
        
        if "error" in result:
            return f"Sorry, I couldn't get directions right now. {result['error']}"
        
        if "routes" in result and result["routes"]:
            route = result["routes"][0]
            summary = route["summary"]
            
            response = f"🗺️ **Directions Found**\n\n"
            response += f"📍 **From:** {origin_text}\n"
            response += f"📍 **To:** {destination_text}\n\n"
            response += f"📏 **Distance:** {summary['distance']['text']}\n"
            response += f"⏱️ **Duration:** {summary['duration']['text']}\n"
            
            if "steps" in route and route["steps"]:
                response += f"\n**Route Steps:**\n"
                for i, step in enumerate(route["steps"][:5], 1):  # Show first 5 steps
                    response += f"{i}. {step['html_instructions']}\n"
                
                if len(route["steps"]) > 5:
                    response += f"... and {len(route['steps']) - 5} more steps\n"
            
            return response
        else:
            return "I couldn't find a route between those locations. Please check the addresses and try again."
    
    def _handle_geocoding_query(self, query: str) -> str:
        """Handle geocoding queries"""
        address = self._extract_address_from_query(query)
        
        if not address:
            # Try to extract address from the whole query
            words = query.split()
            # Remove common question words
            filtered_words = [word for word in words if word.lower() not in ['what', 'is', 'the', 'address', 'for', 'of', 'where', 'is', 'located']]
            address = ' '.join(filtered_words)
        
        if not address:
            return "I can help you find coordinates for an address! Please provide an address. For example: 'What are the coordinates for 123 Main Street, Seattle, WA?'"
        
        # Call TomTom geocoding
        result = self._call_mcp_method(self.tomtom_methods['geocode'], {"address": address})
        
        if "error" in result:
            return f"Sorry, I couldn't geocode that address right now. {result['error']}"
        
        if "results" in result and result["results"]:
            location = result["results"][0]
            coords = location["geometry"]["location"]
            
            response = f"📍 **Address:** {location['formatted_address']}\n"
            response += f"🌐 **Coordinates:** {coords['lat']}, {coords['lng']}\n"
            response += f"🆔 **Place ID:** {location['place_id']}\n"
            
            return response
        else:
            return f"I couldn't find coordinates for '{address}'. Please check the address and try again."
    
    def _handle_reverse_geocoding_query(self, query: str) -> str:
        """Handle reverse geocoding queries"""
        location = self._extract_location_from_query(query)
        
        if not location:
            return "I can help you find an address for coordinates! Please provide latitude and longitude. For example: 'What's at 47.6062, -122.3321?'"
        
        # Call TomTom reverse geocoding
        result = self._call_mcp_method(self.tomtom_methods['reverse_geocode'], {
            "lat": location["lat"],
            "lon": location["lon"]
        })
        
        if "error" in result:
            return f"Sorry, I couldn't reverse geocode those coordinates right now. {result['error']}"
        
        if "results" in result and result["results"]:
            address = result["results"][0]
            
            response = f"📍 **Coordinates:** {location['lat']}, {location['lon']}\n"
            response += f"🏠 **Address:** {address['formatted_address']}\n"
            
            return response
        else:
            return f"I couldn't find an address for coordinates {location['lat']}, {location['lon']}."
    
    def _handle_general_query(self, query: str) -> str:
        """Handle general knowledge queries"""
        query_lower = query.lower()
        
        # Weather queries
        if any(word in query_lower for word in ['weather', 'temperature', 'rain', 'sunny', 'cloudy']):
            return "I can help with location-based queries using TomTom maps, but I don't have access to real-time weather data. You might want to check a weather service for current conditions."
        
        # Time queries
        if any(word in query_lower for word in ['time', 'clock', 'hour', 'minute']):
            current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            return f"The current time is {current_time}. I can help you find places or get directions if you need to plan your schedule!"
        
        # General greetings
        if any(word in query_lower for word in ['hello', 'hi', 'hey', 'greetings']):
            return "Hello! I'm your TomTom Maps assistant. I can help you with:\n\n🗺️ **Search for places** (restaurants, hotels, etc.)\n🚗 **Get directions** between locations\n📍 **Find coordinates** for addresses\n🏠 **Find addresses** for coordinates\n🗺️ **Generate map images**\n\nWhat would you like to do?"
        
        # Help queries
        if any(word in query_lower for word in ['help', 'what can you do', 'capabilities']):
            return """I'm a TomTom Maps assistant that can help you with location-based queries:

🗺️ **Search Places:**
- "Find restaurants near me"
- "Search for coffee shops in Seattle"
- "Show me hotels near 47.6062, -122.3321"

🚗 **Get Directions:**
- "How do I get from Seattle to Portland?"
- "Directions from 123 Main St to 456 Oak Ave"
- "Route from my location to the airport"

📍 **Geocoding:**
- "What are the coordinates for 123 Main Street, Seattle?"
- "Find the address for 47.6062, -122.3321"

🗺️ **Map Images:**
- "Show me a map of Seattle"
- "Generate a map image for 47.6062, -122.3321"

Just ask me anything location-related!"""
        
        # Default response
        return "I'm specialized in location-based queries using TomTom maps. I can help you search for places, get directions, find coordinates, or generate map images. Could you rephrase your question in a location-related context?"
    
    def process_query(self, user_query: str, user_id: str = "default") -> Dict[str, Any]:
        """Process a user query and return a response"""
        try:
            # Store conversation history
            self.conversation_history.append({
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "query": user_query,
                "type": "user"
            })
            
            # Determine query type and route to appropriate handler
            if self._is_search_query(user_query):
                response = self._handle_search_query(user_query)
                query_type = "search"
            elif self._is_directions_query(user_query):
                response = self._handle_directions_query(user_query)
                query_type = "directions"
            elif "geocode" in user_query.lower() or "coordinates" in user_query.lower():
                response = self._handle_geocoding_query(user_query)
                query_type = "geocoding"
            elif "reverse" in user_query.lower() or "address" in user_query.lower():
                response = self._handle_reverse_geocoding_query(user_query)
                query_type = "reverse_geocoding"
            elif self._is_location_query(user_query):
                # Generic location query - try geocoding first
                response = self._handle_geocoding_query(user_query)
                query_type = "location"
            else:
                response = self._handle_general_query(user_query)
                query_type = "general"
            
            # Store response in conversation history
            self.conversation_history.append({
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id,
                "response": response,
                "type": "assistant",
                "query_type": query_type
            })
            
            return {
                "success": True,
                "response": response,
                "query_type": query_type,
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id
            }
            
        except Exception as e:
            logger.error(f"Error processing query: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I encountered an error processing your request. Please try again.",
                "timestamp": datetime.now().isoformat(),
                "user_id": user_id
            }
    
    def get_conversation_history(self, user_id: str = "default", limit: int = 10) -> List[Dict[str, Any]]:
        """Get conversation history for a user"""
        user_history = [msg for msg in self.conversation_history if msg.get("user_id") == user_id]
        return user_history[-limit:] if limit else user_history
    
    def set_user_context(self, user_id: str, context: Dict[str, Any]):
        """Set context for a user (e.g., current location)"""
        if user_id not in self.user_context:
            self.user_context[user_id] = {}
        self.user_context[user_id].update(context)
    
    def get_user_context(self, user_id: str) -> Dict[str, Any]:
        """Get context for a user"""
        return self.user_context.get(user_id, {})

# Example usage
if __name__ == "__main__":
    # Initialize the chatbot agent
    agent = TomTomChatbotAgent()
    
    # Example queries
    test_queries = [
        "Hello! What can you do?",
        "Find restaurants near 47.6062, -122.3321",
        "How do I get from Seattle to Portland?",
        "What are the coordinates for 123 Main Street, Seattle?",
        "What's at 47.6062, -122.3321?",
        "What's the weather like today?"
    ]
    
    print("🤖 TomTom Maps Chatbot Agent")
    print("=" * 50)
    
    for query in test_queries:
        print(f"\n👤 User: {query}")
        result = agent.process_query(query)
        print(f"🤖 Agent: {result['response']}")
        print(f"📊 Type: {result['query_type']}")
        print("-" * 50)
