# Notion API Deployment Guide

## Important: Environment Variables

When deploying with `--set-env-vars`, it **REPLACES ALL** environment variables. Always include all of them!

To **ADD** a new variable without replacing others, use:
```bash
gcloud run services update createnotionproject --region us-central1 --update-env-vars="NEW_VAR=value"
```

## Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `NOTION_API_KEY` | Internal integration API key |
| `NOTION_MASTER_PROJECTS_DB` | Master Ledger projects database ID |
| `NOTION_DELIVERABLES_DB` | Deliverables database ID |
| `NOTION_DAILY_RUNDOWN_DB` | Daily rundown database ID |
| `NOTION_PROD_EVENTS_DB` | Production events database ID |
| `NOTION_COMMERCIAL_SNAPSHOT_DB` | Commercial snapshot database ID |
| `NOTION_STAFF_DIR_DB` | Staff Directory database ID |
| `NOTION_OAUTH_CLIENT_ID` | OAuth client ID (public integration) |
| `NOTION_OAUTH_CLIENT_SECRET` | OAuth client secret |

## Deploy Command Template

```bash
cd ~/notion-clock/notion-api
gcloud run deploy createnotionproject --source . --region us-central1 --set-env-vars="NOTION_API_KEY=<your-api-key>,NOTION_MASTER_PROJECTS_DB=<id>,NOTION_DELIVERABLES_DB=<id>,NOTION_DAILY_RUNDOWN_DB=<id>,NOTION_PROD_EVENTS_DB=<id>,NOTION_COMMERCIAL_SNAPSHOT_DB=<id>,NOTION_STAFF_DIR_DB=<id>,NOTION_OAUTH_CLIENT_ID=<id>,NOTION_OAUTH_CLIENT_SECRET=<secret>"
```

Get the actual values from Cloud Run Console → createnotionproject → Edit → Variables tab.

## Service URL

https://createnotionproject-223535956454.us-central1.run.app

## OAuth Endpoints

- `GET /auth/notion` - Start OAuth flow
- `GET /auth/notion/callback` - OAuth callback
- `POST /auth/notion/user` - Get user info from token
- `POST /auth/notion/match-staff` - Match Notion user to Staff Directory
