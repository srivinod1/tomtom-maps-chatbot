#!/bin/bash
# Agent runner script for the TomTom MCP + Google ADK project

echo "Starting TomTom Maps ADK Agent..."

# Activate virtual environment
source venv/bin/activate

# Run the example agent
python examples/agent_example.py

echo "Agent session completed."

