#!/usr/bin/env python3
"""
Comprehensive Intent Classification Test Suite
Tests 20 diverse examples to assess if the system correctly understands intent
"""

import requests
import json
import os
import time

RAILWAY_URL = os.environ.get("RAILWAY_URL", "http://localhost:3000/")

def call_orchestrator_chat(message, user_id="test_user"):
    """Call the orchestrator chat endpoint"""
    headers = {"Content-Type": "application/json"}
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "orchestrator.chat",
        "params": {"message": message, "user_id": user_id}
    }
    try:
        response = requests.post(RAILWAY_URL, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        return response.json()["result"]
    except requests.exceptions.RequestException as e:
        print(f"❌ Error: {e}")
        if e.response is not None:
            print(f"Response content: {e.response.text}")
        return {"error": str(e), "agent_used": "error"}

def run_intent_test(test_name, query, expected_agent, expected_intent_type, description):
    """Run a single intent classification test"""
    print(f"\n📋 {test_name}")
    print(f"🔍 Query: '{query}'")
    print(f"📝 Description: {description}")
    print(f"🎯 Expected: {expected_agent} | {expected_intent_type}")
    print("-" * 80)
    
    result = call_orchestrator_chat(query)
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
        return False
    
    actual_agent = result.get('agent_used', 'unknown')
    actual_type = result.get('query_type', 'unknown')
    response = result.get('response', 'No response')
    
    print(f"🤖 Actual Agent: {actual_agent}")
    print(f"📊 Actual Type: {actual_type}")
    print(f"💬 Response: {response[:100]}{'...' if len(response) > 100 else ''}")
    
    # Check if classification is correct
    agent_correct = actual_agent == expected_agent
    type_correct = actual_type == expected_intent_type
    
    if agent_correct and type_correct:
        print("✅ PASS - Intent correctly classified")
        return True
    else:
        print("❌ FAIL - Intent misclassified")
        if not agent_correct:
            print(f"   Agent mismatch: Expected {expected_agent}, got {actual_agent}")
        if not type_correct:
            print(f"   Type mismatch: Expected {expected_intent_type}, got {actual_type}")
        return False

def main():
    """Run comprehensive intent classification tests"""
    print("🧠 INTENT CLASSIFICATION TEST SUITE")
    print("=" * 80)
    
    # Give the server a moment to be ready
    print("⏳ Waiting for server to be ready...")
    time.sleep(5)
    
    # Test cases covering different intent types
    test_cases = [
        # Trip Planning Statements (should go to General AI)
        ("Test 1", "I am going to Paris", "general_ai_agent", "general", "Trip planning statement"),
        ("Test 2", "I'm planning to visit London", "general_ai_agent", "general", "Trip planning statement"),
        ("Test 3", "I'm traveling to Tokyo next week", "general_ai_agent", "general", "Trip planning with timeframe"),
        ("Test 4", "I'm heading to New York tomorrow", "general_ai_agent", "general", "Trip planning with urgency"),
        ("Test 5", "I'm visiting Amsterdam this weekend", "general_ai_agent", "general", "Trip planning with timeframe"),
        
        # Informational Statements (should go to General AI)
        ("Test 6", "I am currently in Berlin", "general_ai_agent", "general", "Location status statement"),
        ("Test 7", "I'm staying at a hotel in Rome", "general_ai_agent", "general", "Accommodation status"),
        ("Test 8", "I'm at the airport in Madrid", "general_ai_agent", "general", "Current location status"),
        
        # Explicit Search Requests (should go to Maps Agent)
        ("Test 9", "Find restaurants in Paris", "maps_agent", "location", "Explicit search request"),
        ("Test 10", "Search for coffee shops near me", "maps_agent", "location", "Search with proximity"),
        ("Test 11", "Show me hotels in London", "maps_agent", "location", "Search for specific service"),
        ("Test 12", "Find gas stations nearby", "maps_agent", "location", "Search for essential services"),
        
        # Geocoding Requests (should go to Maps Agent)
        ("Test 13", "What are the coordinates for Times Square?", "maps_agent", "location", "Explicit geocoding request"),
        ("Test 14", "Where is the Eiffel Tower located?", "maps_agent", "location", "Location lookup request"),
        ("Test 15", "Get me the address of Buckingham Palace", "maps_agent", "location", "Address lookup request"),
        
        # Directions Requests (should go to Maps Agent)
        ("Test 16", "How do I get from Paris to London?", "maps_agent", "location", "Explicit directions request"),
        ("Test 17", "Directions from Times Square to Central Park", "maps_agent", "location", "Specific directions"),
        ("Test 18", "What's the fastest route to the airport?", "maps_agent", "location", "Route optimization"),
        
        # General Conversation (should go to General AI)
        ("Test 19", "Hello, how are you today?", "general_ai_agent", "general", "Greeting and conversation"),
        ("Test 20", "Tell me about the weather in Tokyo", "general_ai_agent", "general", "Weather information request"),
    ]
    
    passed_tests = 0
    total_tests = len(test_cases)
    failed_tests = []
    
    print(f"🚀 Running {total_tests} intent classification tests...")
    print("=" * 80)
    
    for test_name, query, expected_agent, expected_type, description in test_cases:
        success = run_intent_test(test_name, query, expected_agent, expected_type, description)
        if success:
            passed_tests += 1
        else:
            failed_tests.append((test_name, query, expected_agent, expected_type))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 INTENT CLASSIFICATION TEST RESULTS")
    print("=" * 80)
    print(f"✅ Passed: {passed_tests}/{total_tests}")
    print(f"❌ Failed: {total_tests - passed_tests}/{total_tests}")
    print(f"📈 Success Rate: {(passed_tests / total_tests * 100):.1f}%")
    
    if failed_tests:
        print(f"\n🔍 FAILED TESTS ANALYSIS:")
        for test_name, query, expected_agent, expected_type in failed_tests:
            print(f"  ❌ {test_name}: '{query}' → Expected {expected_agent} | {expected_type}")
    
    if passed_tests == total_tests:
        print("\n🎉 All tests passed! Intent classification is working perfectly.")
        return True
    else:
        print(f"\n⚠️  {total_tests - passed_tests} tests failed. Intent classification needs improvement.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
