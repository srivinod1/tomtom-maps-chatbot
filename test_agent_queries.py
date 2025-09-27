#!/usr/bin/env python3
"""
Test script to verify the ADK agent can answer user queries using TomTom MCP
"""

import requests
import json
import sys
import os

# Add the src directory to the path so we can import tools
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def test_mcp_endpoint(method, params):
    """Test an MCP endpoint"""
    url = "http://localhost:3000/"
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

def test_search_functionality():
    """Test search functionality"""
    print("🔍 Testing search functionality...")
    
    # Test 1: Search for coffee shops in Seattle
    result = test_mcp_endpoint("maps.search", {
        "query": "coffee",
        "location": {"lat": 47.6062, "lon": -122.3321}
    })
    
    if "error" in result:
        print(f"❌ Search failed: {result['error']}")
        return False
    
    if "result" in result and "places" in result["result"]:
        places = result["result"]["places"]
        print(f"✅ Found {len(places)} places")
        if places:
            first_place = places[0]
            print(f"   First result: {first_place['name']} at {first_place['formatted_address']}")
            print(f"   Coordinates: {first_place['location']['lat']}, {first_place['location']['lng']}")
        return True
    else:
        print("❌ Invalid search response format")
        return False

def test_directions_functionality():
    """Test directions functionality"""
    print("\n🗺️  Testing directions functionality...")
    
    # Test 2: Get directions from Seattle to nearby location
    result = test_mcp_endpoint("maps.directions", {
        "origin": {"lat": 47.6062, "lon": -122.3321},
        "destination": {"lat": 47.6205, "lon": -122.3493},
        "travelMode": "car"
    })
    
    if "error" in result:
        print(f"❌ Directions failed: {result['error']}")
        return False
    
    if "result" in result and "routes" in result["result"]:
        routes = result["result"]["routes"]
        if routes:
            route = routes[0]
            summary = route["summary"]
            print(f"✅ Route calculated successfully")
            print(f"   Distance: {summary['distance']['text']}")
            print(f"   Duration: {summary['duration']['text']}")
            return True
        else:
            print("❌ No routes found")
            return False
    else:
        print("❌ Invalid directions response format")
        return False

def test_reverse_geocoding():
    """Test reverse geocoding functionality"""
    print("\n📍 Testing reverse geocoding...")
    
    result = test_mcp_endpoint("maps.reverseGeocode", {
        "lat": 47.6062,
        "lon": -122.3321
    })
    
    if "error" in result:
        print(f"❌ Reverse geocoding failed: {result['error']}")
        return False
    
    if "result" in result and "results" in result["result"]:
        results = result["result"]["results"]
        if results:
            first_result = results[0]
            print(f"✅ Reverse geocoding successful")
            print(f"   Address: {first_result['formatted_address']}")
            return True
        else:
            print("❌ No reverse geocoding results")
            return False
    else:
        print("❌ Invalid reverse geocoding response format")
        return False

def test_static_map():
    """Test static map generation"""
    print("\n🗺️  Testing static map generation...")
    
    result = test_mcp_endpoint("maps.staticMap", {
        "lat": 47.6062,
        "lon": -122.3321,
        "zoom": 15,
        "width": 512,
        "height": 512
    })
    
    if "error" in result:
        print(f"❌ Static map failed: {result['error']}")
        return False
    
    if "result" in result and "url" in result["result"]:
        map_url = result["result"]["url"]
        print(f"✅ Static map generated successfully")
        print(f"   Map URL: {map_url[:100]}...")
        return True
    else:
        print("❌ Invalid static map response format")
        return False

def simulate_agent_queries():
    """Simulate how an ADK agent would answer user queries"""
    print("\n🤖 Simulating ADK agent queries...")
    
    # Query 1: "Find coffee shops near me"
    print("\n1. User: 'Find coffee shops near me'")
    search_result = test_mcp_endpoint("maps.search", {
        "query": "coffee",
        "location": {"lat": 47.6062, "lon": -122.3321}
    })
    
    if "result" in search_result and "places" in search_result["result"]:
        places = search_result["result"]["places"][:3]  # Top 3 results
        print("   Agent: I found the following coffee shops near you:")
        for i, place in enumerate(places, 1):
            print(f"   {i}. {place['name']} - {place['formatted_address']}")
    
    # Query 2: "How do I get to the Space Needle?"
    print("\n2. User: 'How do I get to the Space Needle?'")
    # Space Needle coordinates
    space_needle = {"lat": 47.6205, "lon": -122.3493}
    directions_result = test_mcp_endpoint("maps.directions", {
        "origin": {"lat": 47.6062, "lon": -122.3321},
        "destination": space_needle,
        "travelMode": "car"
    })
    
    if "result" in directions_result and "routes" in directions_result["result"]:
        route = directions_result["result"]["routes"][0]
        summary = route["summary"]
        print(f"   Agent: To get to the Space Needle, it's {summary['distance']['text']} and will take {summary['duration']['text']} by car.")
    
    # Query 3: "What's at this location?"
    print("\n3. User: 'What's at this location?' (47.6062, -122.3321)")
    reverse_result = test_mcp_endpoint("maps.reverseGeocode", {
        "lat": 47.6062,
        "lon": -122.3321
    })
    
    if "result" in reverse_result and "results" in reverse_result["result"]:
        address = reverse_result["result"]["results"][0]["formatted_address"]
        print(f"   Agent: That location is at {address}")

def main():
    """Main test function"""
    print("🧪 Testing TomTom MCP Server for ADK Agent")
    print("=" * 50)
    
    # Check if server is running
    try:
        response = requests.get("http://localhost:3000/", timeout=5)
        print("✅ MCP Server is running")
    except requests.exceptions.RequestException:
        print("❌ MCP Server is not running. Please start it with: npm start")
        return
    
    # Run tests
    tests = [
        test_search_functionality,
        test_directions_functionality,
        test_reverse_geocoding,
        test_static_map
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print(f"\n📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The agent can successfully use TomTom MCP tools.")
        simulate_agent_queries()
    else:
        print("⚠️  Some tests failed. Please check the server configuration.")

if __name__ == "__main__":
    main()