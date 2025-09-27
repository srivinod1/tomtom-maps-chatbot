#!/usr/bin/env python3
"""
Test Context Memory and Conversation Flow
"""

import requests
import json
import time

def test_context_memory():
    """Test that the agent maintains context across messages"""
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    user_id = f"test_user_{int(time.time())}"
    
    print("🧠 Testing Context Memory and Conversation Flow")
    print("=" * 60)
    
    # Test conversation flow
    conversation = [
        "Hello! I'm looking for restaurants near me.",
        "My location is 1554 IJburglaan, Amsterdam",
        "What are the coordinates for this address?",
        "Find the 3 closest restaurants to this place, along with distances"
    ]
    
    for i, message in enumerate(conversation, 1):
        print(f"\n{i}. User: {message}")
        print("-" * 40)
        
        try:
            request_data = {
                "jsonrpc": "2.0",
                "id": i,
                "method": "orchestrator.chat",
                "params": {
                    "message": message,
                    "user_id": user_id
                }
            }
            
            response = requests.post(
                base_url,
                json=request_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "result" in data:
                    result = data["result"]
                    print(f"✅ Bot: {result['response'][:200]}...")
                    print(f"   Agent: {result['agent_used']} | Type: {result['query_type']}")
                else:
                    print(f"❌ Error: {data.get('error', 'Unknown error')}")
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
        
        # Small delay between messages
        time.sleep(1)
    
    print("\n" + "=" * 60)
    print("🏁 Context Memory Test Complete")

def test_location_extraction():
    """Test location extraction from various message formats"""
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    user_id = f"test_location_{int(time.time())}"
    
    print("\n📍 Testing Location Extraction")
    print("-" * 40)
    
    location_tests = [
        "Find restaurants near 52.349147, 4.987564",
        "My place is 1554 IJburglaan, Amsterdam",
        "What's near me?",
        "3 closest restaurants"
    ]
    
    for i, message in enumerate(location_tests, 1):
        print(f"\n{i}. Testing: {message}")
        
        try:
            request_data = {
                "jsonrpc": "2.0",
                "id": i,
                "method": "orchestrator.chat",
                "params": {
                    "message": message,
                    "user_id": user_id
                }
            }
            
            response = requests.post(
                base_url,
                json=request_data,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "result" in data:
                    result = data["result"]
                    print(f"   Response: {result['response'][:150]}...")
                    print(f"   Agent: {result['agent_used']}")
                else:
                    print(f"   Error: {data.get('error', 'Unknown error')}")
            else:
                print(f"   HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"   Error: {e}")

if __name__ == "__main__":
    test_context_memory()
    test_location_extraction()
