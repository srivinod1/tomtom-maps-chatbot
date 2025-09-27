#!/usr/bin/env python3
"""
Test script for the Multi-Agent MCP Server
This script tests the MCP server with multi-agent capabilities
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

# Test configuration
MCP_SERVER_URL = "http://localhost:3000"
USER_ID = "test_user_123"

def test_mcp_server_health():
    """Test if MCP server is running"""
    try:
        response = requests.post(MCP_SERVER_URL, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize"
        }, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("result", {}).get("serverInfo", {}).get("name") == "multi-agent-tomtom-mcp-server":
                print("✅ Multi-Agent MCP Server is running")
                print(f"   Version: {data['result']['serverInfo']['version']}")
                print(f"   Description: {data['result']['serverInfo']['description']}")
                return True
        
        print(f"❌ MCP Server health check failed: {response.status_code}")
        return False
        
    except requests.exceptions.ConnectionError:
        print("❌ MCP Server is not running. Please start it with 'npm start'")
        return False
    except Exception as e:
        print(f"❌ MCP Server error: {e}")
        return False

def test_agent_capabilities():
    """Test agent capabilities endpoint"""
    print("\n🤖 Testing agent capabilities...")
    try:
        response = requests.post(MCP_SERVER_URL, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "agent.capabilities"
        })
        
        if response.status_code == 200:
            data = response.json()
            if "result" in data:
                capabilities = data["result"]
                print("✅ Agent capabilities retrieved successfully")
                print(f"   Available agents: {len(capabilities['agents'])}")
                for agent_name, agent_info in capabilities["agents"].items():
                    print(f"   - {agent_name}: {agent_info['description']}")
                print(f"   MCP methods: {len(capabilities['mcp_methods'])}")
                return True
            else:
                print(f"❌ Agent capabilities failed: {data}")
                return False
        else:
            print(f"❌ Agent capabilities test failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Agent capabilities test error: {e}")
        return False

def test_agent_chat():
    """Test agent chat functionality"""
    print("\n💬 Testing agent chat functionality...")
    test_cases = [
        ("Hello! What can you do?", "general"),
        ("Find restaurants near 47.6062, -122.3321", "location"),
        ("How do I get from Seattle to Portland?", "location"),
        ("What are the coordinates for 123 Main Street, Seattle?", "location"),
        ("What's the weather like today?", "general"),
        ("Help me with something", "general")
    ]
    
    all_passed = True
    for query, expected_type in test_cases:
        print(f"\n💬 Testing: '{query}'")
        try:
            response = requests.post(MCP_SERVER_URL, json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "agent.chat",
                "params": {
                    "message": query,
                    "user_id": USER_ID
                }
            })
            
            if response.status_code == 200:
                data = response.json()
                if "result" in data:
                    result = data["result"]
                    print(f"✅ Response: {result['response'][:100]}...")
                    print(f"   Agent Used: {result.get('agent_used')}")
                    print(f"   Query Type: {result.get('query_type')}")
                    print(f"   Success: {result.get('success')}")
                    
                    if result.get('query_type') == expected_type:
                        print(f"✅ Query type matches: {expected_type}")
                    else:
                        print(f"⚠️  Expected type {expected_type}, got {result.get('query_type')}")
                else:
                    print(f"❌ Chat failed: {data}")
                    all_passed = False
            else:
                print(f"❌ Chat failed: {response.status_code} - {response.text}")
                all_passed = False
        except Exception as e:
            print(f"❌ Chat test error: {e}")
            all_passed = False
    
    return all_passed

def test_agent_context():
    """Test agent context management"""
    print("\n🧠 Testing agent context management...")
    try:
        # Set context
        response = requests.post(MCP_SERVER_URL, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "agent.context",
            "params": {
                "user_id": USER_ID,
                "action": "set",
                "context": {
                    "current_location": {"lat": 47.6062, "lon": -122.3321},
                    "preferences": {"travel_mode": "car", "language": "en"}
                }
            }
        })
        
        if response.status_code == 200:
            data = response.json()
            if "result" in data and data["result"]["status"] == "success":
                print("✅ Context set successfully")
            else:
                print(f"❌ Context set failed: {data}")
                return False
        else:
            print(f"❌ Context set failed: {response.status_code}")
            return False
        
        # Get context
        response = requests.post(MCP_SERVER_URL, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "agent.context",
            "params": {
                "user_id": USER_ID,
                "action": "get"
            }
        })
        
        if response.status_code == 200:
            data = response.json()
            if "result" in data:
                context = data["result"]["context"]
                print("✅ Context retrieved successfully")
                print(f"   Context: {context}")
                return True
            else:
                print(f"❌ Context get failed: {data}")
                return False
        else:
            print(f"❌ Context get failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Context management test error: {e}")
        return False

def test_maps_functionality():
    """Test TomTom Maps functionality through MCP"""
    print("\n🗺️  Testing TomTom Maps functionality...")
    
    # Test search
    print("\n🔍 Testing search...")
    try:
        response = requests.post(MCP_SERVER_URL, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "maps.search",
            "params": {
                "query": "coffee",
                "location": {"lat": 47.6062, "lon": -122.3321}
            }
        })
        
        if response.status_code == 200:
            data = response.json()
            if "result" in data and "places" in data["result"]:
                places = data["result"]["places"]
                print(f"✅ Search successful: Found {len(places)} places")
                if places:
                    first_place = places[0]
                    print(f"   First result: {first_place.get('name', 'Unknown')}")
                return True
            else:
                print(f"❌ Search failed: {data}")
                return False
        else:
            print(f"❌ Search failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Search test error: {e}")
        return False

def test_reverse_geocoding():
    """Test reverse geocoding"""
    print("\n📍 Testing reverse geocoding...")
    try:
        response = requests.post(MCP_SERVER_URL, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "maps.reverseGeocode",
            "params": {
                "lat": 47.6062,
                "lon": -122.3321
            }
        })
        
        if response.status_code == 200:
            data = response.json()
            if "result" in data and "results" in data["result"]:
                results = data["result"]["results"]
                print(f"✅ Reverse geocoding successful")
                if results:
                    address = results[0].get("formatted_address", "Unknown")
                    print(f"   Address: {address}")
                return True
            else:
                print(f"❌ Reverse geocoding failed: {data}")
                return False
        else:
            print(f"❌ Reverse geocoding failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Reverse geocoding test error: {e}")
        return False

def main():
    """Main test function"""
    print("🧪 Multi-Agent MCP Server Test Suite")
    print("=" * 60)
    
    # Test 1: MCP Server Health
    mcp_healthy = test_mcp_server_health()
    
    if not mcp_healthy:
        print("\n❌ MCP Server is not running. Please start it with 'npm start'")
        return
    
    # Test 2: Agent Capabilities
    capabilities_ok = test_agent_capabilities()
    
    # Test 3: Agent Chat
    chat_ok = test_agent_chat()
    
    # Test 4: Agent Context
    context_ok = test_agent_context()
    
    # Test 5: Maps Functionality
    maps_ok = test_maps_functionality()
    
    # Test 6: Reverse Geocoding
    geocoding_ok = test_reverse_geocoding()
    
    # Summary
    print("\n📊 Test Results Summary:")
    print("=" * 60)
    tests = [
        ("MCP Server Health", mcp_healthy),
        ("Agent Capabilities", capabilities_ok),
        ("Agent Chat", chat_ok),
        ("Agent Context", context_ok),
        ("Maps Functionality", maps_ok),
        ("Reverse Geocoding", geocoding_ok)
    ]
    
    passed = sum(1 for _, result in tests if result)
    total = len(tests)
    
    for test_name, result in tests:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {test_name}: {status}")
    
    print(f"\n🎯 Overall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The multi-agent MCP server is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the errors above.")

if __name__ == "__main__":
    main()
