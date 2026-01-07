# DMG Notion API

A Node.js Express API server for managing Notion projects, deliverables, and staff data. Designed for deployment on Google Cloud Run.

## Prerequisites

- Node.js 18 or higher
- A Notion integration with API access
- Google Cloud SDK (for deployment)

## Environment Variables

Set the following environment variables:

| Variable | Description |
|----------|-------------|
| `NOTION_API_KEY` | Your Notion integration API key |
| `NOTION_PROJECTS_DB` | The ID of your Notion Projects database |
| `NOTION_DELIVERABLES_DB` | (Optional) The ID of your Notion Deliverables database |

## Local Development

1. Install dependencies:
   ```bash
   cd notion-api
   npm install
   ```

2. Create a `.env` file with your environment variables:
   ```bash
   NOTION_API_KEY=your_notion_api_key
   NOTION_PROJECTS_DB=your_projects_database_id
   NOTION_DELIVERABLES_DB=your_deliverables_database_id
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. The server will be running at `http://localhost:8080`

## Deploy to Google Cloud Run

### Step 1: Navigate to the notion-api folder

```bash
cd notion-api
```

### Step 2: Login and set project (if not already done)

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Step 3: Deploy to Cloud Run

```bash
gcloud run deploy createnotionproject \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NOTION_API_KEY=YOUR_NOTION_API_KEY,NOTION_PROJECTS_DB=YOUR_PROJECTS_DB_ID"
```

**Important:** Make sure you run the deploy command from the `notion-api` folder (where this README is located).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/projects` | List all projects |
| POST | `/projects` | Create a new project |
| PATCH | `/projects/:id` | Update a project |
| GET | `/deliverables` | List deliverables |
| PATCH | `/deliverables/:id` | Update a deliverable |
| GET | `/staff` | List Notion workspace users |
| GET | `/capacity` | Get project counts per user |

## Testing the Deployment

After deploying, test the `/staff` endpoint:

```bash
curl https://YOUR_SERVICE_URL/staff
```

You should receive a JSON response with your Notion workspace users.

## Troubleshooting

### "Cannot GET /staff" Error

If you see this error after deployment, it likely means:

1. **Wrong source directory**: Make sure you're running `gcloud run deploy --source .` from the `notion-api` folder, not from the root of the repository or your home directory.

2. **Missing Notion API Key**: Verify the `NOTION_API_KEY` environment variable is set correctly.

3. **Check logs**: View Cloud Run logs in the Google Cloud Console for detailed error messages.

### Checking Logs

```bash
gcloud run services logs read createnotionproject --region us-central1
```
