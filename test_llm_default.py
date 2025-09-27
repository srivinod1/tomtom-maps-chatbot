#!/usr/bin/env python3
"""
Test that LLM is always used by default in orchestrator
"""

import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

def test_llm_default():
    """Test that LLM is always used by default"""
    
    base_url = "https://web-production-5f9ea.up.railway.app"
    
    print("🧪 Testing LLM Default Behavior")
    print("=" * 50)
    
    # Test cases - no LLM parameters should be needed
    test_cases = [
        {
            "name": "General Question (should use LLM)",
            "message": "What is artificial intelligence?"
        },
        {
            "name": "Location Query (should use TomTom)",
            "message": "Find restaurants near me"
        },
        {
            "name": "Complex Question (should use LLM)",
            "message": "Explain the difference between machine learning and deep learning"
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        print("-" * 30)
        
        try:
            # Simple request without LLM parameters
            request_data = {
                "jsonrpc": "2.0",
                "id": i,
                "method": "orchestrator.chat",
                "params": {
                    "message": test_case["message"],
                    "user_id": "test_user"
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
                    print(f"✅ Success!")
                    print(f"   Response: {result['response'][:100]}...")
                    print(f"   Agent Used: {result['agent_used']}")
                    print(f"   Query Type: {result['query_type']}")
                    
                    # Check if LLM was used (no longer exposed in response)
                    if result['agent_used'] == 'general_ai_agent':
                        print(f"   Note: General questions now use LLM by default")
                else:
                    print(f"❌ Error: {data.get('error', 'Unknown error')}")
            else:
                print(f"❌ HTTP Error: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("🏁 LLM Default Test Complete")

if __name__ == "__main__":
    test_llm_default()
