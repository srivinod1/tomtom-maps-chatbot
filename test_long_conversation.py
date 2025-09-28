import requests
import json
import os
import time

RAILWAY_URL = os.environ.get("RAILWAY_URL", "http://localhost:3000/")

def call_orchestrator_chat(message, user_id="test_user"):
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

def run_long_conversation():
    print("🗣️  LONG MULTITURN CONVERSATION TEST")
    print("=" * 80)
    
    # Give the server a moment to be ready
    print("⏳ Waiting for server to be ready...")
    time.sleep(3)
    
    user_id = f"long_conversation_user_{int(time.time())}"
    successful_turns = 0
    total_turns = 0
    context_issues = 0
    
    # Long conversation with 20+ turns covering various scenarios
    conversation_turns = [
        # Initial greeting and setup
        {"message": "Hi there! I'm planning a complex business trip to multiple cities", "expected_agent": "general_ai_agent", "description": "Initial greeting"},
        {"message": "I need to visit New York, Los Angeles, and Chicago", "expected_agent": "maps_agent", "description": "Mentioning multiple cities"},
        
        # New York exploration
        {"message": "Let's start with New York. What are the coordinates for Times Square?", "expected_agent": "maps_agent", "description": "NYC landmark geocoding"},
        {"message": "How do I get from Times Square to Central Park?", "expected_agent": "maps_agent", "description": "NYC directions"},
        {"message": "What restaurants are near Central Park?", "expected_agent": "maps_agent", "description": "NYC restaurant search"},
        {"message": "How far is the Brooklyn Bridge from there?", "expected_agent": "maps_agent", "description": "NYC distance calculation"},
        {"message": "What about the Empire State Building?", "expected_agent": "maps_agent", "description": "NYC landmark search"},
        
        # Transition to LA
        {"message": "Now let's move to Los Angeles. What's the weather like there?", "expected_agent": "general_ai_agent", "description": "LA weather query"},
        {"message": "Find me the coordinates for Hollywood", "expected_agent": "maps_agent", "description": "LA landmark geocoding"},
        {"message": "How do I get from LAX airport to Hollywood?", "expected_agent": "maps_agent", "description": "LA airport to landmark"},
        {"message": "What about Beverly Hills from Hollywood?", "expected_agent": "maps_agent", "description": "LA landmark to landmark"},
        {"message": "Show me restaurants near Beverly Hills", "expected_agent": "maps_agent", "description": "LA restaurant search"},
        
        # Chicago exploration
        {"message": "Now for Chicago. What are the coordinates for the Willis Tower?", "expected_agent": "maps_agent", "description": "Chicago landmark geocoding"},
        {"message": "How do I get from O'Hare Airport to the Willis Tower?", "expected_agent": "maps_agent", "description": "Chicago airport to landmark"},
        {"message": "What's the distance from Willis Tower to Millennium Park?", "expected_agent": "maps_agent", "description": "Chicago landmark distance"},
        {"message": "Find coffee shops near Millennium Park", "expected_agent": "maps_agent", "description": "Chicago coffee search"},
        
        # Complex routing and matrix calculations
        {"message": "I need to calculate travel times between all these locations", "expected_agent": "maps_agent", "description": "Complex routing request"},
        {"message": "What's the travel time matrix between Times Square, Hollywood, and Willis Tower?", "expected_agent": "maps_agent", "description": "Cross-city matrix routing"},
        {"message": "Compare travel times from each airport to their respective city centers", "expected_agent": "maps_agent", "description": "Airport routing comparison"},
        
        # Context references and follow-ups
        {"message": "How do I get from there to the nearest hotel?", "expected_agent": "maps_agent", "description": "Context reference to previous location"},
        {"message": "What about public transportation options?", "expected_agent": "maps_agent", "description": "Transportation inquiry"},
        {"message": "Can you help me plan the most efficient route between all these cities?", "expected_agent": "maps_agent", "description": "Efficiency planning"},
        
        # Mixed queries
        {"message": "Tell me about the history of these cities", "expected_agent": "general_ai_agent", "description": "Historical information"},
        {"message": "What's the best time to visit each of these cities?", "expected_agent": "general_ai_agent", "description": "Travel timing advice"},
        {"message": "Find me hotels near the Willis Tower", "expected_agent": "maps_agent", "description": "Chicago hotel search"},
        
        # Address resolution
        {"message": "Where is 1600 Pennsylvania Avenue?", "expected_agent": "maps_agent", "description": "White House address"},
        {"message": "Is that the White House?", "expected_agent": "maps_agent", "description": "White House verification"},
        {"message": "How do I get there from the Washington Monument?", "expected_agent": "maps_agent", "description": "DC directions"},
        
        # International locations
        {"message": "What about international locations? Find the Eiffel Tower coordinates", "expected_agent": "maps_agent", "description": "International landmark"},
        {"message": "How about Tokyo Station?", "expected_agent": "maps_agent", "description": "International station"},
        {"message": "What restaurants are near the Eiffel Tower?", "expected_agent": "maps_agent", "description": "International restaurant search"},
        
        # Complex follow-ups and context maintenance
        {"message": "Going back to my original trip, what's the best order to visit these cities?", "expected_agent": "general_ai_agent", "description": "Trip planning advice"},
        {"message": "Calculate the total travel time for my entire itinerary", "expected_agent": "maps_agent", "description": "Complete itinerary calculation"},
        {"message": "What if I add San Francisco to my trip?", "expected_agent": "maps_agent", "description": "Additional city planning"},
        {"message": "Find the coordinates for the Golden Gate Bridge", "expected_agent": "maps_agent", "description": "SF landmark geocoding"},
        {"message": "How do I get from SFO to the Golden Gate Bridge?", "expected_agent": "maps_agent", "description": "SF airport to landmark"},
        
        # Final wrap-up
        {"message": "This is a lot of information. Can you summarize my trip?", "expected_agent": "general_ai_agent", "description": "Trip summary request"},
        {"message": "What's the most important thing I should remember?", "expected_agent": "general_ai_agent", "description": "Key information request"},
        {"message": "Thanks for all your help!", "expected_agent": "general_ai_agent", "description": "Final thanks"}
    ]
    
    print(f"🚀 Starting long conversation with {len(conversation_turns)} turns")
    print(f"👤 User ID: {user_id}")
    print("=" * 80)
    
    for i, turn in enumerate(conversation_turns):
        user_message = turn["message"]
        expected_agent = turn["expected_agent"]
        description = turn["description"]
        
        print(f"\n👤 Turn {i+1:2d}: {user_message}")
        print(f"📝 Description: {description}")
        print(f"🎯 Expected Agent: {expected_agent}")
        print("-" * 60)
        
        result = call_orchestrator_chat(user_message, user_id)
        total_turns += 1
        
        if "error" in result:
            print(f"🤖 Response: ❌ Error: {result['error']}")
            print(f"📊 Agent: {result['agent_used']} | Type: {result.get('query_type', 'N/A')}")
        else:
            print(f"🤖 Response: {result['response'][:200]}{'...' if len(result['response']) > 200 else ''}")
            print(f"📊 Agent: {result['agent_used']} | Type: {result.get('query_type', 'N/A')}")
            
            # Check if agent matches expectation
            if result["agent_used"] == expected_agent:
                successful_turns += 1
                print("✅ Agent routing: Correct")
            else:
                print(f"❌ Agent routing: Expected {expected_agent}, got {result['agent_used']}")
                context_issues += 1
            
            # Check for context awareness indicators
            response_lower = result['response'].lower()
            if any(word in response_lower for word in ['there', 'that location', 'the area', 'nearby', 'from there']):
                print("✅ Context awareness: Good")
            elif result.get('agent_used') == 'general_ai_agent':
                print("✅ Context awareness: N/A (general chat)")
            else:
                print("⚠️  Context awareness: May be limited")
        
        # Small delay between turns to simulate real conversation
        time.sleep(0.5)
    
    print("\n" + "=" * 80)
    print("📊 LONG CONVERSATION ANALYSIS")
    print("=" * 80)
    print(f"✅ Total turns: {total_turns}")
    print(f"✅ Successful agent routing: {successful_turns}")
    print(f"❌ Agent routing issues: {context_issues}")
    print(f"📈 Success rate: {(successful_turns / total_turns * 100):.1f}%")
    print(f"🎯 Context issues: {context_issues}")
    
    # Performance analysis
    if successful_turns == total_turns:
        print("🎉 Perfect performance! All agent routing was correct.")
    elif successful_turns >= total_turns * 0.9:
        print("✅ Excellent performance! Minor issues detected.")
    elif successful_turns >= total_turns * 0.8:
        print("⚠️  Good performance with some issues.")
    else:
        print("❌ Significant issues detected. Review agent routing logic.")
    
    # Context analysis
    if context_issues == 0:
        print("🧠 Perfect context maintenance throughout conversation.")
    elif context_issues <= total_turns * 0.1:
        print("🧠 Good context maintenance with minor issues.")
    else:
        print("🧠 Context maintenance needs improvement.")
    
    return successful_turns == total_turns and context_issues <= total_turns * 0.1

if __name__ == "__main__":
    success = run_long_conversation()
    if not success:
        exit(1)
