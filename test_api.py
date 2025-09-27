#!/usr/bin/env python3
"""
Test script for the TomTom Maps Chatbot API
"""

import requests
import json
import time

# Configuration
API_BASE_URL = "http://localhost:5001"  # Change to your Railway URL when deployed
USER_ID = "test_user_123"

def test_health_check():
    """Test the health check endpoint"""
    print("🔍 Testing health check...")
    try:
        response = requests.get(f"{API_BASE_URL}/")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data['status']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_capabilities():
    """Test the capabilities endpoint"""
    print("\n🔍 Testing capabilities...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/capabilities")
        if response.status_code == 200:
            data = response.json()
            print("✅ Capabilities retrieved:")
            for capability, description in data['capabilities'].items():
                print(f"   • {capability}: {description}")
            return True
        else:
            print(f"❌ Capabilities test failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Capabilities test error: {e}")
        return False

def test_chat_endpoint(message, expected_type=None):
    """Test the chat endpoint with a message"""
    print(f"\n💬 Testing chat: '{message}'")
    try:
        response = requests.post(f"{API_BASE_URL}/api/chat", json={
            "message": message,
            "user_id": USER_ID
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print(f"✅ Response: {data['response'][:100]}...")
                if expected_type and data.get("query_type") == expected_type:
                    print(f"✅ Query type matches: {data['query_type']}")
                elif expected_type:
                    print(f"⚠️  Expected type {expected_type}, got {data.get('query_type')}")
                return True
            else:
                print(f"❌ Chat failed: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Chat test failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Chat test error: {e}")
        return False

def test_context_endpoints():
    """Test context setting and retrieval"""
    print("\n🔍 Testing context endpoints...")
    
    # Set context
    try:
        response = requests.post(f"{API_BASE_URL}/api/context", json={
            "user_id": USER_ID,
            "context": {
                "current_location": {"lat": 47.6062, "lon": -122.3321},
                "preferences": {"travel_mode": "car"}
            }
        })
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Context set successfully")
            else:
                print(f"❌ Context set failed: {data.get('error')}")
                return False
        else:
            print(f"❌ Context set failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Context set error: {e}")
        return False
    
    # Get context
    try:
        response = requests.get(f"{API_BASE_URL}/api/context/{USER_ID}")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                print("✅ Context retrieved successfully:")
                print(f"   {json.dumps(data['context'], indent=2)}")
                return True
            else:
                print(f"❌ Context get failed: {data.get('error')}")
                return False
        else:
            print(f"❌ Context get failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Context get error: {e}")
        return False

def test_chat_history():
    """Test chat history endpoint"""
    print("\n🔍 Testing chat history...")
    try:
        response = requests.get(f"{API_BASE_URL}/api/chat/history?user_id={USER_ID}&limit=5")
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                history = data['history']
                print(f"✅ Chat history retrieved: {len(history)} messages")
                for msg in history[-3:]:  # Show last 3 messages
                    msg_type = msg.get('type', 'unknown')
                    if msg_type == 'user':
                        print(f"   👤 User: {msg.get('query', '')[:50]}...")
                    elif msg_type == 'assistant':
                        print(f"   🤖 Bot: {msg.get('response', '')[:50]}...")
                return True
            else:
                print(f"❌ Chat history failed: {data.get('error')}")
                return False
        else:
            print(f"❌ Chat history failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Chat history error: {e}")
        return False

def run_comprehensive_test():
    """Run a comprehensive test of all endpoints"""
    print("🧪 TomTom Maps Chatbot API Test Suite")
    print("=" * 50)
    
    # Test basic endpoints
    health_ok = test_health_check()
    capabilities_ok = test_capabilities()
    
    if not health_ok:
        print("❌ Health check failed. Make sure the API server is running.")
        return
    
    # Test context endpoints
    context_ok = test_context_endpoints()
    
    # Test various chat scenarios
    test_cases = [
        ("Hello! What can you do?", "general"),
        ("Find restaurants near 47.6062, -122.3321", "search"),
        ("How do I get from Seattle to Portland?", "directions"),
        ("What are the coordinates for 123 Main Street, Seattle?", "geocoding"),
        ("What's at 47.6062, -122.3321?", "reverse_geocoding"),
        ("What's the weather like today?", "general")
    ]
    
    chat_results = []
    for message, expected_type in test_cases:
        result = test_chat_endpoint(message, expected_type)
        chat_results.append(result)
        time.sleep(1)  # Small delay between requests
    
    # Test chat history
    history_ok = test_chat_history()
    
    # Summary
    print("\n📊 Test Results Summary")
    print("=" * 30)
    print(f"Health Check: {'✅' if health_ok else '❌'}")
    print(f"Capabilities: {'✅' if capabilities_ok else '❌'}")
    print(f"Context: {'✅' if context_ok else '❌'}")
    print(f"Chat History: {'✅' if history_ok else '❌'}")
    print(f"Chat Tests: {sum(chat_results)}/{len(chat_results)} passed")
    
    total_passed = sum([health_ok, capabilities_ok, context_ok, history_ok] + chat_results)
    total_tests = 4 + len(chat_results)
    
    print(f"\nOverall: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("🎉 All tests passed! The API is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the errors above.")

if __name__ == "__main__":
    run_comprehensive_test()
