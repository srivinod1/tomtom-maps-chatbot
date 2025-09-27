# GitHub Setup Instructions

## Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right corner
3. Select "New repository"
4. Repository name: `tomtom-maps-chatbot`
5. Description: `TomTom Maps Chatbot Agent with Railway deployment - Combines TomTom MCP tools with general knowledge`
6. Set visibility to **Public** (or Private if you prefer)
7. **DO NOT** initialize with README, .gitignore, or license (we already have these)
8. Click "Create repository"

## Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands to run. Use these commands:

```bash
# Add the remote origin (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/tomtom-maps-chatbot.git

# Push to GitHub
git push -u origin main
```

## Step 3: Verify Push

1. Go to your repository on GitHub
2. You should see all the files from your local project
3. The repository should contain:
   - `app.py` - Flask API server
   - `chatbot_agent.py` - Chatbot agent
   - `src/` - TomTom MCP server
   - `railway.json` - Railway config
   - `requirements.txt` - Dependencies
   - And all other project files

## Step 4: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up/Login with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `tomtom-maps-chatbot` repository
6. Railway will automatically detect it's a Python app

## Step 5: Configure Environment Variables

In your Railway project settings, add these environment variables:

```
TOMTOM_API_KEY=your_tomtom_api_key_here
MCP_SERVER_URL=http://localhost:3000
FLASK_ENV=production
```

## Step 6: Deploy

Railway will automatically:
- Install dependencies from `requirements.txt`
- Start the app using the `Procfile`
- Provide you with a public URL

## Step 7: Test Your Deployed API

Once deployed, test your API:

```bash
# Replace YOUR_RAILWAY_URL with your actual Railway URL
curl https://YOUR_RAILWAY_URL.railway.app/

# Test chat endpoint
curl -X POST https://YOUR_RAILWAY_URL.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello! What can you do?", "user_id": "test123"}'
```

## Repository Structure

Your GitHub repository will contain:

```
tomtom-maps-chatbot/
├── app.py                    # Flask API server
├── chatbot_agent.py          # Chatbot agent logic
├── src/
│   ├── mcp-server.js         # TomTom MCP server
│   ├── tomtom-maps/
│   │   └── index.js          # TomTom API integration
│   └── tools.py              # ADK tools
├── railway.json              # Railway deployment config
├── Procfile                  # Process definition
├── requirements.txt          # Python dependencies
├── runtime.txt               # Python version
├── test_api.py               # API test suite
├── RAILWAY_DEPLOYMENT.md     # Deployment guide
└── README.md                 # Project documentation
```

## Next Steps

After deployment:
1. Test all API endpoints
2. Integrate with your frontend
3. Set up monitoring and logging
4. Configure custom domain (optional)
5. Set up CI/CD for automatic deployments
