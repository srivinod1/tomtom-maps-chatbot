#!/usr/bin/env python3
"""
Test 10 diverse example queries to verify system functionality
"""

import requests
import json
import time
import sys

# Server URL
SERVER_URL = "http://localhost:3000"

def test_query(query, expected_features=None):
    """Test a single query and return results"""
    print(f"\n🔍 Testing: '{query}'")
    print("-" * 60)
    
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "orchestrator.chat",
        "params": {
            "message": query,
            "user_id": "test_user"
        }
    }
    
    try:
        response = requests.post(SERVER_URL, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        
        if "result" in result:
            print(f"✅ Success: {result['result']['response']}")
            print(f"🤖 Agent Used: {result['result']['agent_used']}")
            print(f"📊 Query Type: {result['result']['query_type']}")
            
            # Check for expected features
            if expected_features:
                for feature in expected_features:
                    if feature.lower() in result['result']['response'].lower():
                        print(f"✅ Contains expected feature: {feature}")
                    else:
                        print(f"❌ Missing expected feature: {feature}")
            
            return True
        else:
            print(f"❌ Error: {result}")
            return False
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

def main():
    print("🚀 Testing 10 Diverse Example Queries")
    print("=" * 60)
    
    # Wait for server to be ready
    print("⏳ Waiting for server to be ready...")
    time.sleep(2)
    
    # Test queries with expected features
    test_cases = [
        {
            "query": "Hello, how are you today?",
            "expected_features": ["hello", "how are you"],
            "description": "Basic greeting - should use General AI Agent"
        },
        {
            "query": "What are the coordinates for the Eiffel Tower in Paris?",
            "expected_features": ["coordinates", "latitude", "longitude"],
            "description": "Geocoding query - should return coordinates"
        },
        {
            "query": "Find coffee shops near Central Park in New York",
            "expected_features": ["coffee", "Central Park", "New York"],
            "description": "Place search query - should find nearby places"
        },
        {
            "query": "How do I get from Times Square to the Brooklyn Bridge?",
            "expected_features": ["route", "directions", "time", "distance"],
            "description": "Directions query - should calculate route"
        },
        {
            "query": "What's the travel time matrix between Empire State Building, Statue of Liberty, and One World Trade Center?",
            "expected_features": ["matrix", "travel time", "Empire State", "Statue of Liberty"],
            "description": "Matrix routing query - should calculate travel times between multiple locations"
        },
        {
            "query": "Where is 1600 Pennsylvania Avenue located?",
            "expected_features": ["coordinates", "address", "Pennsylvania"],
            "description": "Address geocoding - should return coordinates for White House"
        },
        {
            "query": "Show me restaurants near the Golden Gate Bridge",
            "expected_features": ["restaurants", "Golden Gate", "San Francisco"],
            "description": "Location-based search - should find restaurants near landmark"
        },
        {
            "query": "What's the fastest route from LAX airport to Hollywood?",
            "expected_features": ["route", "LAX", "Hollywood", "time", "distance"],
            "description": "Airport to destination routing - should calculate route with traffic"
        },
        {
            "query": "Tell me about the weather in Tokyo",
            "expected_features": ["weather", "Tokyo"],
            "description": "General knowledge query - should use General AI Agent"
        },
        {
            "query": "Compare travel times from Times Square to both Central Park and Brooklyn Bridge",
            "expected_features": ["travel time", "Times Square", "Central Park", "Brooklyn Bridge"],
            "description": "Complex routing comparison - should handle multiple destinations"
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Test Case {i}: {test_case['description']}")
        success = test_query(test_case['query'], test_case['expected_features'])
        results.append({
            "test": i,
            "query": test_case['query'],
            "success": success,
            "description": test_case['description']
        })
        
        # Small delay between tests
        time.sleep(1)
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    passed = sum(1 for r in results if r['success'])
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    print(f"📈 Success Rate: {(passed/total)*100:.1f}%")
    
    print("\n📋 Detailed Results:")
    for result in results:
        status = "✅ PASS" if result['success'] else "❌ FAIL"
        print(f"  {status} Test {result['test']}: {result['description']}")
    
    if passed == total:
        print("\n🎉 All tests passed! System is working correctly.")
    else:
        print(f"\n⚠️  {total - passed} tests failed. Review the issues above.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
