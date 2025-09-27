#!/usr/bin/env python3
"""
Comprehensive test script for all TomTom MCP endpoints
"""

import requests
import json
import sys
import os

# Add the src directory to the path so we can import tools
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

def test_mcp_endpoint(method, params, description):
    """Test an MCP endpoint and return results"""
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
        result = response.json()
        
        if "error" in result:
            return False, f"Error: {result['error']['message']}"
        else:
            return True, result.get("result", {})
    except requests.exceptions.RequestException as e:
        return False, f"Request failed: {str(e)}"

def test_initialize():
    """Test the initialize endpoint"""
    print("🔧 Testing initialize endpoint...")
    success, result = test_mcp_endpoint("initialize", {}, "Initialize MCP connection")
    
    if success:
        print("✅ Initialize successful")
        if "capabilities" in result:
            print(f"   Capabilities: {list(result['capabilities'].keys())}")
        return True
    else:
        print(f"❌ Initialize failed: {result}")
        return False

def test_search():
    """Test search functionality"""
    print("\n🔍 Testing search endpoint...")
    success, result = test_mcp_endpoint("maps.search", {
        "query": "restaurant",
        "location": {"lat": 47.6062, "lon": -122.3321}
    }, "Search for restaurants")
    
    if success and "places" in result:
        places = result["places"]
        print(f"✅ Search successful - Found {len(places)} places")
        if places:
            first_place = places[0]
            print(f"   First result: {first_place['name']}")
            print(f"   Address: {first_place['formatted_address']}")
        return True
    else:
        print(f"❌ Search failed: {result}")
        return False

def test_directions():
    """Test directions functionality"""
    print("\n🗺️  Testing directions endpoint...")
    success, result = test_mcp_endpoint("maps.directions", {
        "origin": {"lat": 47.6062, "lon": -122.3321},
        "destination": {"lat": 47.6205, "lon": -122.3493},
        "travelMode": "car"
    }, "Get directions")
    
    if success and "routes" in result:
        routes = result["routes"]
        if routes:
            route = routes[0]
            summary = route["summary"]
            print(f"✅ Directions successful")
            print(f"   Distance: {summary['distance']['text']}")
            print(f"   Duration: {summary['duration']['text']}")
            return True
    else:
        print(f"❌ Directions failed: {result}")
        return False

def test_reverse_geocoding():
    """Test reverse geocoding functionality"""
    print("\n📍 Testing reverse geocoding endpoint...")
    success, result = test_mcp_endpoint("maps.reverseGeocode", {
        "lat": 47.6062,
        "lon": -122.3321
    }, "Reverse geocode coordinates")
    
    if success and "results" in result:
        results = result["results"]
        if results:
            first_result = results[0]
            print(f"✅ Reverse geocoding successful")
            print(f"   Address: {first_result['formatted_address']}")
            return True
    else:
        print(f"❌ Reverse geocoding failed: {result}")
        return False

def test_static_map():
    """Test static map generation"""
    print("\n🗺️  Testing static map endpoint...")
    success, result = test_mcp_endpoint("maps.staticMap", {
        "lat": 47.6062,
        "lon": -122.3321,
        "zoom": 15,
        "width": 512,
        "height": 512
    }, "Generate static map")
    
    if success and "url" in result:
        map_url = result["url"]
        print(f"✅ Static map successful")
        print(f"   Map URL: {map_url[:80]}...")
        return True
    else:
        print(f"❌ Static map failed: {result}")
        return False

def test_geocoding():
    """Test geocoding functionality"""
    print("\n🏠 Testing geocoding endpoint...")
    success, result = test_mcp_endpoint("maps.geocode", {
        "address": "Seattle, WA"
    }, "Geocode address")
    
    if success and "results" in result:
        results = result["results"]
        if results:
            first_result = results[0]
            print(f"✅ Geocoding successful")
            print(f"   Address: {first_result['formatted_address']}")
            return True
        else:
            print("⚠️  Geocoding returned no results (this may be normal)")
            return True
    else:
        print(f"❌ Geocoding failed: {result}")
        return False

def test_matrix():
    """Test matrix routing functionality"""
    print("\n📊 Testing matrix routing endpoint...")
    success, result = test_mcp_endpoint("maps.matrix", {
        "origins": [{"lat": 47.6062, "lon": -122.3321}],
        "destinations": [
            {"lat": 47.6205, "lon": -122.3493},
            {"lat": 47.6097, "lon": -122.3331}
        ],
        "travelMode": "car"
    }, "Calculate distance matrix")
    
    if success and "rows" in result:
        rows = result["rows"]
        if rows and "elements" in rows[0]:
            elements = rows[0]["elements"]
            print(f"✅ Matrix routing successful")
            print(f"   Calculated {len(elements)} routes")
            for i, element in enumerate(elements):
                if element["status"] == "OK":
                    print(f"   Route {i+1}: {element['distance']['text']}, {element['duration']['text']}")
            return True
    else:
        print(f"❌ Matrix routing failed: {result}")
        return False

def test_rest_endpoints():
    """Test REST API endpoints directly"""
    print("\n🌐 Testing REST API endpoints...")
    
    # Test search REST endpoint
    try:
        response = requests.post("http://localhost:3000/api/tomtom/search", 
                               json={"query": "coffee", "location": {"lat": 47.6062, "lon": -122.3321}})
        if response.status_code == 200:
            print("✅ REST Search endpoint working")
        else:
            print(f"❌ REST Search failed: {response.status_code}")
    except Exception as e:
        print(f"❌ REST Search error: {e}")
    
    # Test directions REST endpoint
    try:
        response = requests.post("http://localhost:3000/api/tomtom/directions", 
                               json={"origin": {"lat": 47.6062, "lon": -122.3321}, 
                                     "destination": {"lat": 47.6205, "lon": -122.3493}, 
                                     "travelMode": "car"})
        if response.status_code == 200:
            print("✅ REST Directions endpoint working")
        else:
            print(f"❌ REST Directions failed: {response.status_code}")
    except Exception as e:
        print(f"❌ REST Directions error: {e}")

def main():
    """Main test function"""
    print("🧪 Comprehensive TomTom MCP Server Test")
    print("=" * 60)
    
    # Check if server is running
    try:
        response = requests.get("http://localhost:3000/", timeout=5)
        print("✅ MCP Server is running")
    except requests.exceptions.RequestException:
        print("❌ MCP Server is not running. Please start it with: npm start")
        return
    
    # Run all tests
    tests = [
        ("Initialize", test_initialize),
        ("Search", test_search),
        ("Directions", test_directions),
        ("Reverse Geocoding", test_reverse_geocoding),
        ("Static Map", test_static_map),
        ("Geocoding", test_geocoding),
        ("Matrix Routing", test_matrix)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"❌ {test_name} test crashed: {e}")
    
    # Test REST endpoints
    test_rest_endpoints()
    
    print(f"\n📊 Test Results: {passed}/{total} MCP endpoints passed")
    
    if passed == total:
        print("🎉 All MCP endpoints are working correctly!")
        print("\n📋 Available endpoints:")
        print("   • maps.search - Find places near a location")
        print("   • maps.directions - Calculate routes between points")
        print("   • maps.reverseGeocode - Convert coordinates to addresses")
        print("   • maps.staticMap - Generate map images")
        print("   • maps.geocode - Convert addresses to coordinates")
        print("   • maps.matrix - Calculate distance/time matrices")
        print("\n🚀 The TomTom MCP server is ready for ADK integration!")
    else:
        print("⚠️  Some endpoints failed. Check the server configuration.")

if __name__ == "__main__":
    main()
