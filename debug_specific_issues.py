#!/usr/bin/env python3
"""
Debug specific issues found in the 10 example tests
"""

import requests
import json
import time

SERVER_URL = "http://localhost:3000"

def test_query(query, description):
    """Test a single query and return detailed results"""
    print(f"\n🔍 Testing: '{query}'")
    print(f"📝 Description: {description}")
    print("-" * 80)
    
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
            return result['result']
        else:
            print(f"❌ Error: {result}")
            return None
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return None

def main():
    print("🐛 Debugging Specific Issues")
    print("=" * 80)
    
    # Wait for server
    time.sleep(2)
    
    # Test cases for specific issues
    test_cases = [
        {
            "query": "Tell me about the weather in Tokyo",
            "description": "Weather query should go to General AI Agent, not Maps Agent"
        },
        {
            "query": "What is the weather like today?",
            "description": "General weather query should go to General AI Agent"
        },
        {
            "query": "Where is 1600 Pennsylvania Avenue NW, Washington DC?",
            "description": "Specific White House address should return Washington DC coordinates"
        },
        {
            "query": "Find restaurants near Golden Gate Bridge in San Francisco",
            "description": "Should find restaurants near the actual Golden Gate Bridge in SF"
        },
        {
            "query": "What's the travel time matrix between Empire State Building, Statue of Liberty, and One World Trade Center?",
            "description": "Should parse 3 separate locations correctly"
        },
        {
            "query": "Compare travel times from Times Square to both Central Park and Brooklyn Bridge",
            "description": "Should parse 'both A and B' pattern correctly"
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Debug Test {i}")
        result = test_query(test_case['query'], test_case['description'])
        results.append({
            "test": i,
            "query": test_case['query'],
            "result": result,
            "description": test_case['description']
        })
        time.sleep(1)
    
    # Analysis
    print("\n" + "=" * 80)
    print("📊 ISSUE ANALYSIS")
    print("=" * 80)
    
    for result in results:
        if result['result']:
            agent = result['result']['agent_used']
            query_type = result['result']['query_type']
            
            print(f"\n🔍 Test {result['test']}: {result['description']}")
            print(f"   Agent: {agent} | Type: {query_type}")
            
            # Check for specific issues
            if "weather" in result['query'].lower() and agent != "general_ai_agent":
                print("   ❌ ISSUE: Weather query misclassified as location-based")
            elif "1600 Pennsylvania" in result['query'] and "Dallas" in result['result']['response']:
                print("   ❌ ISSUE: White House address returning Dallas instead of Washington DC")
            elif "Golden Gate" in result['query'] and "Dallas" in result['result']['response']:
                print("   ❌ ISSUE: Golden Gate Bridge search returning Dallas results")
            elif "matrix" in result['query'] and "to One World Trade Center" in result['result']['response']:
                print("   ❌ ISSUE: Matrix routing not parsing multiple locations correctly")
            else:
                print("   ✅ No obvious issues detected")

if __name__ == "__main__":
    main()
