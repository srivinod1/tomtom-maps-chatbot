#!/usr/bin/env python3
"""
Intent Classification Edge Cases Test Suite
Tests problematic scenarios and edge cases for intent classification
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

def run_edge_case_test(test_name, query, expected_agent, expected_intent_type, description, check_response_content=None):
    """Run a single edge case test"""
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
    print(f"💬 Response: {response[:200]}{'...' if len(response) > 200 else ''}")
    
    # Check if classification is correct
    agent_correct = actual_agent == expected_agent
    type_correct = actual_type == expected_intent_type
    
    # Check response content if specified
    content_correct = True
    if check_response_content:
        for check in check_response_content:
            if check['type'] == 'contains':
                if check['text'].lower() not in response.lower():
                    content_correct = False
                    print(f"❌ Response missing expected content: '{check['text']}'")
            elif check['type'] == 'not_contains':
                if check['text'].lower() in response.lower():
                    content_correct = False
                    print(f"❌ Response contains unexpected content: '{check['text']}'")
    
    if agent_correct and type_correct and content_correct:
        print("✅ PASS - Intent correctly classified and response appropriate")
        return True
    else:
        print("❌ FAIL - Intent misclassified or response inappropriate")
        if not agent_correct:
            print(f"   Agent mismatch: Expected {expected_agent}, got {actual_agent}")
        if not type_correct:
            print(f"   Type mismatch: Expected {expected_intent_type}, got {actual_type}")
        return False

def main():
    """Run edge case intent classification tests"""
    print("🧠 INTENT CLASSIFICATION EDGE CASES TEST SUITE")
    print("=" * 80)
    
    # Give the server a moment to be ready
    print("⏳ Waiting for server to be ready...")
    time.sleep(5)
    
    # Edge case test cases
    test_cases = [
        # Ambiguous trip planning vs search
        ("Edge 1", "I want to go to Paris", "general_ai_agent", "general", "Ambiguous trip planning statement", None),
        ("Edge 2", "I need to go to London", "general_ai_agent", "general", "Ambiguous trip planning statement", None),
        ("Edge 3", "I'm going to Tokyo for business", "general_ai_agent", "general", "Trip planning with purpose", None),
        
        # Location-specific queries that should use geobias
        ("Edge 4", "Find coffee shops near me", "maps_agent", "location", "Search with proximity - should use geobias", [
            {"type": "not_contains", "text": "Seattle"}
        ]),
        ("Edge 5", "Where is the Eiffel Tower?", "maps_agent", "location", "Famous landmark - should return Paris coordinates", [
            {"type": "contains", "text": "Paris"},
            {"type": "not_contains", "text": "Hackensack"}
        ]),
        ("Edge 6", "Get coordinates for Buckingham Palace", "maps_agent", "location", "Famous landmark - should return London coordinates", [
            {"type": "contains", "text": "London"},
            {"type": "not_contains", "text": "Hackensack"}
        ]),
        
        # Weather queries with locations (should go to General AI)
        ("Edge 7", "What's the weather like in Paris?", "general_ai_agent", "general", "Weather query with location", None),
        ("Edge 8", "Is it raining in London?", "general_ai_agent", "general", "Weather query with location", None),
        ("Edge 9", "How's the weather in Tokyo?", "general_ai_agent", "general", "Weather query with location", None),
        
        # Mixed intent queries
        ("Edge 10", "I'm going to Paris, can you help me plan?", "general_ai_agent", "general", "Trip planning with help request", None),
        ("Edge 11", "I'm visiting London, what should I see?", "general_ai_agent", "general", "Trip planning with sightseeing question", None),
        ("Edge 12", "I'm traveling to Tokyo, any recommendations?", "general_ai_agent", "general", "Trip planning with recommendations request", None),
        
        # Explicit search vs trip planning
        ("Edge 13", "Show me what's in Paris", "maps_agent", "location", "Ambiguous search request", None),
        ("Edge 14", "What can I do in London?", "maps_agent", "location", "Ambiguous search request", None),
        ("Edge 15", "Tell me about Tokyo", "general_ai_agent", "general", "General information request", None),
        
        # Context-dependent queries
        ("Edge 16", "I'm going there tomorrow", "general_ai_agent", "general", "Context-dependent trip planning", None),
        ("Edge 17", "How do I get there?", "maps_agent", "location", "Context-dependent directions", None),
        ("Edge 18", "What's near there?", "maps_agent", "location", "Context-dependent search", None),
        
        # Complex queries
        ("Edge 19", "I'm planning a trip to Paris and London", "general_ai_agent", "general", "Multi-city trip planning", None),
        ("Edge 20", "Find restaurants in Paris and London", "maps_agent", "location", "Multi-city search request", None),
    ]
    
    passed_tests = 0
    total_tests = len(test_cases)
    failed_tests = []
    
    print(f"🚀 Running {total_tests} edge case intent classification tests...")
    print("=" * 80)
    
    for test_name, query, expected_agent, expected_type, description, check_content in test_cases:
        success = run_edge_case_test(test_name, query, expected_agent, expected_type, description, check_content)
        if success:
            passed_tests += 1
        else:
            failed_tests.append((test_name, query, expected_agent, expected_type))
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 EDGE CASE INTENT CLASSIFICATION TEST RESULTS")
    print("=" * 80)
    print(f"✅ Passed: {passed_tests}/{total_tests}")
    print(f"❌ Failed: {total_tests - passed_tests}/{total_tests}")
    print(f"📈 Success Rate: {(passed_tests / total_tests * 100):.1f}%")
    
    if failed_tests:
        print(f"\n🔍 FAILED TESTS ANALYSIS:")
        for test_name, query, expected_agent, expected_type in failed_tests:
            print(f"  ❌ {test_name}: '{query}' → Expected {expected_agent} | {expected_type}")
    
    if passed_tests == total_tests:
        print("\n🎉 All edge case tests passed! Intent classification is robust.")
        return True
    else:
        print(f"\n⚠️  {total_tests - passed_tests} edge case tests failed. Intent classification needs improvement.")
        return False

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
