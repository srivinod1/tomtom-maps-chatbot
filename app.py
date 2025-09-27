#!/usr/bin/env python3
"""
Flask API server for TomTom Maps Chatbot Agent
Deployable on Railway
"""

import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from datetime import datetime

# Add the current directory to the path
sys.path.append(os.path.dirname(__file__))

from chatbot_agent import TomTomChatbotAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend integration

# Initialize the chatbot agent
# Use environment variable for MCP server URL (Railway will provide this)
mcp_server_url = os.getenv('MCP_SERVER_URL', 'http://localhost:3000')

# Check if we're running in Railway (production)
is_railway = os.getenv('RAILWAY_ENVIRONMENT') is not None

if is_railway:
    # In Railway, we'll use direct TomTom API calls instead of MCP server
    agent = TomTomChatbotAgent(mcp_server_url=None, use_direct_api=True)
else:
    # Local development - use MCP server
    agent = TomTomChatbotAgent(mcp_server_url=mcp_server_url)

@app.route('/')
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "TomTom Maps Chatbot API",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    """Main chat endpoint"""
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'message' field in request body"
            }), 400
        
        user_message = data['message']
        user_id = data.get('user_id', 'default')
        
        # Process the query
        result = agent.process_query(user_message, user_id)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}")
        return jsonify({
            "success": False,
            "error": "Internal server error",
            "response": "Sorry, I encountered an error processing your request."
        }), 500

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """Get chat history for a user"""
    try:
        user_id = request.args.get('user_id', 'default')
        limit = int(request.args.get('limit', 10))
        
        history = agent.get_conversation_history(user_id, limit)
        
        return jsonify({
            "success": True,
            "history": history,
            "user_id": user_id
        })
        
    except Exception as e:
        logger.error(f"Error getting chat history: {e}")
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500

@app.route('/api/context', methods=['POST'])
def set_user_context():
    """Set user context (e.g., current location)"""
    try:
        data = request.get_json()
        
        if not data or 'user_id' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'user_id' field in request body"
            }), 400
        
        user_id = data['user_id']
        context = data.get('context', {})
        
        agent.set_user_context(user_id, context)
        
        return jsonify({
            "success": True,
            "message": "Context updated successfully",
            "user_id": user_id
        })
        
    except Exception as e:
        logger.error(f"Error setting user context: {e}")
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500

@app.route('/api/context/<user_id>', methods=['GET'])
def get_user_context(user_id):
    """Get user context"""
    try:
        context = agent.get_user_context(user_id)
        
        return jsonify({
            "success": True,
            "context": context,
            "user_id": user_id
        })
        
    except Exception as e:
        logger.error(f"Error getting user context: {e}")
        return jsonify({
            "success": False,
            "error": "Internal server error"
        }), 500

@app.route('/api/capabilities', methods=['GET'])
def get_capabilities():
    """Get chatbot capabilities"""
    return jsonify({
        "success": True,
        "capabilities": {
            "search": "Search for places (restaurants, hotels, etc.)",
            "directions": "Get directions between locations",
            "geocoding": "Find coordinates for addresses",
            "reverse_geocoding": "Find addresses for coordinates",
            "static_maps": "Generate map images",
            "matrix_routing": "Calculate distance/time matrices",
            "general_knowledge": "Answer general questions"
        },
        "examples": [
            "Find restaurants near me",
            "How do I get from Seattle to Portland?",
            "What are the coordinates for 123 Main Street?",
            "What's at 47.6062, -122.3321?",
            "Show me a map of Seattle"
        ]
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500

if __name__ == '__main__':
    # Get port from environment variable (Railway provides this)
    port = int(os.getenv('PORT', 5000))
    
    # Run the app
    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.getenv('FLASK_ENV') == 'development'
    )
