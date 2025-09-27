#!/bin/bash
# Test runner script for the TomTom MCP + Google ADK project

echo "Running TomTom MCP + Google ADK integration tests..."

# Activate virtual environment
source venv/bin/activate

# Run the integration tests
python examples/test_adk_integration.py

echo "Tests completed."

