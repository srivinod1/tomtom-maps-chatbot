#!/usr/bin/env python3
"""
Test Vertex AI Observability Integration
"""

import requests
import json
import time

def test_tool_calling_observability():
    """Test tool calling with observability"""
    
    print("🔍 Testing Vertex AI Tool Calling Observability")
    print("=" * 60)
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    
    # Test cases for different tool calls
    test_cases = [
        {
            "name": "Location Search",
            "message": "Find restaurants near me",
            "expected_tool": "search_places"
        },
        {
            "name": "Geocoding",
            "message": "What are the coordinates for 123 Main Street Seattle?",
            "expected_tool": "geocode_address"
        },
        {
            "name": "General Chat",
            "message": "Hello! How are you?",
            "expected_tool": "general_ai"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 Test {i}: {test_case['name']}")
        print("-" * 40)
        
        try:
            # Make the request
            response = requests.post(f"{base_url}/", json={
                "jsonrpc": "2.0",
                "id": i,
                "method": "orchestrator.chat",
                "params": {
                    "message": test_case["message"],
                    "user_id": f"test_user_{i}"
                }
            }, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                if "result" in data:
                    result = data["result"]
                    print(f"✅ Success: {result.get('agent_used', 'unknown')} agent")
                    print(f"   Query Type: {result.get('query_type', 'unknown')}")
                    print(f"   Response: {result.get('response', '')[:100]}...")
                else:
                    print(f"❌ Error: {data.get('error', 'Unknown error')}")
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Request Error: {e}")
        
        # Wait between requests to see observability in action
        time.sleep(2)
    
    # Test analytics endpoint
    print(f"\n📊 Testing Analytics Endpoint")
    print("-" * 40)
    
    try:
        response = requests.get(f"{base_url}/analytics", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                analytics = data.get("analytics", {})
                print("✅ Analytics Retrieved:")
                print(f"   Total Calls: {analytics.get('totalCalls', 0)}")
                print(f"   Successful: {analytics.get('successfulCalls', 0)}")
                print(f"   Failed: {analytics.get('failedCalls', 0)}")
                print(f"   Error Rate: {analytics.get('errorRate', 0):.2f}%")
                print(f"   Avg Duration: {analytics.get('averageDuration', 0):.2f}ms")
                print(f"   Tool Breakdown: {analytics.get('toolBreakdown', {})}")
            else:
                print(f"❌ Analytics Error: {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ Analytics HTTP Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Analytics Request Error: {e}")

def test_health_endpoints():
    """Test all health and status endpoints"""
    
    print(f"\n🏥 Testing Health Endpoints")
    print("=" * 60)
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    endpoints = [
        ("/", "Health Check"),
        ("/agents", "Agent Discovery"),
        ("/analytics", "Analytics")
    ]
    
    for endpoint, name in endpoints:
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=10)
            if response.status_code == 200:
                print(f"✅ {name}: OK")
            else:
                print(f"❌ {name}: HTTP {response.status_code}")
        except Exception as e:
            print(f"❌ {name}: Error - {e}")

def main():
    """Main test function"""
    
    print("🚀 Vertex AI Observability Test Suite")
    print("=" * 60)
    
    # Test health endpoints first
    test_health_endpoints()
    
    # Test tool calling with observability
    test_tool_calling_observability()
    
    print(f"\n🏁 Test Complete!")
    print("=" * 60)
    print("📝 Check Google Cloud Console for:")
    print("   - Cloud Logging: tomtom-mcp-tool-calls")
    print("   - Cloud Monitoring: Custom metrics")
    print("   - Cloud Trace: Tool call traces")

if __name__ == "__main__":
    main()
