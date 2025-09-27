#!/bin/bash
# Activation script for the TomTom MCP + Google ADK project

echo "Activating TomTom MCP + Google ADK environment..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Creating it..."
    python3 -m venv venv
    echo "Virtual environment created."
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade dependencies
echo "Installing/updating dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Check for .env file
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found."
    echo "Please copy env.example to .env and add your TomTom API key:"
    echo "  cp env.example .env"
    echo "  # Then edit .env and add your TOMTOM_API_KEY"
fi

echo "Environment activated successfully!"
echo "To deactivate, run: deactivate"
echo ""
echo "Available commands:"
echo "  python examples/test_adk_integration.py  - Test the integration"
echo "  python examples/agent_example.py         - Run example agent"
echo "  npm start                        - Start MCP server"
echo "  npm run dev                      - Start MCP server in dev mode"

