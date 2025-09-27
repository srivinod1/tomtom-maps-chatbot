#!/usr/bin/env python3
"""
Test LLM Integration with Multi-Agent MCP Server
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

def test_llm_integration():
    """Test LLM integration with the orchestrator"""
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    
    print("🧪 Testing LLM Integration with Multi-Agent MCP Server")
    print("=" * 60)
    
    # Test cases for LLM integration
    test_cases = [
        {
            "name": "General Question with OpenAI",
            "message": "What is the capital of France?",
            "use_llm": True,
            "llm_provider": "openai"
        },
        {
            "name": "General Question with Anthropic",
            "message": "Explain quantum computing in simple terms",
            "use_llm": True,
            "llm_provider": "anthropic"
        },
        {
            "name": "Location Query (should use TomTom, not LLM)",
            "message": "Find coffee shops near me",
            "use_llm": True,
            "llm_provider": "openai"
        },
        {
            "name": "General Question without LLM (fallback)",
            "message": "Hello, how are you?",
            "use_llm": False
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        print("-" * 40)
        
        try:
            # Prepare request
            request_data = {
                "jsonrpc": "2.0",
                "id": i,
                "method": "orchestrator.chat",
                "params": {
                    "message": test_case["message"],
                    "user_id": "test_user",
                    "use_llm": test_case["use_llm"]
                }
            }
            
            # Add LLM provider if specified
            if "llm_provider" in test_case:
                request_data["params"]["llm_provider"] = test_case["llm_provider"]
            
            # Send request
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
                    print(f"✅ Success!")
                    print(f"   Response: {result['response'][:100]}...")
                    print(f"   Agent Used: {result['agent_used']}")
                    print(f"   Query Type: {result['query_type']}")
                    print(f"   LLM Used: {result.get('llm_used', False)}")
                    if result.get('llm_provider'):
                        print(f"   LLM Provider: {result['llm_provider']}")
                else:
                    print(f"❌ Error: {data.get('error', 'Unknown error')}")
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                print(f"   Response: {response.text}")
                
        except requests.exceptions.Timeout:
            print("❌ Request timeout")
        except requests.exceptions.RequestException as e:
            print(f"❌ Request error: {e}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
    
    print("\n" + "=" * 60)
    print("🏁 LLM Integration Test Complete")

def test_capabilities():
    """Test orchestrator capabilities"""
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    
    print("\n🔍 Testing Orchestrator Capabilities")
    print("-" * 40)
    
    try:
        request_data = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "orchestrator.capabilities"
        }
        
        response = requests.post(
            base_url,
            json=request_data,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if "result" in data:
                capabilities = data["result"]
                print("✅ Capabilities retrieved successfully")
                print(f"   Name: {capabilities.get('name', 'N/A')}")
                print(f"   Description: {capabilities.get('description', 'N/A')}")
                print(f"   Available Services: {len(capabilities.get('services', []))}")
            else:
                print(f"❌ Error: {data.get('error', 'Unknown error')}")
        else:
            print(f"❌ HTTP Error: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_llm_integration()
    test_capabilities()
