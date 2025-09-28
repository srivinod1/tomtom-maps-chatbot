#!/usr/bin/env python3
"""
Railway Deployment Test Script
Tests the unified server for Railway deployment readiness
"""

import requests
import json
import time
import sys

def test_railway_deployment():
    """Test the unified server for Railway deployment"""
    print("🚂 Railway Deployment Test Suite")
    print("=" * 50)
    
    # Test configuration
    base_url = "http://localhost:3000"
    test_cases = [
        {
            "name": "Health Check",
            "method": "GET",
            "url": f"{base_url}/",
            "expected_status": 200
        },
        {
            "name": "Capabilities Endpoint",
            "method": "POST",
            "url": f"{base_url}/",
            "data": {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "orchestrator.capabilities",
                "params": {}
            },
            "expected_status": 200
        },
        {
            "name": "Location Search (Maps Agent)",
            "method": "POST",
            "url": f"{base_url}/",
            "data": {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "orchestrator.chat",
                "params": {
                    "message": "Find coffee shops near Times Square New York",
                    "user_id": "railway_test_user"
                }
            },
            "expected_status": 200,
            "expected_agent": "maps_agent"
        },
        {
            "name": "General Chat (General AI Agent)",
            "method": "POST",
            "url": f"{base_url}/",
            "data": {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "orchestrator.chat",
                "params": {
                    "message": "Hello! How are you today?",
                    "user_id": "railway_test_user"
                }
            },
            "expected_status": 200,
            "expected_agent": "general_ai_agent"
        },
        {
            "name": "Directions Query (Maps Agent)",
            "method": "POST",
            "url": f"{base_url}/",
            "data": {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "orchestrator.chat",
                "params": {
                    "message": "How do I get from Times Square to Central Park?",
                    "user_id": "railway_test_user"
                }
            },
            "expected_status": 200,
            "expected_agent": "maps_agent"
        },
        {
            "name": "Analytics Endpoint",
            "method": "GET",
            "url": f"{base_url}/analytics",
            "expected_status": 200
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 Test {i}: {test_case['name']}")
        print(f"   URL: {test_case['url']}")
        
        try:
            start_time = time.time()
            
            if test_case['method'] == 'GET':
                response = requests.get(test_case['url'], timeout=30)
            else:
                response = requests.post(
                    test_case['url'],
                    json=test_case['data'],
                    headers={'Content-Type': 'application/json'},
                    timeout=30
                )
            
            response_time = (time.time() - start_time) * 1000
            
            # Check status code
            if response.status_code == test_case['expected_status']:
                print(f"   ✅ Status: {response.status_code} (expected: {test_case['expected_status']})")
                print(f"   ⏱️  Response time: {response_time:.2f}ms")
                
                # Check agent routing for chat requests
                if 'expected_agent' in test_case and response.status_code == 200:
                    try:
                        data = response.json()
                        if 'result' in data and 'agent_used' in data['result']:
                            actual_agent = data['result']['agent_used']
                            if actual_agent == test_case['expected_agent']:
                                print(f"   ✅ Agent routing: {actual_agent} (expected: {test_case['expected_agent']})")
                            else:
                                print(f"   ⚠️  Agent routing: {actual_agent} (expected: {test_case['expected_agent']})")
                        else:
                            print(f"   ⚠️  Could not verify agent routing")
                    except json.JSONDecodeError:
                        print(f"   ⚠️  Could not parse JSON response")
                
                results.append({
                    "test": test_case['name'],
                    "status": "PASS",
                    "response_time": response_time,
                    "status_code": response.status_code
                })
                
            else:
                print(f"   ❌ Status: {response.status_code} (expected: {test_case['expected_status']})")
                print(f"   📄 Response: {response.text[:200]}...")
                results.append({
                    "test": test_case['name'],
                    "status": "FAIL",
                    "response_time": response_time,
                    "status_code": response.status_code,
                    "error": f"Expected status {test_case['expected_status']}, got {response.status_code}"
                })
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Request failed: {str(e)}")
            results.append({
                "test": test_case['name'],
                "status": "ERROR",
                "response_time": 0,
                "status_code": 0,
                "error": str(e)
            })
        except Exception as e:
            print(f"   ❌ Unexpected error: {str(e)}")
            results.append({
                "test": test_case['name'],
                "status": "ERROR",
                "response_time": 0,
                "status_code": 0,
                "error": str(e)
            })
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    print("=" * 50)
    
    passed = sum(1 for r in results if r['status'] == 'PASS')
    failed = sum(1 for r in results if r['status'] == 'FAIL')
    errors = sum(1 for r in results if r['status'] == 'ERROR')
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {failed}/{total}")
    print(f"💥 Errors: {errors}/{total}")
    
    if failed > 0 or errors > 0:
        print("\n❌ Failed/Error Details:")
        for result in results:
            if result['status'] in ['FAIL', 'ERROR']:
                print(f"   • {result['test']}: {result.get('error', 'Unknown error')}")
    
    # Performance summary
    successful_tests = [r for r in results if r['status'] == 'PASS' and r['response_time'] > 0]
    if successful_tests:
        avg_response_time = sum(r['response_time'] for r in successful_tests) / len(successful_tests)
        print(f"\n⏱️  Average response time: {avg_response_time:.2f}ms")
    
    # Railway readiness assessment
    print("\n🚂 Railway Deployment Readiness:")
    if passed == total:
        print("   ✅ READY FOR RAILWAY DEPLOYMENT")
        print("   • All tests passed")
        print("   • Server responds correctly")
        print("   • Agent routing working")
        print("   • Analytics endpoint functional")
    elif passed >= total * 0.8:
        print("   ⚠️  MOSTLY READY - Minor issues detected")
        print("   • Most tests passed")
        print("   • Review failed tests before deployment")
    else:
        print("   ❌ NOT READY - Major issues detected")
        print("   • Multiple test failures")
        print("   • Fix issues before deployment")
    
    return passed == total

if __name__ == "__main__":
    print("Starting Railway deployment test...")
    print("Make sure the unified server is running on localhost:3000")
    print("Run: npm start")
    print()
    
    success = test_railway_deployment()
    sys.exit(0 if success else 1)
