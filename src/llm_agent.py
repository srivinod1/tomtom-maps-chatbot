#!/usr/bin/env python3
"""
LLM Integration for Multi-Agent System
This module provides LLM capabilities for natural language processing
"""

import os
import json
import requests
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMProvider:
    """Base class for LLM providers"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def generate_response(self, prompt: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate a response using the LLM"""
        raise NotImplementedError("Subclasses must implement generate_response")
    
    def extract_intent(self, query: str) -> Dict[str, Any]:
        """Extract intent and entities from a query"""
        raise NotImplementedError("Subclasses must implement extract_intent")

class OpenAIProvider(LLMProvider):
    """OpenAI GPT integration"""
    
    def __init__(self, api_key: str, model: str = "gpt-3.5-turbo"):
        super().__init__(api_key)
        self.model = model
        self.base_url = "https://api.openai.com/v1/chat/completions"
    
    def generate_response(self, prompt: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate response using OpenAI GPT"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            # Build messages
            messages = [
                {"role": "system", "content": "You are a helpful assistant that can help with location-based queries and general questions."}
            ]
            
            # Add context if provided
            if context:
                context_str = json.dumps(context, indent=2)
                messages.append({"role": "system", "content": f"Context: {context_str}"})
            
            # Add user prompt
            messages.append({"role": "user", "content": prompt})
            
            payload = {
                "model": self.model,
                "messages": messages,
                "max_tokens": 500,
                "temperature": 0.7
            }
            
            response = requests.post(self.base_url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            return {
                "success": True,
                "response": result["choices"][0]["message"]["content"],
                "usage": result.get("usage", {}),
                "model": self.model
            }
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I couldn't generate a response right now."
            }
    
    def extract_intent(self, query: str) -> Dict[str, Any]:
        """Extract intent and entities using OpenAI"""
        try:
            prompt = f"""
            Analyze this query and extract the intent and key entities:
            Query: "{query}"
            
            Return a JSON response with:
            - intent: the main intent (search, directions, geocoding, general, etc.)
            - entities: key entities like locations, addresses, coordinates
            - confidence: confidence score (0-1)
            - query_type: the type of query
            
            Example:
            {{
                "intent": "search",
                "entities": {{"location": "Seattle", "search_term": "coffee shops"}},
                "confidence": 0.9,
                "query_type": "location_search"
            }}
            """
            
            result = self.generate_response(prompt)
            if result["success"]:
                try:
                    # Try to parse the JSON response
                    intent_data = json.loads(result["response"])
                    return intent_data
                except json.JSONDecodeError:
                    # Fallback if JSON parsing fails
                    return {
                        "intent": "general",
                        "entities": {},
                        "confidence": 0.5,
                        "query_type": "unknown"
                    }
            else:
                return {
                    "intent": "general",
                    "entities": {},
                    "confidence": 0.3,
                    "query_type": "unknown"
                }
                
        except Exception as e:
            logger.error(f"Intent extraction error: {e}")
            return {
                "intent": "general",
                "entities": {},
                "confidence": 0.1,
                "query_type": "error"
            }

class AnthropicProvider(LLMProvider):
    """Anthropic Claude integration"""
    
    def __init__(self, api_key: str, model: str = "claude-3-sonnet-20240229"):
        super().__init__(api_key)
        self.model = model
        self.base_url = "https://api.anthropic.com/v1/messages"
    
    def generate_response(self, prompt: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Generate response using Anthropic Claude"""
        try:
            headers = {
                "x-api-key": self.api_key,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01"
            }
            
            # Build message content
            content = prompt
            if context:
                context_str = json.dumps(context, indent=2)
                content = f"Context: {context_str}\n\nUser: {prompt}"
            
            payload = {
                "model": self.model,
                "max_tokens": 500,
                "messages": [
                    {
                        "role": "user",
                        "content": content
                    }
                ]
            }
            
            response = requests.post(self.base_url, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            return {
                "success": True,
                "response": result["content"][0]["text"],
                "usage": result.get("usage", {}),
                "model": self.model
            }
            
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I couldn't generate a response right now."
            }
    
    def extract_intent(self, query: str) -> Dict[str, Any]:
        """Extract intent and entities using Anthropic Claude"""
        try:
            prompt = f"""
            Analyze this query and extract the intent and key entities:
            Query: "{query}"
            
            Return a JSON response with:
            - intent: the main intent (search, directions, geocoding, general, etc.)
            - entities: key entities like locations, addresses, coordinates
            - confidence: confidence score (0-1)
            - query_type: the type of query
            
            Example:
            {{
                "intent": "search",
                "entities": {{"location": "Seattle", "search_term": "coffee shops"}},
                "confidence": 0.9,
                "query_type": "location_search"
            }}
            """
            
            result = self.generate_response(prompt)
            if result["success"]:
                try:
                    # Try to parse the JSON response
                    intent_data = json.loads(result["response"])
                    return intent_data
                except json.JSONDecodeError:
                    # Fallback if JSON parsing fails
                    return {
                        "intent": "general",
                        "entities": {},
                        "confidence": 0.5,
                        "query_type": "unknown"
                    }
            else:
                return {
                    "intent": "general",
                    "entities": {},
                    "confidence": 0.3,
                    "query_type": "unknown"
                }
                
        except Exception as e:
            logger.error(f"Intent extraction error: {e}")
            return {
                "intent": "general",
                "entities": {},
                "confidence": 0.1,
                "query_type": "error"
            }

class LLMAgent:
    """LLM-powered agent for natural language processing"""
    
    def __init__(self, provider: str = "openai", api_key: str = None, model: str = None):
        self.provider_name = provider
        self.api_key = api_key or os.getenv(f"{provider.upper()}_API_KEY")
        
        if not self.api_key:
            raise ValueError(f"{provider.upper()}_API_KEY environment variable is required")
        
        # Initialize the provider
        if provider.lower() == "openai":
            self.llm = OpenAIProvider(self.api_key, model or "gpt-3.5-turbo")
        elif provider.lower() == "anthropic":
            self.llm = AnthropicProvider(self.api_key, model or "claude-3-sonnet-20240229")
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")
        
        logger.info(f"✅ LLM Agent initialized with {provider}")
    
    def process_query(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Process a query using the LLM"""
        try:
            # Extract intent and entities
            intent_data = self.llm.extract_intent(query)
            
            # Generate response
            response = self.llm.generate_response(query, context)
            
            return {
                "success": response["success"],
                "response": response.get("response", ""),
                "intent": intent_data,
                "usage": response.get("usage", {}),
                "model": response.get("model", ""),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"LLM Agent error: {e}")
            return {
                "success": False,
                "error": str(e),
                "response": "Sorry, I encountered an error processing your query.",
                "timestamp": datetime.now().isoformat()
            }
    
    def enhance_response(self, base_response: str, query: str, context: Dict[str, Any] = None) -> str:
        """Enhance a base response using LLM"""
        try:
            prompt = f"""
            Enhance this response to be more helpful and natural:
            
            Original Query: "{query}"
            Base Response: "{base_response}"
            
            Make the response more conversational and helpful while keeping the core information.
            """
            
            result = self.llm.generate_response(prompt, context)
            if result["success"]:
                return result["response"]
            else:
                return base_response
                
        except Exception as e:
            logger.error(f"Response enhancement error: {e}")
            return base_response

# Example usage
if __name__ == "__main__":
    # Test with OpenAI (requires OPENAI_API_KEY environment variable)
    try:
        llm_agent = LLMAgent(provider="openai")
        
        test_queries = [
            "Find coffee shops near me",
            "How do I get to the airport?",
            "What's the weather like today?",
            "Hello, how are you?"
        ]
        
        print("🤖 LLM Agent Test")
        print("=" * 50)
        
        for query in test_queries:
            print(f"\n👤 Query: {query}")
            result = llm_agent.process_query(query)
            print(f"🤖 Response: {result['response']}")
            print(f"🎯 Intent: {result['intent']['intent']}")
            print(f"📊 Confidence: {result['intent']['confidence']:.2f}")
            print("-" * 50)
            
    except ValueError as e:
        print(f"❌ {e}")
        print("Please set the OPENAI_API_KEY environment variable to test the LLM agent.")
