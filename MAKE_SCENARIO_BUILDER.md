# Make.com Scenario Module Builder

Automates adding modules to a Make.com scenario via the API, avoiding the need to manually click through the UI 120+ times.

## Overview

This script adds 4 modules to each of 6 routes in your Make.com scenario:

| # | Module | Type |
|---|--------|------|
| 1 | Create Edit Task | Notion "Create Database Item" |
| 2 | Create Thumbnail Task | Notion "Create Database Item" |
| 3 | Sync Edit to Firebase | HTTP POST |
| 4 | Sync Thumbnail to Firebase | HTTP POST |

**Routes:** MAIN, SPORT, RESPAWN, MONEY, SPOTLIGHT, UK

**Total modules created:** 24

## Setup

### 1. Install dependencies

```bash
pip install -r requirements-make.txt
```

### 2. Get your Make.com API token

1. Go to Make.com
2. Click your profile icon → **Profile**
3. Go to **API** tab
4. Create a new token with appropriate permissions

### 3. Find your Scenario ID

The scenario ID is in the URL when viewing your scenario:
```
https://us1.make.com/scenarios/123456/edit
                              ^^^^^^
                              This is your scenario ID
```

### 4. Find connection IDs (using inspect mode)

Run the script in inspect mode to discover connection IDs:

```bash
# First, edit the script to add your API_TOKEN and SCENARIO_ID
python make_scenario_builder.py --inspect
```

This will show you all modules in your scenario and their connection IDs.

### 5. Configure the script

Edit `make_scenario_builder.py` and fill in the configuration section:

```python
# Your Make.com API token
API_TOKEN = "your-api-token-here"

# Your scenario ID
SCENARIO_ID = "123456"

# Connection IDs (from --inspect output)
NOTION_CONNECTION_ID = "12345"
NOTION_DATA_SOURCE_ID = "your-database-id"
```

## Usage

### Dry-run mode (recommended first)

Preview what will be created without making any API calls:

```bash
python make_scenario_builder.py --dry-run
```

Output:
```
🔍 DRY-RUN MODE - No API calls will be made

🛤️  Processing route: MAIN
  [DRY-RUN] Would create: Create Edit Task (MAIN)
            Mock ID: 101
  [DRY-RUN] Would create: Create Thumbnail Task (MAIN)
            Mock ID: 102
  ...

📊 SUMMARY
✅ MAIN         → Modules: 101, 102, 103, 104
✅ SPORT        → Modules: 105, 106, 107, 108
...

🎉 Total modules would be created: 24
```

### Execute mode

Create the modules for real:

```bash
python make_scenario_builder.py
```

You'll be asked to confirm before execution.

### Inspect mode

View your scenario structure and find connection IDs:

```bash
python make_scenario_builder.py --inspect
```

## Route Configuration

The script is pre-configured with these module IDs:

| Route | Episode Module ID | Insert After Module ID |
|-------|-------------------|------------------------|
| MAIN | 3 | 4 |
| SPORT | 5 | 6 |
| RESPAWN | 7 | 8 |
| MONEY | 9 | 10 |
| SPOTLIGHT | 11 | 12 |
| UK | 16 | 17 |

If your scenario has different module IDs, update the `ROUTES` dictionary in the script.

## Module Configurations

### Edit Task (Notion)

Creates a task in Notion with:
- **Name:** `📹 Edit – {Episode Title}`
- **Parent:** Episode ID from the route
- **Due Date:** From trigger's PLANNED LIVE DATE
- **Status:** Not Started
- **Discipline:** Editor

### Thumbnail Task (Notion)

Creates a task in Notion with:
- **Name:** `🎨 Thumbnail – {Episode Title}`
- **Parent:** Episode ID from the route
- **Due Date:** From trigger's PLANNED LIVE DATE
- **Status:** Not Started
- **Discipline:** Design

### Sync to Firebase (HTTP)

POSTs to `https://createnotionproject-223535956454.us-central1.run.app/sync-to-firebase` with:
- `notionId`: Created task ID
- `type`: "edit" or "design"
- `episodeId`: Episode ID from the route
- `title`: Task title
- `discipline`: "Editor" or "Design"
- `dueDate`: From trigger
- `vertical`: Route name (MAIN, SPORT, etc.)
- `status`: "Not Started"
- `notionUrl`: Notion URL of created task
- `createdAt`: Current timestamp

## Troubleshooting

### "Connection refused" or network errors

The script has built-in retry logic with exponential backoff (2s, 4s, 8s, 16s). If it still fails:
- Check your internet connection
- Verify the API endpoint is correct for your region (us1.make.com)

### "Unauthorized" errors

- Double-check your API token
- Ensure the token has permissions for the scenario

### Module references not working

Make.com uses the `{{moduleId.field}}` syntax for referencing other modules. The script generates these correctly, but if modules aren't connecting:
- Check that the episode module IDs match your actual scenario
- Run `--inspect` to verify module IDs

## API Reference

- **Base URL:** `https://us1.make.com/api/v2`
- **Endpoints used:**
  - `GET /scenarios/:id` - Get scenario info
  - `GET /scenarios/:id/blueprint` - Get module structure
  - `POST /scenarios/:id/modules` - Create a module
  - `PATCH /scenarios/:id/blueprint` - Update entire blueprint
