#!/usr/bin/env python3
"""
Manual test script to demonstrate how the ADK agent would work with TomTom MCP tools.
This simulates the agent behavior without requiring the full ADK setup.
"""

import os
import sys
import json
import requests
import time
import subprocess
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class MockADKAgent:
    """Mock ADK agent that simulates how the real agent would work."""
    
    def __init__(self):
        self.server_process = None
        self.base_url = "http://localhost:3000"
    
    def start_mcp_server(self):
        """Start the MCP server."""
        print("Starting TomTom MCP server...")
        
        api_key = os.getenv('TOMTOM_API_KEY')
        if not api_key:
            raise ValueError("TOMTOM_API_KEY not set")
        
        self.server_process = subprocess.Popen(
            ['node', 'src/mcp-server.js'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=dict(os.environ, TOMTOM_API_KEY=api_key)
        )
        
        # Wait for server to start
        time.sleep(3)
        
        if self.server_process.poll() is not None:
            stdout, stderr = self.server_process.communicate()
            raise RuntimeError(f"Server failed to start: {stderr.decode()}")
        
        print("✅ MCP server started")
    
    def stop_mcp_server(self):
        """Stop the MCP server."""
        if self.server_process:
            self.server_process.terminate()
            self.server_process.wait()
            print("✅ MCP server stopped")
    
    def query(self, user_query):
        """Simulate agent query processing."""
        print(f"\n🤖 Agent processing: '{user_query}'")
        
        # Parse the query and determine which tool to use
        if "find" in user_query.lower() or "search" in user_query.lower():
            return self._handle_search_query(user_query)
        elif "address" in user_query.lower() or "coordinates" in user_query.lower():
            return self._handle_reverse_geocode_query(user_query)
        elif "directions" in user_query.lower() or "route" in user_query.lower():
            return self._handle_directions_query(user_query)
        elif "map" in user_query.lower():
            return self._handle_map_query(user_query)
        else:
            return "I can help you with location search, geocoding, directions, and maps using TomTom services."
    
    def _handle_search_query(self, query):
        """Handle location search queries."""
        print("   🔍 Using TomTom search tool...")
        
        # Extract location from query (simplified)
        if "seattle" in query.lower():
            location = {"lat": 47.6062, "lon": -122.3321}
        elif "new york" in query.lower():
            location = {"lat": 40.7128, "lon": -74.0060}
        else:
            location = {"lat": 47.6062, "lon": -122.3321}  # Default to Seattle
        
        # Extract search term
        if "coffee" in query.lower():
            search_term = "coffee shops"
        elif "restaurant" in query.lower():
            search_term = "restaurants"
        else:
            search_term = "places"
        
        payload = {
            "query": f"{search_term} in Seattle",
            "location": location
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/tomtom/search",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                places = data.get('places', [])
                
                if places:
                    result = f"Found {len(places)} {search_term}:\n"
                    for i, place in enumerate(places[:3], 1):  # Show first 3
                        result += f"{i}. {place.get('name', 'Unknown')}\n"
                        result += f"   📍 {place.get('formatted_address', 'Unknown address')}\n"
                    return result
                else:
                    return f"No {search_term} found in the area."
            else:
                return f"Sorry, I couldn't search for {search_term} right now."
                
        except Exception as e:
            return f"Error searching for {search_term}: {str(e)}"
    
    def _handle_reverse_geocode_query(self, query):
        """Handle reverse geocoding queries."""
        print("   🗺️  Using TomTom reverse geocoding tool...")
        
        # Extract coordinates from query (simplified)
        if "47.6062" in query and "-122.3321" in query:
            lat, lon = 47.6062, -122.3321
        else:
            # Default coordinates
            lat, lon = 47.6062, -122.3321
        
        payload = {"lat": lat, "lon": lon}
        
        try:
            response = requests.post(
                f"{self.base_url}/api/tomtom/reversegeocode",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                
                if results:
                    address = results[0].get('formatted_address', 'Unknown address')
                    return f"📍 The coordinates {lat}, {lon} correspond to:\n{address}"
                else:
                    return f"Could not find an address for coordinates {lat}, {lon}"
            else:
                return f"Sorry, I couldn't geocode those coordinates right now."
                
        except Exception as e:
            return f"Error geocoding coordinates: {str(e)}"
    
    def _handle_directions_query(self, query):
        """Handle directions queries."""
        print("   🧭 Using TomTom directions tool...")
        
        # Simplified route calculation
        origin = {"lat": 47.6062, "lon": -122.3321}  # Seattle
        destination = {"lat": 47.6101, "lon": -122.2015}  # Bellevue
        
        payload = {
            "origin": origin,
            "destination": destination,
            "travelMode": "car"
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/tomtom/directions",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                routes = data.get('routes', [])
                
                if routes:
                    route = routes[0]
                    summary = route.get('summary', {})
                    distance = summary.get('distance', {})
                    duration = summary.get('duration', {})
                    
                    return f"🧭 Route from Seattle to Bellevue:\n" \
                           f"   Distance: {distance.get('text', 'Unknown')}\n" \
                           f"   Duration: {duration.get('text', 'Unknown')}"
                else:
                    return "Could not calculate a route between those locations."
            else:
                return "Sorry, I couldn't calculate directions right now."
                
        except Exception as e:
            return f"Error calculating directions: {str(e)}"
    
    def _handle_map_query(self, query):
        """Handle map generation queries."""
        print("   🗺️  Using TomTom static map tool...")
        
        # Default to New York City
        lat, lon = 40.7128, -74.0060
        
        payload = {
            "lat": lat,
            "lon": lon,
            "zoom": 15
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/api/tomtom/staticmap",
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                map_url = data.get('url', '')
                
                return f"🗺️  Here's a map of New York City:\n{map_url}"
            else:
                return "Sorry, I couldn't generate a map right now."
                
        except Exception as e:
            return f"Error generating map: {str(e)}"

def main():
    """Main test function."""
    
    print("TomTom MCP Agent Simulation")
    print("=" * 50)
    
    # Check for API key
    if not os.getenv('TOMTOM_API_KEY'):
        print("❌ TOMTOM_API_KEY environment variable not set")
        return
    
    agent = MockADKAgent()
    
    try:
        # Start the MCP server
        agent.start_mcp_server()
        
        # Test queries
        test_queries = [
            "Find coffee shops near me",
            "What's the address for coordinates 47.6062, -122.3321?",
            "Get directions from Seattle to Bellevue",
            "Show me a map of New York City"
        ]
        
        print("\n" + "=" * 50)
        print("Testing Agent Queries")
        print("=" * 50)
        
        for i, query in enumerate(test_queries, 1):
            print(f"\n{i}. User Query: {query}")
            response = agent.query(query)
            print(f"   Agent Response: {response}")
        
        print("\n" + "=" * 50)
        print("✅ Agent simulation completed successfully!")
        print("=" * 50)
        print("\nThis demonstrates how your ADK agent would:")
        print("1. Parse user queries")
        print("2. Determine which TomTom tool to use")
        print("3. Call the appropriate MCP endpoint")
        print("4. Return formatted results to the user")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        agent.stop_mcp_server()

if __name__ == "__main__":
    main()
