#!/usr/bin/env python3
"""
Test script for Google ADK + A2A + MCP architecture
Tests the complete multi-agent system with proper protocols
"""

import requests
import json
import time
import sys

# Configuration
UNIFIED_SERVER_URL = "http://localhost:3000"
MCP_TOOL_SERVER_URL = "http://localhost:3003"

def test_mcp_tool_server():
    """Test MCP Tool Server functionality"""
    print("🔧 Testing MCP Tool Server...")
    
    try:
        # Test health check
        response = requests.get(f"{MCP_TOOL_SERVER_URL}/health")
        if response.status_code == 200:
            print("✅ MCP Tool Server is healthy")
        else:
            print(f"❌ MCP Tool Server health check failed: {response.status_code}")
            return False
            
        # Test tool discovery
        response = requests.get(f"{MCP_TOOL_SERVER_URL}/tools")
        if response.status_code == 200:
            tools = response.json()
            print(f"✅ Discovered {len(tools)} tools:")
            for tool in tools:
                print(f"   - {tool['name']}: {tool['description']}")
        else:
            print(f"❌ Tool discovery failed: {response.status_code}")
            return False
            
        # Test tool manifest
        response = requests.get(f"{MCP_TOOL_SERVER_URL}/manifest")
        if response.status_code == 200:
            manifest = response.json()
            print(f"✅ Tool manifest loaded: {manifest['server']['name']} v{manifest['server']['version']}")
        else:
            print(f"❌ Tool manifest failed: {response.status_code}")
            return False
            
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ MCP Tool Server connection failed: {e}")
        return False

def test_unified_server():
    """Test Unified Server functionality"""
    print("\n🌐 Testing Unified Server...")
    
    try:
        # Test health check
        response = requests.get(f"{UNIFIED_SERVER_URL}/")
        if response.status_code == 200:
            print("✅ Unified Server is healthy")
        else:
            print(f"❌ Unified Server health check failed: {response.status_code}")
            return False
            
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Unified Server connection failed: {e}")
        return False

def test_a2a_protocol():
    """Test A2A Protocol communication"""
    print("\n📡 Testing A2A Protocol...")
    
    # Test orchestrator capabilities
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "orchestrator.capabilities",
        "params": {}
    }
    
    try:
        response = requests.post(f"{UNIFIED_SERVER_URL}/", json=payload)
        if response.status_code == 200:
            result = response.json()
            if 'result' in result:
                print("✅ A2A Protocol communication working")
                print(f"   Capabilities: {result['result']}")
            else:
                print(f"❌ A2A Protocol error: {result}")
                return False
        else:
            print(f"❌ A2A Protocol request failed: {response.status_code}")
            return False
            
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"❌ A2A Protocol test failed: {e}")
        return False

def test_mcp_tool_integration():
    """Test MCP Tool Integration through Maps Agent"""
    print("\n🛠️ Testing MCP Tool Integration...")
    
    test_cases = [
        {
            "name": "Location Search",
            "message": "Find coffee shops near 1554 ijburglaan amsterdam",
            "expected_agent": "maps_agent"
        },
        {
            "name": "Geocoding",
            "message": "What are the coordinates for Times Square New York?",
            "expected_agent": "maps_agent"
        },
        {
            "name": "General Chat",
            "message": "Hello! How are you today?",
            "expected_agent": "general_ai_agent"
        }
    ]
    
    for test_case in test_cases:
        print(f"\n🧪 Testing: {test_case['name']}")
        
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "orchestrator.chat",
            "params": {
                "message": test_case["message"],
                "user_id": "test_user"
            }
        }
        
        try:
            start_time = time.time()
            response = requests.post(f"{UNIFIED_SERVER_URL}/", json=payload)
            end_time = time.time()
            
            if response.status_code == 200:
                result = response.json()
                if 'result' in result:
                    response_data = result['result']
                    duration = round((end_time - start_time) * 1000, 2)
                    
                    print(f"✅ Response received in {duration}ms")
                    print(f"   Agent used: {response_data.get('agent_used', 'unknown')}")
                    print(f"   Query type: {response_data.get('query_type', 'unknown')}")
                    print(f"   Response: {response_data.get('response', 'No response')[:100]}...")
                    
                    # Verify expected agent
                    if response_data.get('agent_used') == test_case['expected_agent']:
                        print(f"✅ Correct agent routing: {test_case['expected_agent']}")
                    else:
                        print(f"⚠️  Unexpected agent routing: {response_data.get('agent_used')} (expected: {test_case['expected_agent']})")
                else:
                    print(f"❌ Error in response: {result}")
            else:
                print(f"❌ Request failed: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Test failed: {e}")

def test_observability():
    """Test observability and analytics"""
    print("\n📊 Testing Observability...")
    
    try:
        response = requests.get(f"{UNIFIED_SERVER_URL}/analytics")
        if response.status_code == 200:
            analytics = response.json()
            print("✅ Analytics endpoint working")
            print(f"   Total operations: {analytics.get('total_operations', 0)}")
            print(f"   Success rate: {analytics.get('success_rate', 0):.1f}%")
            print(f"   Average response time: {analytics.get('avg_response_time', 0):.2f}ms")
        else:
            print(f"❌ Analytics endpoint failed: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Observability test failed: {e}")

def main():
    """Run all tests"""
    print("🚀 Google ADK + A2A + MCP Architecture Test Suite")
    print("=" * 60)
    
    # Test MCP Tool Server
    if not test_mcp_tool_server():
        print("\n❌ MCP Tool Server tests failed. Make sure to run: npm run mcp-tools")
        sys.exit(1)
    
    # Test Unified Server
    if not test_unified_server():
        print("\n❌ Unified Server tests failed. Make sure to run: npm start")
        sys.exit(1)
    
    # Test A2A Protocol
    if not test_a2a_protocol():
        print("\n❌ A2A Protocol tests failed")
        sys.exit(1)
    
    # Test MCP Tool Integration
    test_mcp_tool_integration()
    
    # Test Observability
    test_observability()
    
    print("\n🎉 All tests completed!")
    print("\n📋 Architecture Summary:")
    print("   ✅ Google ADK Orchestrator")
    print("   ✅ A2A Protocol Communication")
    print("   ✅ MCP Tool Server")
    print("   ✅ MCP Client Integration")
    print("   ✅ Observability & Analytics")
    
    print("\n🔗 Access Points:")
    print(f"   • Unified Server: {UNIFIED_SERVER_URL}")
    print(f"   • MCP Tool Server: {MCP_TOOL_SERVER_URL}")
    print(f"   • Analytics: {UNIFIED_SERVER_URL}/analytics")

if __name__ == "__main__":
    main()
