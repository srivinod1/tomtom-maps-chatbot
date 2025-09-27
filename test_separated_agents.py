#!/usr/bin/env python3
"""
Test Separated Agents Architecture
"""

import requests
import json
import time
import subprocess
import os
import signal
import sys

def test_maps_agent():
    """Test Maps Agent independently"""
    
    print("🗺️  Testing Maps Agent")
    print("-" * 40)
    
    maps_url = "http://localhost:3002"
    
    # Test health check
    try:
        response = requests.get(f"{maps_url}/", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Maps Agent Health: {data['status']}")
            print(f"   Capabilities: {len(data['capabilities'])} tools")
        else:
            print(f"❌ Maps Agent Health Check Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Maps Agent not reachable: {e}")
        return False
    
    # Test tools list
    try:
        response = requests.post(f"{maps_url}/", json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list"
        }, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            tools = data['result']['tools']
            print(f"✅ Maps Agent Tools: {len(tools)} available")
            for tool in tools:
                print(f"   - {tool['name']}: {tool['description']}")
        else:
            print(f"❌ Tools List Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Tools List Error: {e}")
        return False
    
    # Test search functionality
    try:
        response = requests.post(f"{maps_url}/", json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": "maps.search",
                "arguments": {
                    "query": "restaurants",
                    "location": {"lat": 52.349147, "lon": 4.987564}
                }
            }
        }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if 'result' in data:
                result = json.loads(data['result']['content'][0]['text'])
                print(f"✅ Maps Agent Search: Found {len(result.get('places', []))} places")
            else:
                print(f"❌ Maps Agent Search Error: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Maps Agent Search Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Maps Agent Search Error: {e}")
        return False
    
    return True

def test_orchestrator_agent():
    """Test Orchestrator Agent"""
    
    print("\n🎯 Testing Orchestrator Agent")
    print("-" * 40)
    
    orchestrator_url = "http://localhost:3000"
    
    # Test health check
    try:
        response = requests.get(f"{orchestrator_url}/", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Orchestrator Health: {data['status']}")
            print(f"   Maps Agent URL: {data['agents']['maps_agent']}")
        else:
            print(f"❌ Orchestrator Health Check Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Orchestrator not reachable: {e}")
        return False
    
    # Test capabilities
    try:
        response = requests.post(f"{orchestrator_url}/", json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "orchestrator.capabilities"
        }, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            capabilities = data['result']
            print(f"✅ Orchestrator Capabilities: {len(capabilities['mcp_methods'])} methods")
            print(f"   Services: {len(capabilities['available_services']['location_services'])} location, {len(capabilities['available_services']['general_services'])} general")
        else:
            print(f"❌ Capabilities Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Capabilities Error: {e}")
        return False
    
    return True

def test_integration():
    """Test integration between agents"""
    
    print("\n🔗 Testing Agent Integration")
    print("-" * 40)
    
    orchestrator_url = "http://localhost:3000"
    
    # Test location query (should route to Maps Agent)
    try:
        response = requests.post(f"{orchestrator_url}/", json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "orchestrator.chat",
            "params": {
                "message": "Find restaurants near 52.349147, 4.987564",
                "user_id": "test_user"
            }
        }, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if 'result' in data:
                result = data['result']
                print(f"✅ Location Query: {result['agent_used']} - {result['query_type']}")
                print(f"   Response: {result['response'][:100]}...")
            else:
                print(f"❌ Location Query Error: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ Location Query Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Location Query Error: {e}")
        return False
    
    # Test general query (should use LLM)
    try:
        response = requests.post(f"{orchestrator_url}/", json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "orchestrator.chat",
            "params": {
                "message": "What is artificial intelligence?",
                "user_id": "test_user"
            }
        }, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if 'result' in data:
                result = data['result']
                print(f"✅ General Query: {result['agent_used']} - {result['query_type']}")
                print(f"   Response: {result['response'][:100]}...")
            else:
                print(f"❌ General Query Error: {data.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ General Query Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ General Query Error: {e}")
        return False
    
    return True

def start_agents():
    """Start both agents for testing"""
    
    print("🚀 Starting Agents for Testing")
    print("=" * 50)
    
    # Start Maps Agent
    print("Starting Maps Agent on port 3002...")
    maps_process = subprocess.Popen([
        'node', 'src/maps-agent.js'
    ], env={**os.environ, 'MAPS_AGENT_PORT': '3002'})
    
    # Wait for Maps Agent to start
    time.sleep(3)
    
    # Start Orchestrator Agent
    print("Starting Orchestrator Agent on port 3000...")
    orchestrator_process = subprocess.Popen([
        'node', 'src/orchestrator-agent.js'
    ], env={**os.environ, 'PORT': '3000', 'MAPS_AGENT_URL': 'http://localhost:3002'})
    
    # Wait for Orchestrator Agent to start
    time.sleep(3)
    
    return maps_process, orchestrator_process

def cleanup_processes(processes):
    """Clean up running processes"""
    
    print("\n🧹 Cleaning up processes...")
    for process in processes:
        try:
            process.terminate()
            process.wait(timeout=5)
        except:
            try:
                process.kill()
            except:
                pass

def main():
    """Main test function"""
    
    print("🧪 Testing Separated Agents Architecture")
    print("=" * 60)
    
    # Check if agents are already running
    try:
        requests.get("http://localhost:3000", timeout=2)
        requests.get("http://localhost:3002", timeout=2)
        print("✅ Agents already running, testing directly...")
        processes = None
    except:
        print("🔄 Starting agents...")
        processes = start_agents()
    
    try:
        # Test Maps Agent
        maps_ok = test_maps_agent()
        
        # Test Orchestrator Agent
        orchestrator_ok = test_orchestrator_agent()
        
        # Test Integration
        integration_ok = test_integration()
        
        # Results
        print("\n" + "=" * 60)
        print("🏁 Test Results")
        print("-" * 30)
        print(f"Maps Agent: {'✅ PASS' if maps_ok else '❌ FAIL'}")
        print(f"Orchestrator Agent: {'✅ PASS' if orchestrator_ok else '❌ FAIL'}")
        print(f"Integration: {'✅ PASS' if integration_ok else '❌ FAIL'}")
        
        if maps_ok and orchestrator_ok and integration_ok:
            print("\n🎉 All tests passed! Separated agents architecture is working.")
        else:
            print("\n⚠️  Some tests failed. Check the logs above.")
            
    finally:
        if processes:
            cleanup_processes(processes)

if __name__ == "__main__":
    main()
