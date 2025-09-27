#!/bin/bash

# Fix Google Cloud Permissions for TomTom MCP Observability
# Run this script to set up the correct permissions

PROJECT_ID="sunlit-precinct-473418-u9"
SERVICE_ACCOUNT_EMAIL="tomtom-mcp-observability@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🔧 Fixing Google Cloud Permissions for Project: $PROJECT_ID"
echo "📧 Service Account: $SERVICE_ACCOUNT_EMAIL"
echo ""

# Enable required APIs
echo "1️⃣ Enabling required APIs..."
gcloud services enable logging.googleapis.com --project=$PROJECT_ID
gcloud services enable monitoring.googleapis.com --project=$PROJECT_ID
gcloud services enable cloudtrace.googleapis.com --project=$PROJECT_ID
gcloud services enable aiplatform.googleapis.com --project=$PROJECT_ID

echo ""

# Create service account if it doesn't exist
echo "2️⃣ Creating service account..."
gcloud iam service-accounts create tomtom-mcp-observability \
    --display-name="TomTom MCP Comprehensive Observability" \
    --description="Service account for TomTom MCP tool calling observability" \
    --project=$PROJECT_ID || echo "Service account already exists"

echo ""

# Grant Logging permissions
echo "3️⃣ Granting Logging permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/logging.logWriter" \
    --project=$PROJECT_ID

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/logging.viewer" \
    --project=$PROJECT_ID

echo ""

# Grant Monitoring permissions
echo "4️⃣ Granting Monitoring permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/monitoring.metricWriter" \
    --project=$PROJECT_ID

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/monitoring.viewer" \
    --project=$PROJECT_ID

echo ""

# Grant Trace permissions
echo "5️⃣ Granting Trace permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/cloudtrace.agent" \
    --project=$PROJECT_ID

echo ""

# Grant Vertex AI permissions
echo "6️⃣ Granting Vertex AI permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/aiplatform.user" \
    --project=$PROJECT_ID

echo ""

# Create and download new service account key
echo "7️⃣ Creating new service account key..."
gcloud iam service-accounts keys create ./service-account-key-new.json \
    --iam-account=$SERVICE_ACCOUNT_EMAIL \
    --project=$PROJECT_ID

echo ""

# Test the new key
echo "8️⃣ Testing the new service account key..."
export GOOGLE_APPLICATION_CREDENTIALS=./service-account-key-new.json
export GOOGLE_CLOUD_PROJECT=$PROJECT_ID

node -e "
const { Logging } = require('@google-cloud/logging');
const logging = new Logging({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

async function testLogging() {
  try {
    const log = logging.log('tomtom-mcp-test');
    await log.write({
      severity: 'INFO',
      message: 'Test log entry after permission fix',
      timestamp: new Date().toISOString(),
      labels: {
        test: 'permission_fix'
      }
    });
    console.log('✅ SUCCESS: Google Cloud Logging is now working!');
    return true;
  } catch (error) {
    console.log('❌ FAILED: Google Cloud Logging error:', error.message);
    return false;
  }
}

testLogging().then(success => {
  if (success) {
    console.log('🎉 Permissions fixed successfully!');
    console.log('📝 Update your .env file with:');
    echo 'GOOGLE_APPLICATION_CREDENTIALS=./service-account-key-new.json'
  } else {
    console.log('❌ Permission fix failed. Please check the error above.');
  }
});
"

echo ""
echo "🏁 Permission fix script completed!"
echo ""
echo "📝 Next steps:"
echo "1. If the test passed, update your .env file:"
echo "   GOOGLE_APPLICATION_CREDENTIALS=./service-account-key-new.json"
echo "2. Restart your server:"
echo "   pkill -f unified-server && node src/unified-server.js"
echo "3. Test observability:"
echo "   python3 test_comprehensive_observability.py"
