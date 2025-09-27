#!/usr/bin/env python3
"""
Google ADK Tools Configuration for TomTom MCP Server
This file configures the TomTom MCP tools for use with Google ADK agents.
"""

import os
from adk import MCPToolset, StdioServerParameters

def create_tomtom_mcp_toolset():
    """
    Create and configure the TomTom MCP toolset for Google ADK.
    
    Returns:
        MCPToolset: Configured toolset for TomTom MCP server
    """
    
    # Get TomTom API key from environment variable
    tomtom_api_key = os.getenv('TOMTOM_API_KEY')
    
    if not tomtom_api_key:
        raise ValueError(
            "TOMTOM_API_KEY environment variable is required. "
            "Please set it with your TomTom API key from https://developer.tomtom.com/"
        )
    
    # Configure the MCP server parameters
    server_params = StdioServerParameters(
        command="node",
        args=["src/mcp-server.js"],
        env={
            "TOMTOM_API_KEY": tomtom_api_key,
            "NODE_ENV": "production"
        }
    )
    
    # Create the MCP toolset
    mcp_toolset = MCPToolset.from_server(server_params)
    
    return mcp_toolset

def get_available_tools():
    """
    Get information about available TomTom MCP tools.
    
    Returns:
        dict: Dictionary containing tool information
    """
    return {
        "maps.search": {
            "description": "Search for places using TomTom Orbis Maps Search API",
            "parameters": {
                "query": "Search query (e.g., 'coffee shops in Seattle')",
                "type": "Optional place type (restaurant, hotel, airport, etc.)",
                "location": "Optional location bias with lat/lon coordinates"
            },
            "example": {
                "query": "coffee shops near me",
                "type": "restaurant",
                "location": {"lat": 47.6062, "lon": -122.3321}
            }
        },
        "maps.geocode": {
            "description": "Convert addresses to coordinates using TomTom Geocoding API",
            "parameters": {
                "address": "Address to geocode"
            },
            "example": {
                "address": "1600 Amphitheatre Parkway, Mountain View, CA"
            }
        },
        "maps.reverseGeocode": {
            "description": "Convert coordinates to addresses using TomTom Reverse Geocoding API",
            "parameters": {
                "lat": "Latitude coordinate",
                "lon": "Longitude coordinate"
            },
            "example": {
                "lat": 47.6062,
                "lon": -122.3321
            }
        },
        "maps.directions": {
            "description": "Calculate routes between locations using TomTom Orbis Maps Routing API",
            "parameters": {
                "origin": "Origin location with lat/lon coordinates",
                "destination": "Destination location with lat/lon coordinates",
                "travelMode": "Travel mode (car, pedestrian, bicycle, truck, etc.)"
            },
            "example": {
                "origin": {"lat": 47.6062, "lon": -122.3321},
                "destination": {"lat": 47.6205, "lon": -122.3493},
                "travelMode": "car"
            }
        },
        "maps.matrix": {
            "description": "Calculate travel times and distances between multiple origins and destinations",
            "parameters": {
                "origins": "Array of origin locations with lat/lon coordinates",
                "destinations": "Array of destination locations with lat/lon coordinates",
                "travelMode": "Travel mode (car, pedestrian, bicycle, truck, etc.)"
            },
            "example": {
                "origins": [
                    {"lat": 47.6062, "lon": -122.3321},
                    {"lat": 47.6205, "lon": -122.3493}
                ],
                "destinations": [
                    {"lat": 47.6205, "lon": -122.3493},
                    {"lat": 47.6740, "lon": -122.1215}
                ],
                "travelMode": "car"
            }
        },
        "maps.staticMap": {
            "description": "Generate static map images for locations",
            "parameters": {
                "lat": "Latitude coordinate",
                "lon": "Longitude coordinate",
                "zoom": "Optional zoom level (default: 15)",
                "width": "Optional image width (default: 512)",
                "height": "Optional image height (default: 512)"
            },
            "example": {
                "lat": 47.6062,
                "lon": -122.3321,
                "zoom": 15,
                "width": 512,
                "height": 512
            }
        }
    }

# Example usage for ADK agent
def create_agent_with_tomtom_tools():
    """
    Example function showing how to create an ADK agent with TomTom MCP tools.
    
    Returns:
        Agent: Configured ADK agent with TomTom tools
    """
    from adk import Agent
    
    # Create the TomTom MCP toolset
    tomtom_toolset = create_tomtom_mcp_toolset()
    
    # Create the agent with the toolset
    agent = Agent(
        name="TomTom Maps Agent",
        description="An AI agent with access to TomTom Maps services",
        toolsets=[tomtom_toolset]
    )
    
    return agent

if __name__ == "__main__":
    # Print available tools information
    tools = get_available_tools()
    print("Available TomTom MCP Tools:")
    print("=" * 50)
    
    for tool_name, tool_info in tools.items():
        print(f"\n{tool_name}:")
        print(f"  Description: {tool_info['description']}")
        print(f"  Parameters: {tool_info['parameters']}")
        print(f"  Example: {tool_info['example']}")
    
    print("\n" + "=" * 50)
    print("To use these tools in your ADK agent:")
    print("1. Set TOMTOM_API_KEY environment variable")
    print("2. Import this module and call create_tomtom_mcp_toolset()")
    print("3. Add the toolset to your agent's toolsets list")

