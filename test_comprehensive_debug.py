#!/usr/bin/env python3
"""
Comprehensive Test Suite for TomTom MCP Multi-Agent System
Tests 10 different scenarios to debug and fix all issues
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
RAILWAY_URL = "https://web-production-5f9ea.up.railway.app"
LOCAL_URL = "http://localhost:3000"

# Test scenarios
TEST_SCENARIOS = [
    {
        "id": 1,
        "name": "Place Search - Coffee Shops",
        "message": "Find coffee shops near Times Square",
        "expected_keywords": ["coffee", "Starbucks", "Times Square"]
    },
    {
        "id": 2,
        "name": "Geocoding - Address to Coordinates",
        "message": "What are the coordinates for 1554 IJburglaan Amsterdam?",
        "expected_keywords": ["coordinates", "latitude", "longitude", "Amsterdam"]
    },
    {
        "id": 3,
        "name": "Reverse Geocoding - Coordinates to Address",
        "message": "What is the address for coordinates 40.7589, -73.9851?",
        "expected_keywords": ["address", "Broadway", "New York"]
    },
    {
        "id": 4,
        "name": "Matrix Routing - Multiple Locations",
        "message": "matrix routing between Times Square and Central Park",
        "expected_keywords": ["matrix", "travel time", "Times Square", "Central Park"]
    },
    {
        "id": 5,
        "name": "International Travel Time",
        "message": "travel time between Paris and Amsterdam",
        "expected_keywords": ["travel time", "Paris", "Amsterdam", "distance"]
    },
    {
        "id": 6,
        "name": "Directions - Route Calculation",
        "message": "How do I get from Times Square to Central Park?",
        "expected_keywords": ["directions", "route", "Times Square", "Central Park"]
    },
    {
        "id": 7,
        "name": "Restaurant Search",
        "message": "Find restaurants near Central Park",
        "expected_keywords": ["restaurant", "Central Park", "food"]
    },
    {
        "id": 8,
        "name": "Hotel Search",
        "message": "Find hotels near Times Square",
        "expected_keywords": ["hotel", "Times Square", "accommodation"]
    },
    {
        "id": 9,
        "name": "Gas Station Search",
        "message": "Find gas stations near Central Park",
        "expected_keywords": ["gas station", "fuel", "Central Park"]
    },
    {
        "id": 10,
        "name": "Complex Multi-Location Matrix",
        "message": "matrix routing between Times Square, Central Park, and Brooklyn Bridge",
        "expected_keywords": ["matrix", "Times Square", "Central Park", "Brooklyn Bridge"]
    }
]

def test_endpoint(url, test_scenario):
    """Test a single scenario"""
    print(f"\n{'='*60}")
    print(f"TEST {test_scenario['id']}: {test_scenario['name']}")
    print(f"Message: {test_scenario['message']}")
    print(f"{'='*60}")
    
    payload = {
        "jsonrpc": "2.0",
        "id": test_scenario['id'],
        "method": "orchestrator.chat",
        "params": {
            "message": test_scenario['message'],
            "user_id": "test_user"
        }
    }
    
    try:
        start_time = time.time()
        response = requests.post(url, json=payload, timeout=30)
        end_time = time.time()
        
        response_time = end_time - start_time
        
        if response.status_code == 200:
            data = response.json()
            if 'result' in data and 'response' in data['result']:
                response_text = data['result']['response']
                print(f"✅ SUCCESS (Response time: {response_time:.2f}s)")
                print(f"Response: {response_text}")
                
                # Check for expected keywords
                found_keywords = []
                missing_keywords = []
                
                for keyword in test_scenario['expected_keywords']:
                    if keyword.lower() in response_text.lower():
                        found_keywords.append(keyword)
                    else:
                        missing_keywords.append(keyword)
                
                print(f"Found keywords: {found_keywords}")
                if missing_keywords:
                    print(f"Missing keywords: {missing_keywords}")
                
                # Check for error messages
                error_indicators = [
                    "I'm having trouble",
                    "Please try again later",
                    "not working",
                    "error",
                    "failed"
                ]
                
                has_errors = any(indicator in response_text for indicator in error_indicators)
                if has_errors:
                    print("⚠️  WARNING: Response contains error indicators")
                    return False
                else:
                    print("✅ No error indicators found")
                    return True
            else:
                print(f"❌ FAILED: Invalid response format")
                print(f"Response: {data}")
                return False
        else:
            print(f"❌ FAILED: HTTP {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ FAILED: Request timeout")
        return False
    except requests.exceptions.ConnectionError:
        print("❌ FAILED: Connection error")
        return False
    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        return False

def run_comprehensive_tests():
    """Run all tests on both local and Railway"""
    print("🚀 Starting Comprehensive Test Suite")
    print(f"Timestamp: {datetime.now().isoformat()}")
    
    # Test both endpoints
    endpoints = [
        {"name": "Local", "url": LOCAL_URL},
        {"name": "Railway", "url": RAILWAY_URL}
    ]
    
    results = {}
    
    for endpoint in endpoints:
        print(f"\n{'#'*80}")
        print(f"TESTING {endpoint['name'].upper()} ENDPOINT: {endpoint['url']}")
        print(f"{'#'*80}")
        
        endpoint_results = []
        
        for scenario in TEST_SCENARIOS:
            success = test_endpoint(endpoint['url'], scenario)
            endpoint_results.append({
                'scenario': scenario['name'],
                'success': success
            })
            time.sleep(1)  # Brief pause between tests
        
        results[endpoint['name']] = endpoint_results
        
        # Summary for this endpoint
        successful_tests = sum(1 for result in endpoint_results if result['success'])
        total_tests = len(endpoint_results)
        success_rate = (successful_tests / total_tests) * 100
        
        print(f"\n{'='*60}")
        print(f"{endpoint['name'].upper()} ENDPOINT SUMMARY")
        print(f"{'='*60}")
        print(f"Successful tests: {successful_tests}/{total_tests}")
        print(f"Success rate: {success_rate:.1f}%")
        
        # List failed tests
        failed_tests = [result['scenario'] for result in endpoint_results if not result['success']]
        if failed_tests:
            print(f"Failed tests: {', '.join(failed_tests)}")
        else:
            print("All tests passed! 🎉")
    
    # Overall summary
    print(f"\n{'#'*80}")
    print("OVERALL SUMMARY")
    print(f"{'#'*80}")
    
    for endpoint_name, endpoint_results in results.items():
        successful_tests = sum(1 for result in endpoint_results if result['success'])
        total_tests = len(endpoint_results)
        success_rate = (successful_tests / total_tests) * 100
        print(f"{endpoint_name}: {successful_tests}/{total_tests} ({success_rate:.1f}%)")
    
    return results

def debug_specific_issue():
    """Debug the specific Paris-Amsterdam travel time issue"""
    print(f"\n{'#'*80}")
    print("DEBUGGING PARIS-AMSTERDAM TRAVEL TIME ISSUE")
    print(f"{'#'*80}")
    
    test_message = "travel time between Paris and Amsterdam"
    
    for endpoint_name, url in [("Local", LOCAL_URL), ("Railway", RAILWAY_URL)]:
        print(f"\n--- Testing {endpoint_name} ---")
        
        payload = {
            "jsonrpc": "2.0",
            "id": 999,
            "method": "orchestrator.chat",
            "params": {
                "message": test_message,
                "user_id": "debug_user"
            }
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Response: {json.dumps(data, indent=2)}")
            else:
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"Exception: {str(e)}")

if __name__ == "__main__":
    print("🔧 TomTom MCP Multi-Agent System - Comprehensive Test Suite")
    print("=" * 80)
    
    # First debug the specific issue
    debug_specific_issue()
    
    # Then run comprehensive tests
    results = run_comprehensive_tests()
    
    print(f"\n🏁 Test suite completed at {datetime.now().isoformat()}")
