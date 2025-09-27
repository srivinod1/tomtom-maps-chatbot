# TomTom Maps MCP Server for Google ADK

This server provides a [Model Context Protocol](https://github.com/modelcontextprotocol/mcp) integration for TomTom Maps, allowing AI assistants to access mapping data, location search, and routing capabilities from TomTom. It's specifically configured for use with Google ADK (Agent Development Kit).

## Features

- **Location Search**: Search for places using TomTom Orbis Maps Search API
- **Geocoding**: Convert addresses to coordinates using TomTom Geocoding API
- **Reverse Geocoding**: Convert coordinates to addresses using TomTom Reverse Geocoding API
- **Directions**: Calculate routes between locations using TomTom Orbis Maps Routing API
- **Matrix Routing**: Calculate travel times and distances between multiple origins and destinations
- **Static Maps**: Generate static map images for locations

## Getting Started

### Prerequisites

- Node.js 18 or higher
- Python 3.8 or higher (for Google ADK)
- A TomTom API key (get one from [TomTom Developer Portal](https://developer.tomtom.com/))

### Installation

1. Clone this repository
   ```bash
   git clone https://github.com/yourusername/tomtom-mcp-server.git
   cd tomtom-mcp-server
   ```

2. Set up the virtual environment and install dependencies
   ```bash
   # Use the activation script (recommended)
   ./activate.sh
   
   # Or manually:
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. Install Node.js dependencies
   ```bash
   npm install
   ```

4. Set up environment variables
   ```bash
   cp env.example .env
   ```
   
5. Edit `.env` file and add your TomTom API key
   ```
   TOMTOM_API_KEY=your_tomtom_api_key_here
   ```

6. Test the integration
   ```bash
   ./scripts/run_tests.sh
   # Or manually: source venv/bin/activate && python examples/test_adk_integration.py
   ```

7. Start the server
   ```bash
   npm start
   ```

The server will start at `http://localhost:3000` by default.

### Quick Start with Google ADK

1. **Set up your environment** (follow steps 1-5 above)

2. **Create an ADK agent with TomTom tools:**
   ```python
   import sys
   import os
   sys.path.append('src')
   from tools import create_tomtom_mcp_toolset
   from adk import Agent
   
   # Create the TomTom MCP toolset
   tomtom_toolset = create_tomtom_mcp_toolset()
   
   # Create your ADK agent
   agent = Agent(
       name="My Maps Agent",
       description="An agent with TomTom Maps capabilities",
       toolsets=[tomtom_toolset]
   )
   
   # Use the agent
   response = agent.query("Find coffee shops near 47.6062, -122.3321")
   print(response)
   ```

3. **Or run the example agent:**
   ```bash
   ./scripts/run_agent.sh
   # Or manually: source venv/bin/activate && python examples/agent_example.py
   ```

For detailed setup instructions, see [docs/ADK_SETUP.md](docs/ADK_SETUP.md).

## API Endpoints

### Location Search (TomTom Orbis Maps Search API)

```
POST /api/tomtom/search
```

Request body:
```json
{
  "query": "coffee shops in Seattle",
  "type": "restaurant", // Optional
  "location": { // Optional
    "lat": 47.6062,
    "lon": -122.3321
  }
}
```

### Geocoding (TomTom Geocoding API)

```
POST /api/tomtom/geocode
```

Request body:
```json
{
  "address": "1600 Amphitheatre Parkway, Mountain View, CA"
}
```

### Reverse Geocoding (TomTom Reverse Geocoding API)

```
POST /api/tomtom/reversegeocode
```

Request body:
```json
{
  "lat": 47.6062,
  "lon": -122.3321
}
```

### Directions (TomTom Orbis Maps Routing API)

```
POST /api/tomtom/directions
```

Request body:
```json
{
  "origin": {
    "lat": 47.6062,
    "lon": -122.3321
  },
  "destination": {
    "lat": 47.6205,
    "lon": -122.3493
  },
  "travelMode": "car" // Optional, can be 'car', 'pedestrian', 'bicycle', 'truck', 'bus', 'van', 'motorcycle', 'taxi'
}
```

### Matrix Routing (TomTom Matrix Routing API)

```
POST /api/tomtom/matrix
```

Request body:
```json
{
  "origins": [
    { "lat": 47.6062, "lon": -122.3321 },
    { "lat": 47.6205, "lon": -122.3493 }
  ],
  "destinations": [
    { "lat": 47.6205, "lon": -122.3493 },
    { "lat": 47.6740, "lon": -122.1215 }
  ],
  "travelMode": "car" // Optional, can be 'car', 'pedestrian', 'bicycle', 'truck', etc.
}
```

### Static Map

```
POST /api/tomtom/staticmap
```

Request body:
```json
{
  "lat": 47.6062,
  "lon": -122.3321,
  "zoom": 15, // Optional
  "width": 512, // Optional
  "height": 512 // Optional
}
```

## Integration with Model Context Protocol

This server is designed to be used as a data source for AI models that implement the Model Context Protocol (MCP). To make this server available to your AI assistant:

1. Deploy this server to a publicly accessible endpoint
2. Register the server with your AI assistant provider's MCP implementation
3. Configure the appropriate permissions for your AI assistant to access this server

## TomTom API Documentation

For more information about the TomTom APIs used in this server:

- [TomTom Orbis Maps Search API](https://developer.tomtom.com/search-api/documentation/tomtom-orbis-maps/product-information/introduction)
- [TomTom Geocoding API](https://developer.tomtom.com/geocoding-api/documentation/product-information/introduction)
- [TomTom Reverse Geocoding API](https://developer.tomtom.com/reverse-geocoding-api/documentation/product-information/introduction)
- [TomTom Orbis Maps Routing API](https://developer.tomtom.com/routing-api/documentation/tomtom-orbis-maps/routing-service)
- [TomTom Matrix Routing API](https://developer.tomtom.com/matrix-routing-v2-api/documentation/synchronous-matrix)
- [TomTom Static Map API](https://developer.tomtom.com/maps-api/maps-api-documentation/static-maps)

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Connecting to Claude

This server is designed to be used as a Model Context Protocol (MCP) tool with Claude Desktop or any Claude instance that supports MCP tool integration.

### Using with Claude Desktop

1. **Start your TomTom MCP server locally**  
   Make sure your server is running (see "Getting Started" above).

2. **Configure Claude Desktop to use your MCP server:**  
   - Open the Claude Desktop configuration file (usually found at  
     `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS).
   - Add or update the `mcpServers` section to include your TomTom server.  
     Example:
     ```json
     {
       "mcpServers": {
         "tomtom-maps": {
           "command": "npx",
           "args": [
             "-y",
             "@srivinod1/server-tomtom-maps"
           ],
           "env": {
             "TOMTOM_API_KEY": "your_tomtom_api_key_here"
           }
         }
       }
     }
     ```
   - If you are running your own local server (not via `npx`), you can configure Claude Desktop to connect to it by specifying the URL and port:
     ```json
     {
       "mcpServers": {
         "tomtom-maps": {
           "url": "http://localhost:3000"
         }
       }
     }
     ```

3. **Restart Claude Desktop**  
   After updating the configuration, restart Claude Desktop to load the new MCP server.

4. **Test the integration**  
   Ask Claude to use TomTom Maps features (e.g., "Find coffee shops near me using TomTom Maps") and it should use your local MCP server.

### Notes

- Make sure your `.env` file contains a valid TomTom API key.
- If you want to use this server with Claude in the cloud or from other devices, you must deploy it to a publicly accessible endpoint and update the configuration accordingly.