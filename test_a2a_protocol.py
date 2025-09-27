#!/usr/bin/env python3
"""
Test A2A Protocol Communication
"""

import requests
import json
import time

def test_a2a_maps_agent():
    """Test Maps Agent A2A communication"""
    
    print("🗺️  Testing Maps Agent A2A Protocol")
    print("-" * 40)
    
    maps_url = "http://localhost:3002"
    
    # Test A2A search message
    a2a_message = {
        "protocol": "A2A",
        "version": "1.0",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "source": {
            "agentId": "test-agent",
            "agentType": "test",
            "url": "http://localhost:9999"
        },
        "target": {
            "agentId": "maps-agent",
            "agentType": "maps",
            "url": maps_url
        },
        "message": {
            "type": "search_places",
            "payload": {
                "query": "restaurants",
                "location": {
                    "lat": 52.349147,
                    "lon": 4.987564
                }
            },
            "correlationId": "test-123",
            "timeout": 30000
        }
    }
    
    try:
        response = requests.post(f"{maps_url}/a2a", json=a2a_message, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ A2A Search Response: {data.get('success', False)}")
            if data.get('success'):
                print(f"   Places found: {len(data.get('data', {}).get('places', []))}")
            else:
                print(f"   Error: {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ A2A Search Failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ A2A Search Error: {e}")

def test_a2a_orchestrator():
    """Test Orchestrator Agent A2A communication"""
    
    print("\n🎯 Testing Orchestrator Agent A2A Protocol")
    print("-" * 40)
    
    orchestrator_url = "http://localhost:3000"
    
    # Test A2A chat message
    a2a_message = {
        "protocol": "A2A",
        "version": "1.0",
        "timestamp": "2024-01-01T00:00:00.000Z",
        "source": {
            "agentId": "test-agent",
            "agentType": "test",
            "url": "http://localhost:9999"
        },
        "target": {
            "agentId": "orchestrator-agent",
            "agentType": "orchestrator",
            "url": orchestrator_url
        },
        "message": {
            "type": "chat_message",
            "payload": {
                "message": "Find restaurants near me",
                "user_id": "test_user"
            },
            "correlationId": "test-456",
            "timeout": 30000
        }
    }
    
    try:
        response = requests.post(f"{orchestrator_url}/a2a", json=a2a_message, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ A2A Chat Response: {data.get('success', False)}")
            if data.get('success'):
                result = data.get('data', {})
                print(f"   Response: {result.get('response', 'No response')[:100]}...")
                print(f"   Agent Used: {result.get('agent_used', 'Unknown')}")
                print(f"   Query Type: {result.get('query_type', 'Unknown')}")
            else:
                print(f"   Error: {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ A2A Chat Failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ A2A Chat Error: {e}")

def test_agent_discovery():
    """Test agent discovery"""
    
    print("\n🔍 Testing Agent Discovery")
    print("-" * 40)
    
    agents = [
        ("Maps Agent", "http://localhost:3002"),
        ("Orchestrator Agent", "http://localhost:3000")
    ]
    
    for name, url in agents:
        try:
            response = requests.get(f"{url}/agents", timeout=5)
            if response.status_code == 200:
                data = response.json()
                agent_info = data.get('agents', [{}])[0]
                print(f"✅ {name}: {agent_info.get('agentId', 'Unknown')} ({agent_info.get('agentType', 'Unknown')})")
            else:
                print(f"❌ {name}: Discovery failed ({response.status_code})")
        except Exception as e:
            print(f"❌ {name}: Discovery error - {e}")

def main():
    """Main test function"""
    
    print("🧪 Testing A2A Protocol Communication")
    print("=" * 60)
    
    # Test agent discovery
    test_agent_discovery()
    
    # Test Maps Agent A2A
    test_a2a_maps_agent()
    
    # Test Orchestrator Agent A2A
    test_a2a_orchestrator()
    
    print("\n" + "=" * 60)
    print("🏁 A2A Protocol Test Complete")

if __name__ == "__main__":
    main()
