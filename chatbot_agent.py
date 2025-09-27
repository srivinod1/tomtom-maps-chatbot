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
    
    def __init__(self, mcp_server_url: str = "http://localhost:3000", use_direct_api: bool = False):
        self.mcp_server_url = mcp_server_url
        self.use_direct_api = use_direct_api
        self.conversation_history = []
        self.user_context = {}
        
        # TomTom API key
        self.tomtom_api_key = os.getenv('TOMTOM_API_KEY')
        if not self.tomtom_api_key:
            raise ValueError("TOMTOM_API_KEY environment variable is required")
        
        # TomTom MCP methods
        self.tomtom_methods = {
            'search': 'maps.search',
            'directions': 'maps.directions', 
            'geocode': 'maps.geocode',
            'reverse_geocode': 'maps.reverseGeocode',
            'static_map': 'maps.staticMap',
            'matrix': 'maps.matrix'
        }
        
        # Initialize connection
        if use_direct_api:
            logger.info("✅ Using direct TomTom API calls")
        else:
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
        """Call a TomTom MCP method or direct API"""
        if self.use_direct_api:
            return self._call_direct_api(method, params)
        
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
    
    def _call_direct_api(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Call TomTom API directly"""
        try:
            if method == 'maps.search':
                return self._direct_search(params)
            elif method == 'maps.directions':
                return self._direct_directions(params)
            elif method == 'maps.geocode':
                return self._direct_geocode(params)
            elif method == 'maps.reverseGeocode':
                return self._direct_reverse_geocode(params)
            elif method == 'maps.staticMap':
                return self._direct_static_map(params)
            elif method == 'maps.matrix':
                return self._direct_matrix(params)
            else:
                return {"error": f"Unknown method: {method}"}
        except Exception as e:
            logger.error(f"Error calling direct API {method}: {e}")
            return {"error": str(e)}
    
    def _direct_search(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Direct TomTom search API call"""
        query = params.get("query", "")
        location = params.get("location", {})
        
        url = "https://api.tomtom.com/maps/orbis/places/nearbySearch/.json"
        request_params = {
            "key": self.tomtom_api_key,
            "apiVersion": "1",
            "query": query
        }
        
        if location and "lat" in location and "lon" in location:
            request_params["lat"] = location["lat"]
            request_params["lon"] = location["lon"]
        
        response = requests.get(url, params=request_params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return self._format_search_results(data)
        else:
            return {"error": f"Search API error: {response.status_code}"}
    
    def _direct_directions(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Direct TomTom directions API call"""
        origin = params.get("origin", {})
        destination = params.get("destination", {})
        travel_mode = params.get("travelMode", "car")
        
        if not origin or not destination:
            return {"error": "Origin and destination are required"}
        
        origin_str = f"{origin['lat']},{origin['lon']}"
        dest_str = f"{destination['lat']},{destination['lon']}"
        
        url = f"https://api.tomtom.com/maps/orbis/routing/calculateRoute/{origin_str}:{dest_str}/json"
        request_params = {
            "key": self.tomtom_api_key,
            "apiVersion": "2",
            "travelMode": travel_mode,
            "traffic": "live",
            "routeType": "efficient"
        }
        
        headers = {"TomTom-Api-Version": "2"}
        
        response = requests.get(url, params=request_params, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return self._format_route_results(data)
        else:
            return {"error": f"Directions API error: {response.status_code}"}
    
    def _direct_geocode(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Direct TomTom geocoding API call"""
        address = params.get("address", "")
        
        if not address:
            return {"error": "Address is required"}
        
        url = f"https://api.tomtom.com/search/2/geocode/{requests.utils.quote(address)}.json"
        request_params = {
            "key": self.tomtom_api_key,
            "language": "en-US"
        }
        
        response = requests.get(url, params=request_params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return self._format_geocode_results(data)
        else:
            return {"error": f"Geocoding API error: {response.status_code}"}
    
    def _direct_reverse_geocode(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Direct TomTom reverse geocoding API call"""
        lat = params.get("lat")
        lon = params.get("lon")
        
        if lat is None or lon is None:
            return {"error": "Latitude and longitude are required"}
        
        url = f"https://api.tomtom.com/search/2/reverseGeocode/{lat},{lon}.json"
        request_params = {
            "key": self.tomtom_api_key,
            "language": "en-US"
        }
        
        response = requests.get(url, params=request_params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return self._format_reverse_geocode_results(data)
        else:
            return {"error": f"Reverse geocoding API error: {response.status_code}"}
    
    def _direct_static_map(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Direct TomTom static map API call"""
        lat = params.get("lat")
        lon = params.get("lon")
        zoom = params.get("zoom", 15)
        width = params.get("width", 512)
        height = params.get("height", 512)
        
        if lat is None or lon is None:
            return {"error": "Latitude and longitude are required"}
        
        url = "https://api.tomtom.com/map/1/staticimage"
        request_params = {
            "key": self.tomtom_api_key,
            "center": f"{lat},{lon}",
            "zoom": zoom,
            "width": width,
            "height": height,
            "format": "png"
        }
        
        return {"url": f"{url}?{'&'.join([f'{k}={v}' for k, v in request_params.items()])}"}
    
    def _direct_matrix(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Direct TomTom matrix API call"""
        origins = params.get("origins", [])
        destinations = params.get("destinations", [])
        travel_mode = params.get("travelMode", "car")
        
        if not origins or not destinations:
            return {"error": "Origins and destinations are required"}
        
        # Format for TomTom Matrix API
        formatted_origins = [{"point": {"latitude": o["lat"], "longitude": o["lon"]}} for o in origins]
        formatted_destinations = [{"point": {"latitude": d["lat"], "longitude": d["lon"]}} for d in destinations]
        
        url = "https://api.tomtom.com/routing/matrix/2"
        request_params = {"key": self.tomtom_api_key}
        
        request_data = {
            "origins": formatted_origins,
            "destinations": formatted_destinations,
            "options": {"travelMode": travel_mode}
        }
        
        response = requests.post(url, params=request_params, json=request_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return self._format_matrix_results(data)
        else:
            return {"error": f"Matrix API error: {response.status_code}"}
    
    def _format_search_results(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format search results from TomTom API"""
        if "results" not in data:
            return {"places": []}
        
        places = []
        for result in data["results"][:10]:  # Limit to 10 results
            place = {
                "name": result.get("poi", {}).get("name", "Unknown"),
                "formatted_address": result.get("address", {}).get("freeformAddress", "Unknown address"),
                "location": {
                    "lat": result.get("position", {}).get("lat", 0),
                    "lng": result.get("position", {}).get("lon", 0)
                },
                "rating": result.get("poi", {}).get("rating", 0)
            }
            places.append(place)
        
        return {"places": places}
    
    def _format_route_results(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format route results from TomTom API"""
        if "routes" not in data or not data["routes"]:
            return {"routes": []}
        
        route = data["routes"][0]
        summary = route.get("summary", {})
        
        formatted_route = {
            "summary": {
                "distance": {
                    "text": f"{summary.get('lengthInMeters', 0) / 1000:.1f} km",
                    "value": summary.get('lengthInMeters', 0)
                },
                "duration": {
                    "text": f"{summary.get('travelTimeInSeconds', 0) // 60} mins",
                    "value": summary.get('travelTimeInSeconds', 0)
                }
            },
            "steps": []
        }
        
        # Add steps if available
        if "legs" in route and route["legs"]:
            for leg in route["legs"]:
                if "points" in leg:
                    for point in leg["points"]:
                        if "instruction" in point:
                            formatted_route["steps"].append({
                                "html_instructions": point["instruction"]["text"]
                            })
        
        return {"routes": [formatted_route]}
    
    def _format_geocode_results(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format geocoding results from TomTom API"""
        if "results" not in data:
            return {"results": []}
        
        formatted_results = []
        for result in data["results"]:
            formatted_result = {
                "formatted_address": result.get("address", {}).get("freeformAddress", ""),
                "geometry": {
                    "location": {
                        "lat": result.get("position", {}).get("lat", 0),
                        "lng": result.get("position", {}).get("lon", 0)
                    }
                },
                "place_id": result.get("id", "")
            }
            formatted_results.append(formatted_result)
        
        return {"results": formatted_results}
    
    def _format_reverse_geocode_results(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format reverse geocoding results from TomTom API"""
        if "addresses" not in data or not data["addresses"]:
            return {"results": []}
        
        address = data["addresses"][0]
        formatted_result = {
            "formatted_address": address.get("address", {}).get("freeformAddress", "")
        }
        
        return {"results": [formatted_result]}
    
    def _format_matrix_results(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Format matrix results from TomTom API"""
        if "data" not in data:
            return {"rows": []}
        
        elements = []
        for item in data["data"]:
            summary = item.get("routeSummary", {})
            elements.append({
                "status": "OK",
                "distance": {
                    "value": summary.get("lengthInMeters", 0),
                    "text": f"{summary.get('lengthInMeters', 0) / 1000:.1f} km"
                },
                "duration": {
                    "value": summary.get("travelTimeInSeconds", 0),
                    "text": f"{summary.get('travelTimeInSeconds', 0) // 60} mins"
                }
            })
        
        return {"rows": [{"elements": elements}]}
    
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
