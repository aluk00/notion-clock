# DMG Command Centre: Ecosystem Recap

**Last Updated:** 25 January 2026
**Status:** Operational

---

## Architecture Overview

The system operates on a "Master Ledger + Operational Overlay" model.

### NOTION (The Master Ledger)
- Acts as the single source of truth for Projects, Deliverables, Staff, and Events
- Accessed via the Cloud Run API (widgets never call Notion directly)
- Uses internal integration API key for server-side access
- Uses OAuth for user authentication in profile widgets

### GOOGLE CLOUD RUN (The API Layer)
- Translates widget requests into Notion API calls
- Handles authentication, caching, and error handling
- Provides RESTful endpoints for all widget operations
- **Base URL:** `https://createnotionproject-223535956454.us-central1.run.app`

### FIREBASE (The Human Layer)
- Stores Rota Submissions, Sales Annotations, and real-time widget state
- Handles data that changes too fast or is too "messy" for Notion
- Provides real-time updates without hitting Notion rate limits
- **Project:** `dmg-command-centre-native`

### MAKE.COM (The Automation Bridge)
- Automates Daily Rundown → Master Ledger workflows
- Triggers on new Daily Editorial entries
- Routes by VERTICAL to create properly structured Master Ledger projects
- Calls Cloud Run API endpoints (not Notion directly)
- **Status:** Operational for Daily Editorial automation

### WIDGETS (The UI)
- **GitHub Pages:** `https://aluk00.github.io/notion-clock/`
- **Firebase Hosting:** `https://dmg-command-centre-native.web.app`

---

## Cloud Run Environment Variables

### Current Configuration (25 January 2026)

| Variable | Purpose |
|----------|---------|
| `NOTION_API_KEY` | DMG New Media internal integration (get from Notion Settings → Integrations) |
| `NOTION_MASTER_PROJECTS_DB` | Master Ledger database ID |
| `NOTION_DELIVERABLES_DB` | Same as Master Ledger (sub-items are in same DB) |
| `NOTION_STAFF_DIR_DB` | Staff Directory database ID |
| `NOTION_PROD_EVENTS_DB` | Events & Accreditation database ID |
| `NOTION_DAILY_RUNDOWN_DB` | Daily Rundown database ID |
| `NOTION_COMMERCIAL_SNAPSHOT_DB` | Commercial Snapshot database ID |
| `NOTION_OAUTH_CLIENT_ID` | OAuth client ID (from public integration) |
| `NOTION_OAUTH_CLIENT_SECRET` | OAuth client secret (keep secure!) |

> **Note:** Actual values are stored in Cloud Run environment. View with:
> ```bash
> gcloud run services describe createnotionproject --region us-central1 --format="yaml(spec.template.spec.containers[0].env)"
> ```

### Notion Database URLs

| Database | URL |
|----------|-----|
| Master Ledger | `https://www.notion.so/2eb950e6ee5881ff8760e0d0865bca59` |
| Staff Directory | `https://www.notion.so/2eb950e6ee5881f48679fd8e7fc37484` |
| Events & Accreditation | `https://www.notion.so/2eb950e6ee5881569054e7b8ee37e70c` |
| Daily Rundown | `https://www.notion.so/bbd20db1cc2542ef84316c35fd8e0603` |
| Commercial Snapshot | `https://www.notion.so/2ef950e6ee58816bafe3f344ad638661` |

### Updating Environment Variables

**To add new variables without breaking existing ones:**
```bash
gcloud run services update createnotionproject --region us-central1 --update-env-vars="NEW_VAR=value"
```

**To view current variables:**
```bash
gcloud run services describe createnotionproject --region us-central1 --format="yaml(spec.template.spec.containers[0].env)"
```

**IMPORTANT:** Never use `--set-env-vars` as it REPLACES all variables. Always use `--update-env-vars`.

---

## Notion Integrations

### Two Types of Integrations

| Integration | Type | Purpose |
|-------------|------|---------|
| **DMG New Media** | Internal | Server-side API calls from Cloud Run |
| **DMG Profile Widgets** | Public (OAuth) | User authentication in profile widgets |

### Internal Integration (DMG New Media)
- API Key: Stored in `NOTION_API_KEY` environment variable
- Used by: Cloud Run API for all database operations
- Must be connected to each database in Notion (Settings → Connections)

### OAuth Integration (DMG Profile Widgets)
- Client ID: Stored in `NOTION_OAUTH_CLIENT_ID` environment variable
- Used by: Profile widgets for secure user login
- Redirects to: `https://createnotionproject-223535956454.us-central1.run.app/auth/notion/callback`

---

## API Endpoints

### Staff Directory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/staff-directory` | List all staff members |
| GET | `/staff-directory/:id` | Get single staff member |
| POST | `/staff-directory` | Create new staff member |
| PATCH | `/staff-directory/:id` | Update staff member |
| DELETE | `/staff-directory/:id` | Archive staff member |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/projects` | List all projects |
| GET | `/projects/:id` | Get single project |
| POST | `/projects` | Create new project |
| PATCH | `/projects/:id` | Update project |

### Deliverables
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deliverables` | List all deliverables |
| GET | `/deliverables/project/:projectId` | Get deliverables for a project |
| POST | `/deliverables` | Create deliverable |
| POST | `/deliverables/bulk` | Create multiple deliverables |
| PATCH | `/deliverables/:id` | Update deliverable |

### Daily Rundown
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/daily-rundown` | Get today's snapshot items |
| POST | `/process-daily-rundown` | Sync Daily Rundown to Master Ledger |

### Commercial Snapshot
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/commercial-snapshot/projects` | Get projects for dropdown |
| POST | `/commercial-snapshot` | Create snapshot item |
| PATCH | `/commercial-snapshot/:id` | Update snapshot item |
| POST | `/commercial-snapshot/carry-over` | Copy items between dates |

### Production Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/production-events` | List production events |

### OAuth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/notion` | Start OAuth flow |
| GET | `/auth/notion/callback` | OAuth callback handler |
| POST | `/auth/notion/user` | Get user info from token |
| POST | `/auth/notion/match-staff` | Match Notion user to Staff Directory |

---

## Database Schemas

### Staff Directory (UPPERCASE Properties)

**Core Identity:**
- `FULL NAME` (title) - Full staff member name
- `FIRST NAME` (text)
- `LAST NAME` (text)
- `MIDDLE NAME` (text)
- `EMAIL` (formula) - Auto-generated

**Contact:**
- `PHONE` (phone_number)
- `SLACK ID` (text)
- `EMERGENCY CONTACT` (text)
- `NOTION USER` (person)
- `NOTION INVITE SENT?` (checkbox)

**Role & Team:**
- `ROLE` (select): Videographer, Creative, Channel Lead, Creator, Editor, Designer, Team Led, Project Manager, Channel Producer, Content Producer
- `SECONDARY ROLE(S)` (multi_select)
- `TEAM` (select): Content, Creative, Production, Editorial, Social, Design, Sales, Operations
- `SENIORITY` (select): Head of, Director of, Lead, Senior, Midweight, Junior, Intern, Executive
- `EMPLOYMENT TYPE` (select): Full-time, Freelance, Contractor, Intern
- `STATUS` (select): Active, On Leave, Inactive

**Manager:**
- `LINE MANAGER` (person)
- `LINE MANAGER (DROPDOWN)` (select)
- `LINE MANAGER NAME (API)` (formula)
- `IS LINE MANAGER` (checkbox)

**Capacity:**
- `MAX HOURS PER WEEK` (number)
- `WEEKLY CAPACITY (PTS)` (formula)
- `CURRENT LOAD (PTS)` (rollup)
- `AVAILABLE CAPACITY (PTS)` (formula)
- `UTILIZATION %` (formula)

**Capability Flags:**
- `IS CREATOR` (checkbox)
- `IS EDITOR` (checkbox)
- `IS PRODUCER` (checkbox)

---

## Master Ledger Structure (3-Layer Hierarchy)

### Layer 1: Parent Project (Weekly Batch)
- Example: "DMUK Week 3 Content"
- Groups all content for a week/campaign
- Key properties: `NAME`, `VERTICAL`, `STATUS 1`, `DUE DATE`
- `PARENT ITEM`: Empty (this IS the parent)

### Layer 2: Episode (Individual Content Piece)
- Example: "I ATE A SHARK"
- Represents one video/article
- Key properties: `NAME`, `FORMAT`, `DUE DATE`, `STATUS`
- `PARENT ITEM`: Links to Layer 1

### Layer 3: Discipline Task (Actual Work)
- Example: "📹 Edit – I ATE A SHARK"
- Individual task assigned to team member
- Key properties: `NAME`, `DISCIPLINE`, `ASSIGNED TO`, `EFFORT (PTS)`
- `PARENT ITEM`: Links to Layer 2

### Visual Structure
```
📁 DMUK Week 3 Content (Layer 1)
│
├─ 📺 I ATE A SHARK (Layer 2)
│  ├─ 📹 Edit – I ATE A SHARK (Layer 3)
│  ├─ 🎨 Thumbnail – I ATE A SHARK (Layer 3)
│  └─ 📝 Script Review – I ATE A SHARK (Layer 3)
│
└─ 📺 I LOVE ICE CREAM (Layer 2)
   ├─ 📹 Edit – I LOVE ICE CREAM (Layer 3)
   └─ 🎨 Thumbnail – I LOVE ICE CREAM (Layer 3)
```

---

## Make.com Integration

### Daily Editorial → Master Ledger Automation

**Trigger:** New row created in Daily Rundown database

**Workflow:**
```
Daily Rundown (Watch New Items)
    ↓
HTTP Request to Cloud Run API
    POST /process-daily-rundown
    ↓
Cloud Run creates Master Ledger items
    ↓
Returns success/failure
```

**Make.com Configuration:**
- Connection ID: `4706454`
- Daily Rundown Data Source ID: `794ebd52-49e3-4aee-8b11-a5bea4ad8d1f`
- Master Ledger Data Source ID: `2eb950e6-ee58-81c7-953c-000b6ae77c74`

**Note:** Make.com uses its own internal Data Source IDs. The Cloud Run API uses the Notion database IDs directly.

---

## Widget Data Dependencies

| Widget | API Endpoints Used |
|--------|-------------------|
| commercial-hub-react.html | `/projects`, `/deliverables/project/:id`, `/deliverables/bulk` |
| briefs-due.html | `/deliverables` |
| projects-kanban-creative.html | `/projects`, `/deliverables/project/:id` |
| projects-kanban-production.html | `/projects`, `/deliverables/project/:id` |
| designer-queue.html | `/deliverables` |
| designer-capacity.html | `/deliverables`, `/staff-directory` |
| editor-queue.html | `/deliverables` |
| editor-capacity.html | `/deliverables`, `/staff-directory` |
| project-ledger.html | `/projects` |
| team-capacity-compact.html | `/staff-directory` |
| production-command-react.html | `/deliverables/project/:id` |
| daily-rundown-calendar.html | `/daily-rundown`, `/deliverables` |
| manager_dashboard.html | `/staff-directory` |

---

## Troubleshooting

### Issue: Widget shows "API error: 500"
**Check:**
1. Test API directly: `curl https://createnotionproject-223535956454.us-central1.run.app/staff-directory`
2. If "Could not find database" error → Database ID is wrong or integration not connected
3. If "API token is invalid" error → API key is truncated or wrong

### Issue: "Could not find database with ID"
**Fix:**
1. Get correct database ID from Notion URL
2. Update Cloud Run: `gcloud run services update createnotionproject --region us-central1 --update-env-vars="NOTION_XXX_DB=correct-id"`
3. Ensure database is connected to DMG New Media integration in Notion

### Issue: Make.com scenario failing
**Check:**
1. Is the scenario turned on?
2. Check execution history for error details
3. Verify the Cloud Run endpoint is responding
4. Make.com Data Source IDs are different from Notion database IDs - this is normal

### Issue: OAuth not working
**Check:**
1. Visit `https://createnotionproject-223535956454.us-central1.run.app/auth/notion`
2. Should redirect to Notion authorization page
3. After authorizing, should redirect back with user token

---

## Deployment Guide

### Redeploying Cloud Run API

```bash
# Pull latest code
cd ~/notion-clock/notion-api
git pull origin claude/enhance-manager-dashboard-KZPJj

# Deploy
gcloud run deploy createnotionproject --source . --region us-central1
```

### Adding a New Database

1. Get database ID from Notion URL (the long ID before the `?v=`)
2. Add integration connection in Notion (database → ••• → Connections → DMG New Media)
3. Update Cloud Run:
   ```bash
   gcloud run services update createnotionproject --region us-central1 --update-env-vars="NOTION_NEW_DB=database-id"
   ```
4. Add endpoint in `notion-api/index.js`
5. Redeploy

---

## Active Host Locations

| Service | URL | Status |
|---------|-----|--------|
| HTML Widgets | https://aluk00.github.io/notion-clock/ | ✅ Operational |
| React Dashboard | https://dmg-command-centre-native.web.app | ✅ Operational |
| Cloud Run API | https://createnotionproject-223535956454.us-central1.run.app | ✅ Operational |
| Firebase Project | dmg-command-centre-native | ✅ Operational |
| Make.com Scenarios | DMG Workspace | ✅ Operational |

---

## Change Log

### 25 January 2026
- Fixed Commercial Snapshot database ID (was `19c44807...`, now `2ef950e6...`)
- Fixed Deliverables database ID (now points to Master Ledger for sub-items)
- Updated Staff Directory API to use UPPERCASE property names matching actual schema
- Removed hardcoded sort properties that were causing 500 errors
- Added Notion OAuth endpoints for user authentication
- Corrected API key (was truncated in previous deployment)
- All widgets now operational

### 21 January 2026
- Fixed Cloud Run API /projects endpoint - removed broken sort
- Added timeout and error handling to all API-dependent widgets
- Added graceful fallback to Firebase when API is unavailable

### 19 January 2026
- Initial comprehensive ecosystem documentation
- Defined architecture overview
- Established design system standards

---

## Support

**System Owner:** Anaïs Lukaku (Senior Creative, DMG New Media)
**Documentation:** `/docs/DMG_Command_Centre_Ecosystem.md`
**Issues:** https://github.com/aluk00/notion-clock/issues
