#!/usr/bin/env python3
"""
Example Google ADK Agent using TomTom MCP Tools
This example shows how to create and use an ADK agent with TomTom Maps capabilities.
"""

import os
from dotenv import load_dotenv
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from tools import create_tomtom_mcp_toolset, get_available_tools
from adk import Agent

# Load environment variables
load_dotenv()

def create_tomtom_agent():
    """
    Create a Google ADK agent with TomTom MCP tools.
    
    Returns:
        Agent: Configured ADK agent with TomTom Maps capabilities
    """
    
    # Create the TomTom MCP toolset
    tomtom_toolset = create_tomtom_mcp_toolset()
    
    # Create the agent
    agent = Agent(
        name="TomTom Maps Assistant",
        description="An AI assistant with access to TomTom Maps services for location search, geocoding, routing, and mapping",
        toolsets=[tomtom_toolset]
    )
    
    return agent

def main():
    """
    Main function to demonstrate the TomTom ADK agent.
    """
    
    # Check for API key
    if not os.getenv('TOMTOM_API_KEY'):
        print("Error: TOMTOM_API_KEY environment variable not set.")
        print("Please set your TomTom API key in the .env file or environment.")
        print("Get your API key from: https://developer.tomtom.com/")
        return
    
    try:
        # Create the agent
        agent = create_tomtom_agent()
        
        print("TomTom Maps ADK Agent created successfully!")
        print("Available tools:")
        
        # Display available tools
        tools = get_available_tools()
        for tool_name, tool_info in tools.items():
            print(f"  - {tool_name}: {tool_info['description']}")
        
        print("\nExample queries you can ask:")
        print("  - 'Find coffee shops near 47.6062, -122.3321'")
        print("  - 'Get directions from Seattle to Bellevue'")
        print("  - 'What's the address for coordinates 47.6062, -122.3321?'")
        print("  - 'Show me a map of New York City'")
        
        # Example interaction
        print("\n" + "="*50)
        print("Example: Searching for coffee shops in Seattle...")
        
        # This would be how you'd query the agent in a real application
        # response = agent.query("Find coffee shops near 47.6062, -122.3321")
        # print(f"Agent response: {response}")
        
        print("Agent is ready to use TomTom Maps services!")
        
    except Exception as e:
        print(f"Error creating agent: {e}")
        print("Make sure you have:")
        print("1. Set TOMTOM_API_KEY environment variable")
        print("2. Installed required dependencies: pip install -r requirements.txt")
        print("3. The mcp-server.js file is in the same directory")

if __name__ == "__main__":
    main()

