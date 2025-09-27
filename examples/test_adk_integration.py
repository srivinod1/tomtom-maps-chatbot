#!/usr/bin/env python3
"""
Test script for Google ADK integration with TomTom MCP tools
This script tests the integration and provides examples of usage.
"""

import os
import sys
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_environment():
    """Test if the environment is properly configured."""
    print("Testing environment configuration...")
    
    # Check for TomTom API key
    api_key = os.getenv('TOMTOM_API_KEY')
    if not api_key:
        print("❌ TOMTOM_API_KEY environment variable not set")
        return False
    else:
        print(f"✅ TOMTOM_API_KEY is set (length: {len(api_key)})")
    
    # Check for required files
    required_files = ['src/mcp-server.js', 'src/tools.py', 'requirements.txt']
    for file in required_files:
        if os.path.exists(file):
            print(f"✅ {file} exists")
        else:
            print(f"❌ {file} not found")
            return False
    
    return True

def test_tools_module():
    """Test the tools module."""
    print("\nTesting tools module...")
    
    try:
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
        from tools import get_available_tools, create_tomtom_mcp_toolset
        print("✅ Successfully imported tools module")
        
        # Test getting available tools
        tools = get_available_tools()
        print(f"✅ Found {len(tools)} available tools:")
        for tool_name in tools.keys():
            print(f"   - {tool_name}")
        
        return True
        
    except ImportError as e:
        print(f"❌ Failed to import tools module: {e}")
        return False
    except Exception as e:
        print(f"❌ Error testing tools module: {e}")
        return False

def test_mcp_server():
    """Test if the MCP server can be started."""
    print("\nTesting MCP server...")
    
    try:
        import subprocess
        import time
        
        # Start the server in the background
        process = subprocess.Popen(
            ['node', 'src/mcp-server.js'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=dict(os.environ, TOMTOM_API_KEY=os.getenv('TOMTOM_API_KEY', ''))
        )
        
        # Wait a moment for the server to start
        time.sleep(2)
        
        # Check if the process is still running
        if process.poll() is None:
            print("✅ MCP server started successfully")
            
            # Terminate the test server
            process.terminate()
            process.wait()
            return True
        else:
            stdout, stderr = process.communicate()
            print(f"❌ MCP server failed to start")
            print(f"   stdout: {stdout.decode()}")
            print(f"   stderr: {stderr.decode()}")
            return False
            
    except FileNotFoundError:
        print("❌ Node.js not found. Please install Node.js 18+")
        return False
    except Exception as e:
        print(f"❌ Error testing MCP server: {e}")
        return False

def test_adk_integration():
    """Test the ADK integration."""
    print("\nTesting ADK integration...")
    
    try:
        # Try to import ADK
        from adk import MCPToolset, StdioServerParameters
        print("✅ Successfully imported ADK modules")
        
        # Test creating the toolset
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
        from tools import create_tomtom_mcp_toolset
        toolset = create_tomtom_mcp_toolset()
        print("✅ Successfully created TomTom MCP toolset")
        
        return True
        
    except ImportError as e:
        print(f"❌ Failed to import ADK: {e}")
        print("   Make sure you have installed: pip install -r requirements.txt")
        return False
    except Exception as e:
        print(f"❌ Error testing ADK integration: {e}")
        return False

def run_example_queries():
    """Run example queries to test the integration."""
    print("\nRunning example queries...")
    
    try:
        import sys
        import os
        sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
        from tools import create_tomtom_mcp_toolset
        from adk import Agent
        
        # Create the agent
        toolset = create_tomtom_mcp_toolset()
        agent = Agent(
            name="Test TomTom Agent",
            description="Test agent for TomTom Maps",
            toolsets=[toolset]
        )
        
        print("✅ Successfully created ADK agent with TomTom tools")
        
        # Example queries (commented out to avoid actual API calls during testing)
        example_queries = [
            "Find coffee shops near 47.6062, -122.3321",
            "What's the address for coordinates 47.6062, -122.3321?",
            "Get directions from Seattle to Bellevue",
            "Show me a map of New York City"
        ]
        
        print("Example queries that can be run:")
        for i, query in enumerate(example_queries, 1):
            print(f"   {i}. {query}")
        
        print("\nTo run these queries, use:")
        print("   response = agent.query('your query here')")
        print("   print(response)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error running example queries: {e}")
        return False

def main():
    """Main test function."""
    print("TomTom MCP + Google ADK Integration Test")
    print("=" * 50)
    
    tests = [
        ("Environment Configuration", test_environment),
        ("Tools Module", test_tools_module),
        ("MCP Server", test_mcp_server),
        ("ADK Integration", test_adk_integration),
        ("Example Queries", run_example_queries)
    ]
    
    results = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Summary:")
    print("=" * 50)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("\n🎉 All tests passed! Your TomTom MCP + Google ADK integration is ready to use.")
        print("\nNext steps:")
        print("1. Run: python agent_example.py")
        print("2. Or integrate the tools into your own ADK agent")
    else:
        print("\n⚠️  Some tests failed. Please check the errors above and fix them.")
        print("\nCommon solutions:")
        print("1. Set TOMTOM_API_KEY in your .env file")
        print("2. Install dependencies: pip install -r requirements.txt")
        print("3. Install Node.js dependencies: npm install")
        print("4. Check that all required files are present")

if __name__ == "__main__":
    main()

