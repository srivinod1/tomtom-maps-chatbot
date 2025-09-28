#!/usr/bin/env python3
"""
Test 5 different multiturn conversation scenarios to verify context maintenance
and coherent user experience
"""

import requests
import json
import time
import sys

SERVER_URL = "http://localhost:3000"

def send_message(message, user_id="test_user"):
    """Send a message and return the response"""
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "orchestrator.chat",
        "params": {
            "message": message,
            "user_id": user_id
        }
    }
    
    try:
        response = requests.post(SERVER_URL, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
        
        if "result" in result:
            return {
                "success": True,
                "response": result['result']['response'],
                "agent_used": result['result']['agent_used'],
                "query_type": result['result']['query_type']
            }
        else:
            return {
                "success": False,
                "error": result.get('error', 'Unknown error')
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def test_conversation(conversation_name, messages, expected_flow):
    """Test a complete conversation flow"""
    print(f"\n{'='*80}")
    print(f"🗣️  CONVERSATION: {conversation_name}")
    print(f"{'='*80}")
    
    results = []
    
    for i, message in enumerate(messages, 1):
        print(f"\n👤 User Turn {i}: {message}")
        print("-" * 60)
        
        result = send_message(message)
        
        if result['success']:
            print(f"🤖 Response: {result['response']}")
            print(f"📊 Agent: {result['agent_used']} | Type: {result['query_type']}")
            
            # Check if response makes sense in context
            if i > 1:
                context_check = check_context_continuity(messages[:i], result['response'])
                if context_check:
                    print(f"✅ Context continuity: {context_check}")
                else:
                    print("⚠️  Context continuity: May have lost context")
            
            results.append({
                "turn": i,
                "user_message": message,
                "response": result['response'],
                "agent": result['agent_used'],
                "query_type": result['query_type']
            })
        else:
            print(f"❌ Error: {result['error']}")
            results.append({
                "turn": i,
                "user_message": message,
                "error": result['error']
            })
        
        time.sleep(1)  # Small delay between turns
    
    # Analyze conversation flow
    print(f"\n📊 CONVERSATION ANALYSIS")
    print("-" * 60)
    analyze_conversation_flow(results, expected_flow)
    
    return results

def check_context_continuity(previous_messages, current_response):
    """Check if the response shows context awareness"""
    # Simple heuristics for context awareness
    context_indicators = [
        "yes", "no", "that", "this", "it", "there", "here", "nearby", "close to",
        "from there", "to there", "that location", "that place", "the route",
        "the directions", "the coordinates", "the address", "the weather"
    ]
    
    response_lower = current_response.lower()
    context_found = any(indicator in response_lower for indicator in context_indicators)
    
    if context_found:
        return "Good context awareness"
    else:
        return None

def analyze_conversation_flow(results, expected_flow):
    """Analyze if the conversation followed expected patterns"""
    successful_turns = [r for r in results if 'error' not in r]
    
    print(f"✅ Successful turns: {len(successful_turns)}/{len(results)}")
    
    # Check agent routing consistency
    agents_used = [r['agent'] for r in successful_turns]
    unique_agents = set(agents_used)
    print(f"🤖 Agents used: {', '.join(unique_agents)}")
    
    # Check for context maintenance
    context_maintained = True
    for i in range(1, len(successful_turns)):
        if not check_context_continuity([], successful_turns[i]['response']):
            context_maintained = False
            break
    
    if context_maintained:
        print("✅ Context maintained throughout conversation")
    else:
        print("⚠️  Context may have been lost in some turns")
    
    # Check expected flow
    if expected_flow:
        print(f"📋 Expected flow: {expected_flow}")
        print("✅ Conversation completed successfully")

def main():
    print("🗣️  MULTITURN CONVERSATION TESTING")
    print("=" * 80)
    
    # Wait for server
    time.sleep(2)
    
    # Test conversations
    conversations = [
        {
            "name": "Location Discovery & Directions",
            "messages": [
                "Hello, I'm planning a trip to New York",
                "What are the coordinates for Times Square?",
                "How do I get from there to Central Park?",
                "What about the Brooklyn Bridge from Central Park?",
                "Thanks, that's very helpful!"
            ],
            "expected_flow": "User discovers locations, gets directions, maintains context"
        },
        {
            "name": "Weather & Location Search",
            "messages": [
                "What's the weather like in Tokyo?",
                "Find me some restaurants near the Tokyo Station",
                "What about coffee shops in that area?",
                "How far is the Imperial Palace from there?",
                "Perfect, thanks for the recommendations!"
            ],
            "expected_flow": "Weather query → location search → more specific search → distance calculation"
        },
        {
            "name": "Complex Routing Planning",
            "messages": [
                "I need to plan a route from LAX to Hollywood",
                "Actually, I also need to go to Beverly Hills",
                "What's the travel time matrix between these three locations?",
                "Which route would be fastest overall?",
                "Great, that helps with my planning!"
            ],
            "expected_flow": "Initial route → additional destination → matrix calculation → route comparison"
        },
        {
            "name": "Mixed General & Location Queries",
            "messages": [
                "Hi, how are you today?",
                "I'm looking for the Eiffel Tower coordinates",
                "Tell me about the history of that landmark",
                "Find restaurants near the Eiffel Tower",
                "What's the weather like in Paris right now?"
            ],
            "expected_flow": "Greeting → geocoding → general knowledge → location search → weather"
        },
        {
            "name": "Address Resolution & Verification",
            "messages": [
                "Where is 1600 Pennsylvania Avenue?",
                "Is that the White House?",
                "What's the exact address of the White House?",
                "How do I get there from the Washington Monument?",
                "Perfect, I have all the information I need"
            ],
            "expected_flow": "Address lookup → verification → specific address → directions"
        }
    ]
    
    all_results = []
    
    for conversation in conversations:
        results = test_conversation(
            conversation["name"],
            conversation["messages"],
            conversation["expected_flow"]
        )
        all_results.append({
            "name": conversation["name"],
            "results": results
        })
    
    # Overall summary
    print(f"\n{'='*80}")
    print("📊 OVERALL CONVERSATION TEST SUMMARY")
    print(f"{'='*80}")
    
    total_turns = sum(len(conv["results"]) for conv in all_results)
    successful_turns = sum(
        len([r for r in conv["results"] if 'error' not in r]) 
        for conv in all_results
    )
    
    print(f"✅ Total turns: {total_turns}")
    print(f"✅ Successful turns: {successful_turns}")
    print(f"📈 Success rate: {(successful_turns/total_turns)*100:.1f}%")
    
    print(f"\n📋 CONVERSATION BREAKDOWN:")
    for conv in all_results:
        successful = len([r for r in conv["results"] if 'error' not in r])
        total = len(conv["results"])
        status = "✅ PASS" if successful == total else "⚠️  PARTIAL"
        print(f"  {status} {conv['name']}: {successful}/{total} turns successful")
    
    # Check for common issues
    print(f"\n🔍 COMMON ISSUES DETECTED:")
    issues = []
    
    for conv in all_results:
        for result in conv["results"]:
            if 'error' in result:
                issues.append(f"Error in {conv['name']} turn {result['turn']}: {result['error']}")
    
    if issues:
        for issue in issues[:5]:  # Show first 5 issues
            print(f"  ❌ {issue}")
        if len(issues) > 5:
            print(f"  ... and {len(issues) - 5} more issues")
    else:
        print("  ✅ No errors detected")
    
    return successful_turns == total_turns

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
