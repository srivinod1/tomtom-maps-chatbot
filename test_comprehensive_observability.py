#!/usr/bin/env python3
"""
Test Comprehensive Vertex AI Observability
Tests all agents, tools, protocols, and operations
"""

import requests
import json
import time
import random

def test_comprehensive_observability():
    """Test comprehensive observability across all components"""
    
    print("🔍 Testing Comprehensive Vertex AI Observability")
    print("=" * 70)
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    
    # Test cases covering all components
    test_cases = [
        # Orchestrator Agent Tests
        {
            "name": "Orchestrator - Location Query",
            "message": "Find restaurants near me",
            "expected_components": ["orchestrator", "mapsAgent", "tomtomApi"]
        },
        {
            "name": "Orchestrator - General Chat",
            "message": "Hello! How are you today?",
            "expected_components": ["orchestrator", "llmCalls"]
        },
        {
            "name": "Orchestrator - Geocoding Query",
            "message": "What are the coordinates for 123 Main Street Seattle?",
            "expected_components": ["orchestrator", "mapsAgent", "tomtomApi"]
        },
        {
            "name": "Orchestrator - Context Memory",
            "message": "My location is 1554 IJburglaan Amsterdam",
            "expected_components": ["orchestrator"]
        },
        {
            "name": "Orchestrator - Follow-up Query",
            "message": "Find the 3 closest restaurants to this place",
            "expected_components": ["orchestrator", "mapsAgent", "tomtomApi"]
        },
        # Maps Agent Tests
        {
            "name": "Maps Agent - Search Places",
            "message": "Search for coffee shops near downtown",
            "expected_components": ["orchestrator", "mapsAgent", "tomtomApi"]
        },
        {
            "name": "Maps Agent - Reverse Geocoding",
            "message": "What address is at coordinates 47.6062, -122.3321?",
            "expected_components": ["orchestrator", "mapsAgent", "tomtomApi"]
        },
        # LLM Integration Tests
        {
            "name": "LLM - OpenAI Integration",
            "message": "Explain how GPS coordinates work",
            "expected_components": ["orchestrator", "llmCalls"]
        },
        {
            "name": "LLM - Anthropic Integration",
            "message": "What are the benefits of using maps in applications?",
            "expected_components": ["orchestrator", "llmCalls"]
        },
        # Error Handling Tests
        {
            "name": "Error Handling - Invalid Query",
            "message": "asdfghjklqwertyuiop",
            "expected_components": ["orchestrator", "llmCalls"]
        }
    ]
    
    print(f"\n🧪 Running {len(test_cases)} comprehensive test cases...")
    print("-" * 70)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Test {i}: {test_case['name']}")
        print(f"   Message: {test_case['message']}")
        print(f"   Expected Components: {', '.join(test_case['expected_components'])}")
        
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
                    print(f"   ✅ Success: {result.get('agent_used', 'unknown')} agent")
                    print(f"   📊 Query Type: {result.get('query_type', 'unknown')}")
                    print(f"   💬 Response: {result.get('response', '')[:100]}...")
                else:
                    print(f"   ❌ Error: {data.get('error', 'Unknown error')}")
            else:
                print(f"   ❌ HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ Request Error: {e}")
        
        # Wait between requests to see observability in action
        time.sleep(2)
    
    # Test analytics endpoint
    print(f"\n📊 Testing Comprehensive Analytics")
    print("-" * 70)
    
    try:
        response = requests.get(f"{base_url}/analytics", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                analytics = data.get("analytics", {})
                print("✅ Comprehensive Analytics Retrieved:")
                
                # Orchestrator analytics
                orchestrator = analytics.get("orchestrator", {})
                print(f"   🎯 Orchestrator:")
                print(f"      Total Operations: {orchestrator.get('totalOperations', 0)}")
                print(f"      Successful: {orchestrator.get('successfulOperations', 0)}")
                print(f"      Failed: {orchestrator.get('failedOperations', 0)}")
                print(f"      Error Rate: {orchestrator.get('errorRate', 0):.2f}%")
                print(f"      Avg Duration: {orchestrator.get('averageDuration', 0):.2f}ms")
                
                # Maps Agent analytics
                mapsAgent = analytics.get("mapsAgent", {})
                print(f"   🗺️  Maps Agent:")
                print(f"      Total Tools: {mapsAgent.get('totalTools', 0)}")
                print(f"      Successful: {mapsAgent.get('successfulTools', 0)}")
                print(f"      Failed: {mapsAgent.get('failedTools', 0)}")
                print(f"      Error Rate: {mapsAgent.get('errorRate', 0):.2f}%")
                print(f"      Tool Breakdown: {mapsAgent.get('toolBreakdown', {})}")
                
                # LLM analytics
                llmCalls = analytics.get("llmCalls", {})
                print(f"   🤖 LLM Calls:")
                print(f"      Total Calls: {llmCalls.get('totalCalls', 0)}")
                print(f"      Successful: {llmCalls.get('successfulCalls', 0)}")
                print(f"      Total Tokens: {llmCalls.get('totalTokens', 0)}")
                print(f"      Provider Breakdown: {llmCalls.get('providerBreakdown', {})}")
                
                # TomTom API analytics
                tomtomApi = analytics.get("tomtomApi", {})
                print(f"   🌐 TomTom API:")
                print(f"      Total Calls: {tomtomApi.get('totalCalls', 0)}")
                print(f"      Successful: {tomtomApi.get('successfulCalls', 0)}")
                print(f"      Error Rate: {tomtomApi.get('errorRate', 0):.2f}%")
                print(f"      Endpoint Breakdown: {tomtomApi.get('endpointBreakdown', {})}")
                
                # A2A Protocol analytics
                a2aProtocol = analytics.get("a2aProtocol", {})
                print(f"   🤝 A2A Protocol:")
                print(f"      Total Messages: {a2aProtocol.get('totalMessages', 0)}")
                print(f"      Successful: {a2aProtocol.get('successfulMessages', 0)}")
                print(f"      Error Rate: {a2aProtocol.get('errorRate', 0):.2f}%")
                
                # MCP Protocol analytics
                mcpProtocol = analytics.get("mcpProtocol", {})
                print(f"   🔧 MCP Protocol:")
                print(f"      Total Operations: {mcpProtocol.get('totalOperations', 0)}")
                print(f"      Successful: {mcpProtocol.get('successfulOperations', 0)}")
                print(f"      Error Rate: {mcpProtocol.get('errorRate', 0):.2f}%")
                
                # System Events analytics
                systemEvents = analytics.get("systemEvents", {})
                print(f"   ⚙️  System Events:")
                print(f"      Total Events: {systemEvents.get('totalEvents', 0)}")
                print(f"      Event Breakdown: {systemEvents.get('eventBreakdown', {})}")
                
                # Overall analytics
                overall = analytics.get("overall", {})
                print(f"   📈 Overall:")
                print(f"      Total Operations: {overall.get('totalOperations', 0)}")
                print(f"      Error Rate: {overall.get('errorRate', 0):.2f}%")
                
            else:
                print(f"❌ Analytics Error: {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ Analytics HTTP Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Analytics Request Error: {e}")

def test_health_endpoints():
    """Test all health and status endpoints"""
    
    print(f"\n🏥 Testing Health Endpoints")
    print("=" * 70)
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    endpoints = [
        ("/", "Health Check"),
        ("/agents", "Agent Discovery"),
        ("/analytics", "Comprehensive Analytics")
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

def test_performance_metrics():
    """Test performance under load"""
    
    print(f"\n⚡ Testing Performance Metrics")
    print("=" * 70)
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    
    # Performance test queries
    performance_queries = [
        "Find restaurants near me",
        "What are the coordinates for Times Square?",
        "Hello, how are you?",
        "Search for coffee shops",
        "Explain GPS technology"
    ]
    
    print(f"🚀 Running {len(performance_queries)} performance tests...")
    
    start_time = time.time()
    successful_requests = 0
    failed_requests = 0
    
    for i, query in enumerate(performance_queries):
        try:
            response = requests.post(f"{base_url}/", json={
                "jsonrpc": "2.0",
                "id": i + 100,
                "method": "orchestrator.chat",
                "params": {
                    "message": query,
                    "user_id": f"perf_test_{i}"
                }
            }, timeout=15)
            
            if response.status_code == 200:
                successful_requests += 1
                print(f"   ✅ Query {i+1}: {query[:30]}...")
            else:
                failed_requests += 1
                print(f"   ❌ Query {i+1}: HTTP {response.status_code}")
                
        except Exception as e:
            failed_requests += 1
            print(f"   ❌ Query {i+1}: Error - {e}")
        
        # Small delay between requests
        time.sleep(0.5)
    
    total_time = time.time() - start_time
    total_requests = successful_requests + failed_requests
    
    print(f"\n📊 Performance Results:")
    print(f"   Total Requests: {total_requests}")
    print(f"   Successful: {successful_requests}")
    print(f"   Failed: {failed_requests}")
    print(f"   Success Rate: {(successful_requests/total_requests)*100:.2f}%")
    print(f"   Total Time: {total_time:.2f}s")
    print(f"   Avg Response Time: {total_time/total_requests:.2f}s per request")

def main():
    """Main test function"""
    
    print("🚀 Comprehensive Vertex AI Observability Test Suite")
    print("=" * 70)
    
    # Test health endpoints first
    test_health_endpoints()
    
    # Test comprehensive observability
    test_comprehensive_observability()
    
    # Test performance metrics
    test_performance_metrics()
    
    print(f"\n🏁 Comprehensive Test Complete!")
    print("=" * 70)
    print("📝 Check Google Cloud Console for:")
    print("   - Cloud Logging: All component logs")
    print("   - Cloud Monitoring: Custom metrics and dashboards")
    print("   - Cloud Trace: Distributed tracing")
    print("   - Analytics API: Real-time system health")

if __name__ == "__main__":
    main()
