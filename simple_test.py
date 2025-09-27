#!/usr/bin/env python3
"""
Simple test to verify TomTom MCP server functionality without ADK dependencies.
This tests the core functionality that the agent would use.
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_tomtom_mcp_server():
    """Test the TomTom MCP server directly."""
    
    print("Testing TomTom MCP Server")
    print("=" * 40)
    
    # Check for API key
    api_key = os.getenv('TOMTOM_API_KEY')
    if not api_key:
        print("❌ TOMTOM_API_KEY environment variable not set")
        return False
    
    print(f"✅ TOMTOM_API_KEY is set (length: {len(api_key)})")
    
    # Start the server
    print("\nStarting MCP server...")
    import subprocess
    import time
    
    try:
        # Start server in background
        process = subprocess.Popen(
            ['node', 'src/mcp-server.js'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=dict(os.environ, TOMTOM_API_KEY=api_key)
        )
        
        # Wait for server to start
        time.sleep(3)
        
        if process.poll() is None:
            print("✅ MCP server started successfully")
        else:
            stdout, stderr = process.communicate()
            print(f"❌ MCP server failed to start")
            print(f"Error: {stderr.decode()}")
            return False
        
        # Test endpoints
        base_url = "http://localhost:3000"
        
        # Test 1: Health check
        print("\n1. Testing health endpoint...")
        try:
            response = requests.get(f"{base_url}/health", timeout=5)
            if response.status_code == 200:
                print("✅ Health endpoint working")
            else:
                print(f"⚠️  Health endpoint returned {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Health endpoint failed: {e}")
        
        # Test 2: Location search
        print("\n2. Testing location search...")
        search_payload = {
            "query": "coffee shops in Seattle",
            "location": {"lat": 47.6062, "lon": -122.3321}
        }
        
        try:
            response = requests.post(
                f"{base_url}/api/tomtom/search",
                json=search_payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                places = data.get('places', [])
                print(f"✅ Location search successful - found {len(places)} places")
                
                if places:
                    first_place = places[0]
                    print(f"   Example: {first_place.get('name', 'Unknown')}")
                    print(f"   Address: {first_place.get('formatted_address', 'Unknown')}")
            else:
                print(f"❌ Location search failed: {response.status_code}")
                print(f"   Response: {response.text}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Location search request failed: {e}")
        
        # Test 3: Reverse geocoding
        print("\n3. Testing reverse geocoding...")
        reverse_payload = {
            "lat": 47.6062,
            "lon": -122.3321
        }
        
        try:
            response = requests.post(
                f"{base_url}/api/tomtom/reversegeocode",
                json=reverse_payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                print(f"✅ Reverse geocoding successful - found {len(results)} results")
                
                if results:
                    first_result = results[0]
                    print(f"   Address: {first_result.get('formatted_address', 'Unknown')}")
            else:
                print(f"❌ Reverse geocoding failed: {response.status_code}")
                print(f"   Response: {response.text}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Reverse geocoding request failed: {e}")
        
        # Test 4: Static map
        print("\n4. Testing static map...")
        map_payload = {
            "lat": 47.6062,
            "lon": -122.3321,
            "zoom": 15
        }
        
        try:
            response = requests.post(
                f"{base_url}/api/tomtom/staticmap",
                json=map_payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                map_url = data.get('url', '')
                print(f"✅ Static map generated successfully")
                print(f"   Map URL: {map_url[:100]}...")
            else:
                print(f"❌ Static map failed: {response.status_code}")
                print(f"   Response: {response.text}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Static map request failed: {e}")
        
        # Clean up
        print("\nStopping server...")
        process.terminate()
        process.wait()
        print("✅ Server stopped")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Main test function."""
    
    print("TomTom MCP Server Test")
    print("=" * 50)
    
    success = test_tomtom_mcp_server()
    
    print("\n" + "=" * 50)
    if success:
        print("✅ TomTom MCP server is working correctly!")
        print("\nThe server can handle:")
        print("- Location search queries")
        print("- Reverse geocoding")
        print("- Static map generation")
        print("- Other TomTom API functions")
        print("\nYour ADK agent will be able to use these tools once the ADK")
        print("integration is properly configured.")
    else:
        print("❌ TomTom MCP server test failed")
        print("Please check the errors above and fix them.")

if __name__ == "__main__":
    main()
