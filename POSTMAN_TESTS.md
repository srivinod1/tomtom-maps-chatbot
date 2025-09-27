# Testing TomTom MCP Endpoints with Postman

This guide shows how to test all TomTom MCP endpoints using Postman.

## Prerequisites

1. **Start the MCP server:**
   ```bash
   cd /Users/srikanth/ADK-Agent
   npm start
   ```

2. **Set up your TomTom API key** in the `.env` file:
   ```
   TOMTOM_API_KEY=your_tomtom_api_key_here
   ```

## Postman Collection Setup

### Base URL
```
http://localhost:3000
```

### Headers (for all requests)
```
Content-Type: application/json
```

## 1. Location Search

**Endpoint:** `POST /api/tomtom/search`

**Request Body:**
```json
{
  "query": "coffee shops in Seattle",
  "type": "restaurant",
  "location": {
    "lat": 47.6062,
    "lon": -122.3321
  }
}
```

**Expected Response:**
```json
{
  "places": [
    {
      "name": "Starbucks",
      "formatted_address": "123 Main St, Seattle, WA",
      "location": {
        "lat": 47.6062,
        "lng": -122.3321
      },
      "types": ["restaurant"],
      "place_id": "12345",
      "rating": 4.5,
      "user_ratings_total": 100,
      "vicinity": "Main St",
      "opening_hours": {
        "open_now": true
      },
      "static_map_url": "https://api.tomtom.com/map/1/staticimage?..."
    }
  ]
}
```

## 2. Geocoding

**Endpoint:** `POST /api/tomtom/geocode`

**Request Body:**
```json
{
  "address": "1600 Amphitheatre Parkway, Mountain View, CA"
}
```

**Expected Response:**
```json
{
  "results": [
    {
      "formatted_address": "1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA",
      "geometry": {
        "location": {
          "lat": 37.4220656,
          "lng": -122.0840897
        }
      },
      "place_id": "ChIJ2eUgeAK6j4ARbn5u_wAGqWA",
      "types": ["street_address"]
    }
  ]
}
```

## 3. Reverse Geocoding

**Endpoint:** `POST /api/tomtom/reversegeocode`

**Request Body:**
```json
{
  "lat": 47.6062,
  "lon": -122.3321
}
```

**Expected Response:**
```json
{
  "results": [
    {
      "formatted_address": "909 5th Avenue, Seattle, WA 98164",
      "geometry": {
        "location": {
          "lat": 47.6062,
          "lng": -122.3321
        }
      },
      "place_id": "12345",
      "types": ["street_address"],
      "address_components": [
        {
          "long_name": "909",
          "short_name": "909",
          "types": ["street_number"]
        },
        {
          "long_name": "5th Avenue",
          "short_name": "5th Ave",
          "types": ["route"]
        }
      ]
    }
  ]
}
```

## 4. Directions/Routing

**Endpoint:** `POST /api/tomtom/directions`

**Request Body:**
```json
{
  "origin": {
    "lat": 47.6062,
    "lon": -122.3321
  },
  "destination": {
    "lat": 47.6101,
    "lon": -122.2015
  },
  "travelMode": "car"
}
```

**Expected Response:**
```json
{
  "routes": [
    {
      "summary": {
        "distance": {
          "text": "15.2 km",
          "value": 15200
        },
        "duration": {
          "text": "18 mins",
          "value": 1080
        }
      },
      "legs": [
        {
          "distance": {
            "text": "15.2 km",
            "value": 15200
          },
          "duration": {
            "text": "18 mins",
            "value": 1080
          },
          "steps": [
            {
              "distance": {
                "text": "0.5 km",
                "value": 500
              },
              "duration": {
                "text": "1 min",
                "value": 60
              },
              "end_location": {
                "lat": 47.6101,
                "lng": -122.2015
              },
              "start_location": {
                "lat": 47.6062,
                "lng": -122.3321
              },
              "instructions": "Head east on 5th Avenue"
            }
          ]
        }
      ]
    }
  ]
}
```

## 5. Static Map

**Endpoint:** `POST /api/tomtom/staticmap`

**Request Body:**
```json
{
  "lat": 40.7128,
  "lon": -74.0060,
  "zoom": 15,
  "width": 512,
  "height": 512
}
```

**Expected Response:**
```json
{
  "url": "https://api.tomtom.com/map/1/staticimage?key=YOUR_API_KEY&center=-74.006%2C40.7128&zoom=15&width=512&height=512&format=png&markers=color%3Ared%7C-74.006%2C40.7128&view=Unified"
}
```

## 6. Matrix Routing

**Endpoint:** `POST /api/tomtom/matrix`

**Request Body:**
```json
{
  "origins": [
    {
      "lat": 47.6062,
      "lon": -122.3321
    },
    {
      "lat": 47.6101,
      "lon": -122.2015
    }
  ],
  "destinations": [
    {
      "lat": 47.6101,
      "lon": -122.2015
    },
    {
      "lat": 47.6740,
      "lon": -122.1215
    }
  ],
  "travelMode": "car"
}
```

**Expected Response:**
```json
{
  "rows": [
    {
      "elements": [
        {
          "status": "OK",
          "distance": {
            "value": 0,
            "text": "0 km"
          },
          "duration": {
            "value": 0,
            "text": "0 mins"
          }
        },
        {
          "status": "OK",
          "distance": {
            "value": 15200,
            "text": "15.2 km"
          },
          "duration": {
            "value": 1080,
            "text": "18 mins"
          }
        }
      ]
    },
    {
      "elements": [
        {
          "status": "OK",
          "distance": {
            "value": 15200,
            "text": "15.2 km"
          },
          "duration": {
            "value": 1080,
            "text": "18 mins"
          }
        },
        {
          "status": "OK",
          "distance": {
            "value": 8500,
            "text": "8.5 km"
          },
          "duration": {
            "value": 600,
            "text": "10 mins"
          }
        }
      ]
    }
  ]
}
```

## Postman Collection Import

You can import this collection into Postman:

```json
{
  "info": {
    "name": "TomTom MCP Server",
    "description": "Test collection for TomTom MCP endpoints",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Location Search",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"query\": \"coffee shops in Seattle\",\n  \"type\": \"restaurant\",\n  \"location\": {\n    \"lat\": 47.6062,\n    \"lon\": -122.3321\n  }\n}"
        },
        "url": {
          "raw": "http://localhost:3000/api/tomtom/search",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "tomtom", "search"]
        }
      }
    },
    {
      "name": "Reverse Geocoding",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"lat\": 47.6062,\n  \"lon\": -122.3321\n}"
        },
        "url": {
          "raw": "http://localhost:3000/api/tomtom/reversegeocode",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "tomtom", "reversegeocode"]
        }
      }
    },
    {
      "name": "Static Map",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"lat\": 40.7128,\n  \"lon\": -74.0060,\n  \"zoom\": 15,\n  \"width\": 512,\n  \"height\": 512\n}"
        },
        "url": {
          "raw": "http://localhost:3000/api/tomtom/staticmap",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3000",
          "path": ["api", "tomtom", "staticmap"]
        }
      }
    }
  ]
}
```

## Testing Steps

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Open Postman** and create a new collection

3. **Add the requests** using the endpoints above

4. **Test each endpoint** with the provided request bodies

5. **Check responses** against the expected formats

## Troubleshooting

- **404 errors:** Make sure the server is running on port 3000
- **500 errors:** Check your TomTom API key in the `.env` file
- **Connection refused:** Ensure the MCP server is started with `npm start`

## Expected Results

- ✅ **Reverse Geocoding:** Should work (already tested)
- ✅ **Static Map:** Should work (already tested)  
- ⚠️ **Location Search:** May need API endpoint fix
- ⚠️ **Directions:** May need API endpoint fix
- ⚠️ **Matrix Routing:** May need API endpoint fix
