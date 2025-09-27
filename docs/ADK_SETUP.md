# Google ADK Setup for TomTom MCP Tools

This guide explains how to set up and use the TomTom MCP server with Google ADK (Agent Development Kit).

## Prerequisites

1. **Node.js 18+**: Required for running the MCP server
2. **Python 3.8+**: Required for Google ADK
3. **TomTom API Key**: Get one from [TomTom Developer Portal](https://developer.tomtom.com/)

## Installation

### 1. Install Node.js Dependencies

```bash
npm install
```

### 2. Set Up Python Virtual Environment

```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

**Note:** Always activate the virtual environment before running Python scripts:
```bash
source venv/bin/activate
```

### 3. Set Up Environment Variables

Copy the example environment file and add your TomTom API key:

```bash
cp env.example .env
```

Edit `.env` and add your TomTom API key:

```
TOMTOM_API_KEY=your_actual_tomtom_api_key_here
PORT=3000
NODE_ENV=development
```

## Usage

### Option 1: Using the Python Tools Module

```python
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

### Option 2: Using the Example Agent

Run the example agent:

```bash
python agent_example.py
```

### Option 3: Direct MCP Server Usage

Start the MCP server directly:

```bash
npm start
```

The server will be available at `http://localhost:3000` and can handle JSON-RPC requests.

## Available Tools

The TomTom MCP server provides the following tools for ADK agents:

### 1. Location Search (`maps.search`)
Search for places using TomTom Orbis Maps Search API.

**Parameters:**
- `query`: Search query (e.g., "coffee shops in Seattle")
- `type`: Optional place type (restaurant, hotel, airport, etc.)
- `location`: Optional location bias with lat/lon coordinates

**Example:**
```python
agent.query("Find restaurants near 47.6062, -122.3321")
```

### 2. Geocoding (`maps.geocode`)
Convert addresses to coordinates.

**Parameters:**
- `address`: Address to geocode

**Example:**
```python
agent.query("What are the coordinates for 1600 Amphitheatre Parkway, Mountain View, CA?")
```

### 3. Reverse Geocoding (`maps.reverseGeocode`)
Convert coordinates to addresses.

**Parameters:**
- `lat`: Latitude coordinate
- `lon`: Longitude coordinate

**Example:**
```python
agent.query("What's the address for coordinates 47.6062, -122.3321?")
```

### 4. Directions (`maps.directions`)
Calculate routes between locations.

**Parameters:**
- `origin`: Origin location with lat/lon coordinates
- `destination`: Destination location with lat/lon coordinates
- `travelMode`: Travel mode (car, pedestrian, bicycle, truck, etc.)

**Example:**
```python
agent.query("Get directions from Seattle to Bellevue by car")
```

### 5. Matrix Routing (`maps.matrix`)
Calculate travel times and distances between multiple origins and destinations.

**Parameters:**
- `origins`: Array of origin locations
- `destinations`: Array of destination locations
- `travelMode`: Travel mode

**Example:**
```python
agent.query("Calculate travel times from multiple locations to downtown Seattle")
```

### 6. Static Maps (`maps.staticMap`)
Generate static map images for locations.

**Parameters:**
- `lat`: Latitude coordinate
- `lon`: Longitude coordinate
- `zoom`: Optional zoom level (default: 15)
- `width`: Optional image width (default: 512)
- `height`: Optional image height (default: 512)

**Example:**
```python
agent.query("Show me a map of New York City")
```

## Configuration

### Environment Variables

- `TOMTOM_API_KEY`: Your TomTom API key (required)
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

### MCP Server Configuration

The MCP server is configured in `tools.py` using `StdioServerParameters`:

```python
server_params = StdioServerParameters(
    command="node",
    args=["mcp-server.js"],
    env={
        "TOMTOM_API_KEY": tomtom_api_key,
        "NODE_ENV": "production"
    }
)
```

## Troubleshooting

### Common Issues

1. **"TOMTOM_API_KEY environment variable not set"**
   - Make sure you've set the API key in your `.env` file
   - Verify the key is valid at the TomTom Developer Portal

2. **"Module not found" errors**
   - Run `pip install -r requirements.txt` to install Python dependencies
   - Run `npm install` to install Node.js dependencies

3. **Connection issues**
   - Ensure the MCP server is running (`npm start`)
   - Check that the port (default 3000) is available

### Testing the Setup

1. **Test the MCP server directly:**
   ```bash
   npm start
   curl -X POST http://localhost:3000 \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"initialize","id":1}'
   ```

2. **Test the Python tools:**
   ```bash
   source venv/bin/activate
   python src/tools.py
   ```

3. **Test the example agent:**
   ```bash
   ./scripts/run_agent.sh
   # Or manually: source venv/bin/activate && python examples/agent_example.py
   ```

## Advanced Usage

### Custom Agent Configuration

You can customize the agent configuration by modifying the `create_tomtom_mcp_toolset()` function in `src/tools.py`:

```python
def create_custom_tomtom_toolset():
    server_params = StdioServerParameters(
        command="node",
        args=["src/mcp-server.js"],
        env={
            "TOMTOM_API_KEY": os.getenv('TOMTOM_API_KEY'),
            "NODE_ENV": "production",
            "LOG_LEVEL": "debug"  # Custom environment variable
        }
    )
    
    return MCPToolset.from_server(server_params)
```

### Multiple Toolsets

You can combine the TomTom toolset with other toolsets:

```python
import sys
import os
sys.path.append('src')
from tools import create_tomtom_mcp_toolset
from adk import Agent, SomeOtherToolset

tomtom_toolset = create_tomtom_mcp_toolset()
other_toolset = SomeOtherToolset()

agent = Agent(
    name="Multi-Tool Agent",
    toolsets=[tomtom_toolset, other_toolset]
)
```

## Support

For issues related to:
- **TomTom APIs**: Check the [TomTom Developer Documentation](https://developer.tomtom.com/)
- **Google ADK**: Check the [Google ADK Documentation](https://developers.google.com/adk)
- **MCP Protocol**: Check the [Model Context Protocol Documentation](https://github.com/modelcontextprotocol/mcp)
