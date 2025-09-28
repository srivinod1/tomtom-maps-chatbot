#!/usr/bin/env python3
"""
Railway Deployment Test Script
Tests the deployed multi-agent system on Railway
"""

import requests
import json
import time
import sys

# Configuration
RAILWAY_URL = "https://your-service-name-production-xxxx.up.railway.app"  # Replace with your Railway URL
LOCAL_URL = "http://localhost:3000"

def test_endpoint(base_url, test_name):
    """Test a specific endpoint"""
    print(f"\n🧪 Testing: {test_name}")
    print(f"📍 URL: {base_url}")
    
    try:
        # Test health endpoint
        health_response = requests.get(f"{base_url}/", timeout=10)
        if health_response.status_code == 200:
            print("✅ Health check passed")
            health_data = health_response.json()
            print(f"   Service: {health_data.get('service', 'Unknown')}")
            print(f"   Status: {health_data.get('status', 'Unknown')}")
        else:
            print(f"❌ Health check failed: {health_response.status_code}")
            return False
        
        # Test capabilities
        capabilities_response = requests.post(f"{base_url}/", 
            headers={"Content-Type": "application/json"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "orchestrator.capabilities",
                "params": {}
            },
            timeout=10
        )
        
        if capabilities_response.status_code == 200:
            print("✅ Capabilities endpoint working")
            caps_data = capabilities_response.json()
            print(f"   Available agents: {list(caps_data.get('result', {}).get('orchestrator', {}).keys())}")
        else:
            print(f"❌ Capabilities failed: {capabilities_response.status_code}")
            return False
        
        # Test location search (should route to maps_agent)
        search_response = requests.post(f"{base_url}/",
            headers={"Content-Type": "application/json"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "orchestrator.chat",
                "params": {
                    "message": "Find coffee shops near Times Square New York",
                    "user_id": "railway_test_user"
                }
            },
            timeout=15
        )
        
        if search_response.status_code == 200:
            search_data = search_response.json()
            agent_used = search_data.get('result', {}).get('agent_used', 'unknown')
            print(f"✅ Location search working (routed to: {agent_used})")
        else:
            print(f"❌ Location search failed: {search_response.status_code}")
            return False
        
        # Test directions (should route to maps_agent)
        directions_response = requests.post(f"{base_url}/",
            headers={"Content-Type": "application/json"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "orchestrator.chat",
                "params": {
                    "message": "directions from Times Square to Central Park",
                    "user_id": "railway_test_user"
                }
            },
            timeout=15
        )
        
        if directions_response.status_code == 200:
            directions_data = directions_response.json()
            agent_used = directions_data.get('result', {}).get('agent_used', 'unknown')
            print(f"✅ Directions working (routed to: {agent_used})")
        else:
            print(f"❌ Directions failed: {directions_response.status_code}")
            return False
        
        # Test general chat (should route to general_ai_agent)
        chat_response = requests.post(f"{base_url}/",
            headers={"Content-Type": "application/json"},
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "orchestrator.chat",
                "params": {
                    "message": "Hello! How are you today?",
                    "user_id": "railway_test_user"
                }
            },
            timeout=15
        )
        
        if chat_response.status_code == 200:
            chat_data = chat_response.json()
            agent_used = chat_data.get('result', {}).get('agent_used', 'unknown')
            print(f"✅ General chat working (routed to: {agent_used})")
        else:
            print(f"❌ General chat failed: {chat_response.status_code}")
            return False
        
        # Test analytics
        analytics_response = requests.get(f"{base_url}/analytics", timeout=10)
        if analytics_response.status_code == 200:
            print("✅ Analytics endpoint working")
        else:
            print(f"⚠️  Analytics endpoint failed: {analytics_response.status_code}")
        
        return True
        
    except requests.exceptions.Timeout:
        print("❌ Request timeout - service may be slow or unresponsive")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - service may be down")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

def main():
    print("🚀 Railway Deployment Test Suite")
    print("=" * 50)
    
    # Test local server first
    print("\n🏠 Testing Local Server...")
    local_success = test_endpoint(LOCAL_URL, "Local Server")
    
    # Test Railway deployment
    print("\n☁️  Testing Railway Deployment...")
    print("⚠️  Note: Update RAILWAY_URL in this script with your actual Railway URL")
    
    if RAILWAY_URL == "https://your-service-name-production-xxxx.up.railway.app":
        print("❌ Please update RAILWAY_URL with your actual Railway deployment URL")
        railway_success = False
    else:
        railway_success = test_endpoint(RAILWAY_URL, "Railway Deployment")
    
    # Summary
    print("\n📊 Test Results Summary")
    print("=" * 30)
    print(f"Local Server: {'✅ PASSED' if local_success else '❌ FAILED'}")
    print(f"Railway Deployment: {'✅ PASSED' if railway_success else '❌ FAILED'}")
    
    if local_success and railway_success:
        print("\n🎉 All tests passed! Your multi-agent system is ready for production.")
    elif local_success:
        print("\n⚠️  Local server works, but Railway deployment needs attention.")
    else:
        print("\n❌ Both local and Railway deployments have issues.")
    
    return local_success and railway_success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)