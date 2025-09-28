#!/usr/bin/env python3
"""
Test script for the Enhanced Multi-Agent Architecture
Tests the 5-agent framework: Planner → Researcher → Writer → Reviewer → Supervisor
"""

import requests
import json
import time
import sys

# Configuration
ENHANCED_ORCHESTRATOR_URL = "http://localhost:3000"
MCP_TOOL_SERVER_URL = "http://localhost:3003"
USER_ID_PREFIX = "enhanced_test_user_"

def send_jsonrpc_message(url, method, params):
    """Send JSON-RPC message to the enhanced orchestrator"""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params
    }
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Error sending message to {url} for method {method}: {e}")
        if e.response:
            print(f"Response: {e.response.text}")
        return {"error": str(e)}

def get_health(url):
    """Check health of a service"""
    try:
        response = requests.get(f"{url}/", timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"status": "unhealthy", "error": str(e)}

def get_mcp_health(url):
    """Check health of MCP tool server"""
    try:
        response = requests.get(f"{url}/health", timeout=5)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"status": "unhealthy", "error": str(e)}

def test_enhanced_architecture():
    """Test the complete enhanced multi-agent architecture"""
    print("🚀 Enhanced Multi-Agent Architecture Test Suite")
    print("=" * 60)
    print("Testing: Planner → Researcher → Writer → Reviewer → Supervisor")
    print("=" * 60)

    # Test 1: Health Checks
    print("\n🔍 Testing Service Health...")
    
    # Check MCP Tool Server
    mcp_health = get_mcp_health(MCP_TOOL_SERVER_URL)
    if mcp_health.get("status") == "healthy":
        print("✅ MCP Tool Server is healthy")
    else:
        print(f"❌ MCP Tool Server failed: {mcp_health.get('error', 'Unknown error')}")
        print("   Make sure to run: npm run mcp-tools")
        return False

    # Check Enhanced Orchestrator
    orchestrator_health = get_health(ENHANCED_ORCHESTRATOR_URL)
    if orchestrator_health.get("status") == "healthy":
        print("✅ Enhanced Orchestrator is healthy")
        print(f"   Agents: {orchestrator_health.get('agents', [])}")
    else:
        print(f"❌ Enhanced Orchestrator failed: {orchestrator_health.get('error', 'Unknown error')}")
        print("   Make sure to run: node src/enhanced-orchestrator.js")
        return False

    # Test 2: Capabilities
    print("\n🔧 Testing Capabilities...")
    capabilities_response = send_jsonrpc_message(ENHANCED_ORCHESTRATOR_URL, "orchestrator.capabilities", {})
    if capabilities_response and capabilities_response.get("result"):
        capabilities = capabilities_response["result"]
        print("✅ Capabilities retrieved successfully")
        print(f"   Capabilities: {capabilities.get('capabilities', [])}")
        print(f"   Agents: {capabilities.get('agents', [])}")
        print(f"   Features: {capabilities.get('features', [])}")
    else:
        print(f"❌ Capabilities failed: {capabilities_response.get('error', 'Unknown error')}")

    # Test 3: Location Search (Full 5-Agent Workflow)
    print("\n🧪 Testing Location Search (5-Agent Workflow)...")
    user_id_1 = USER_ID_PREFIX + "1"
    query_1 = "Find coffee shops near 1554 ijburglaan amsterdam"
    
    print(f"   Query: {query_1}")
    start_time = time.time()
    
    response_1 = send_jsonrpc_message(ENHANCED_ORCHESTRATOR_URL, "orchestrator.chat", {
        "message": query_1,
        "user_id": user_id_1
    })
    
    end_time = time.time()
    duration_1 = round((end_time - start_time) * 1000, 2)
    
    if response_1 and response_1.get("result"):
        result_1 = response_1["result"]
        print(f"✅ Response received in {duration_1}ms")
        print(f"   Agent used: {result_1.get('agent_used')}")
        print(f"   Query type: {result_1.get('query_type')}")
        print(f"   Steps executed: {result_1.get('steps_executed', 0)}")
        print(f"   Success: {result_1.get('success')}")
        print(f"   Response: {result_1.get('response', '')[:200]}...")
        
        # Check if execution plan was created
        if result_1.get('execution_plan'):
            plan = result_1['execution_plan']
            print(f"   Execution plan: {plan.get('plan_id')} with {len(plan.get('steps', []))} steps")
            print(f"   Complexity: {plan.get('complexity')}")
            print(f"   Estimated duration: {plan.get('estimated_duration')}s")
    else:
        print(f"❌ Location search failed: {response_1.get('error', 'Unknown error')}")

    # Test 4: Geocoding (5-Agent Workflow)
    print("\n🧪 Testing Geocoding (5-Agent Workflow)...")
    user_id_2 = USER_ID_PREFIX + "2"
    query_2 = "What are the coordinates for Times Square New York?"
    
    print(f"   Query: {query_2}")
    start_time = time.time()
    
    response_2 = send_jsonrpc_message(ENHANCED_ORCHESTRATOR_URL, "orchestrator.chat", {
        "message": query_2,
        "user_id": user_id_2
    })
    
    end_time = time.time()
    duration_2 = round((end_time - start_time) * 1000, 2)
    
    if response_2 and response_2.get("result"):
        result_2 = response_2["result"]
        print(f"✅ Response received in {duration_2}ms")
        print(f"   Agent used: {result_2.get('agent_used')}")
        print(f"   Query type: {result_2.get('query_type')}")
        print(f"   Steps executed: {result_2.get('steps_executed', 0)}")
        print(f"   Success: {result_2.get('success')}")
        print(f"   Response: {result_2.get('response', '')[:200]}...")
    else:
        print(f"❌ Geocoding failed: {response_2.get('error', 'Unknown error')}")

    # Test 5: General Conversation (5-Agent Workflow)
    print("\n🧪 Testing General Conversation (5-Agent Workflow)...")
    user_id_3 = USER_ID_PREFIX + "3"
    query_3 = "Hello! How are you today?"
    
    print(f"   Query: {query_3}")
    start_time = time.time()
    
    response_3 = send_jsonrpc_message(ENHANCED_ORCHESTRATOR_URL, "orchestrator.chat", {
        "message": query_3,
        "user_id": user_id_3
    })
    
    end_time = time.time()
    duration_3 = round((end_time - start_time) * 1000, 2)
    
    if response_3 and response_3.get("result"):
        result_3 = response_3["result"]
        print(f"✅ Response received in {duration_3}ms")
        print(f"   Agent used: {result_3.get('agent_used')}")
        print(f"   Query type: {result_3.get('query_type')}")
        print(f"   Steps executed: {result_3.get('steps_executed', 0)}")
        print(f"   Success: {result_3.get('success')}")
        print(f"   Response: {result_3.get('response', '')[:200]}...")
    else:
        print(f"❌ General conversation failed: {response_3.get('error', 'Unknown error')}")

    # Test 6: Context Memory
    print("\n🧪 Testing Context Memory...")
    user_id_4 = USER_ID_PREFIX + "4"
    
    # First message
    query_4a = "Find restaurants near 1554 ijburglaan amsterdam"
    print(f"   Query 1: {query_4a}")
    response_4a = send_jsonrpc_message(ENHANCED_ORCHESTRATOR_URL, "orchestrator.chat", {
        "message": query_4a,
        "user_id": user_id_4
    })
    
    if response_4a and response_4a.get("result"):
        print("✅ First query processed")
        
        # Follow-up message
        query_4b = "What are the 3 closest ones?"
        print(f"   Query 2: {query_4b}")
        response_4b = send_jsonrpc_message(ENHANCED_ORCHESTRATOR_URL, "orchestrator.chat", {
            "message": query_4b,
            "user_id": user_id_4
        })
        
        if response_4b and response_4b.get("result"):
            result_4b = response_4b["result"]
            print(f"✅ Follow-up query processed")
            print(f"   Response: {result_4b.get('response', '')[:200]}...")
        else:
            print(f"❌ Follow-up query failed: {response_4b.get('error', 'Unknown error')}")
    else:
        print(f"❌ First query failed: {response_4a.get('error', 'Unknown error')}")

    # Test 7: Analytics
    print("\n📊 Testing Analytics...")
    try:
        analytics_response = requests.get(f"{ENHANCED_ORCHESTRATOR_URL}/analytics", timeout=10)
        if analytics_response.status_code == 200:
            analytics_data = analytics_response.json()
            print("✅ Analytics endpoint working")
            print(f"   Total operations: {analytics_data.get('totalOperations', 0)}")
            print(f"   Success rate: {analytics_data.get('successRate', 0.0)}%")
            print(f"   Average response time: {analytics_data.get('averageResponseTime', 0.00)}ms")
        else:
            print(f"❌ Analytics endpoint failed: {analytics_response.status_code}")
    except Exception as e:
        print(f"❌ Analytics error: {e}")

    print("\n🎉 Enhanced Architecture Test Suite Completed!")
    print("\n📋 Architecture Summary:")
    print("   ✅ Planner Agent: Request decomposition")
    print("   ✅ Researcher Agent: Evidence gathering via MCP")
    print("   ✅ Writer Agent: Response synthesis")
    print("   ✅ Reviewer Agent: Quality control")
    print("   ✅ Supervisor Agent: Budget enforcement & risk management")
    print("   ✅ Enhanced Orchestrator: Workflow coordination")
    print("   ✅ MCP Tool Server: External API integration")
    print("   ✅ Observability: Comprehensive monitoring")

    print("\n🔗 Access Points:")
    print(f"   • Enhanced Orchestrator: {ENHANCED_ORCHESTRATOR_URL}")
    print(f"   • MCP Tool Server: {MCP_TOOL_SERVER_URL}")
    print(f"   • Analytics: {ENHANCED_ORCHESTRATOR_URL}/analytics")

    return True

if __name__ == "__main__":
    success = test_enhanced_architecture()
    sys.exit(0 if success else 1)
