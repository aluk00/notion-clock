# Commercial Snapshot Widget & Project Detail Documentation

## Overview

The Commercial Snapshot system provides a daily view of commercial/sales projects and links through to detailed project pages. It consists of two main components:

1. **Commercial Snapshot Widget** (`creative-command-_-daily-updates/ViewOnlyApp.html`)
2. **Project Detail Page** (`project-detail.html`)

---

## Commercial Snapshot Widget

### Purpose
Displays a daily snapshot of commercial projects grouped by section (e.g., "Active / In Production", "New Briefs", "Coming Up"). This is a read-only dashboard widget designed for embedding.

### Data Source
- **Notion Database**: Commercial Snapshot database (`NOTION_COMMERCIAL_SNAPSHOT`)
- **API Endpoint**: `GET /daily-rundown?date=YYYY-MM-DD`
- **Note**: Despite the endpoint name, this serves Commercial Snapshot data, not Editorial Daily Rundown data

### Key Fields from API

| Field | Description |
|-------|-------------|
| `id` | The Commercial Snapshot item's own Notion page ID |
| `projectIds` | Array of Master Ledger project IDs (from `Project` relation) |
| `headline` | Display headline for the item |
| `details` | Additional details/notes |
| `section` | Which section the item belongs to |
| `statusTag` | Status indicator (Green/Yellow/Red) |
| `projectName` | Rolled up from linked Master Ledger project |
| `clientPartner` | Client name (rollup) |

### How Linking Works

When a user clicks an item in the widget:

```javascript
// Uses projectIds from the Project relation (links to Master Ledger)
const projectId = (item.projectIds && item.projectIds.length > 0)
    ? item.projectIds[0]
    : null;

const projectDetailUrl = projectId
    ? `../project-detail.html?id=${encodeURIComponent(projectId)}`
    : item.url || '#';
```

**Important**: The widget uses `projectIds[0]` (the linked Master Ledger project), NOT `item.id` (the snapshot item's own ID).

### Sections

Items are grouped by the `Section` field in Notion:

- Completed - Last Week / This Week
- New Briefs in Progress
- Active / In Production Projects
- New Media Ventures
- Prospective & Strategic Partnerships
- Internal / Workflow
- Coming Up

### UI Features

- **Bento Grid Layout**: 4-column responsive grid
- **Date Navigation**: Previous/Next day buttons
- **Status Indicators**: Coloured dots (Green = On Track, Yellow = Attention, Red = Blocked)
- **Slack Export**: Copy formatted message for Slack

---

## Project Detail Page

### Purpose
Displays detailed information about a Master Ledger project, including its hierarchy (parent/children), team, workflow status, budget, and deliverables.

### Data Source
- **API Endpoint**: `GET /projects/:id`
- **Database**: Master Ledger (`NOTION_PROJECTS_DB`)

### The Layer System

The Master Ledger uses a hierarchical structure with three layers:

```
Layer 1: PROJECT (Top-level)
├── Layer 2: EPISODE / DELIVERABLE
│   └── Layer 3: TASK
```

#### Layer Detection Logic

```javascript
const hasParent = project.parentItemIds && project.parentItemIds.length > 0;
const hasSubItems = project.subItemIds && project.subItemIds.length > 0;

if (!hasParent) {
    itemLayer = 1; // Layer 1: Project (no parent)
} else if (hasSubItems) {
    itemLayer = 2; // Layer 2: Episode (has parent and children)
} else {
    itemLayer = 2; // Default to Episode (could be Task)
}

// If parent also has a parent, this is Layer 3
if (parentProject.parentItemIds && parentProject.parentItemIds.length > 0) {
    itemLayer = 3;
}
```

#### Layer Characteristics

| Layer | Name | Has Parent | Has Children | Example |
|-------|------|------------|--------------|---------|
| 1 | Project | No | Yes | "NUL - A Measured Response" |
| 2 | Episode/Deliverable | Yes | Maybe | "Episode 1", "Brand Guidelines" |
| 3 | Task | Yes | No | "Script Draft", "Design Review" |

### Auto-Redirect for Untitled Items

If the Commercial Snapshot's `Project` relation points to a Layer 2/3 item that has no title, the page automatically redirects to the top-level Layer 1 project:

```javascript
// If current project has no title, redirect to the top-level parent
if (!project.title && parentProject) {
    let topLevelId = parentProject.id;
    let topLevelProject = parentProject;

    // Traverse up if parent also has a parent
    while (topLevelProject.parentItemIds && topLevelProject.parentItemIds.length > 0) {
        // Fetch grandparent and continue up...
        topLevelId = grandparentData.project.id;
        topLevelProject = grandparentData.project;
    }

    // Redirect to the top-level project
    window.location.href = `project-detail.html?id=${topLevelId}`;
    return;
}
```

This ensures users always land on a meaningful project page, even if the snapshot item links to an intermediate deliverable.

### Project Detail Sections

The page displays:

1. **Header**: Project title, layer badge, Notion link
2. **Key Dates**: Internal due, client due dates
3. **Stats Bar**: Deliverable count, completion status, probability
4. **Item Type**: Shows Layer 1/2/3 with description
5. **Team**: Sales, Creative, Production, Editorial leads
6. **Workflow Status**: Creative, Production, Social workflow states
7. **Expenses & Receipts**: Firebase-stored expense tracking
8. **Episodes/Deliverables**: Sub-items linked via `SUB-ITEM` relation
9. **Budget**: Project budget vs actual spend
10. **Quick Links**: Brief, Creative Response, Frame.io, Drive folder

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     NOTION DATABASES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐         ┌──────────────────────┐      │
│  │  Commercial Snapshot │         │    Master Ledger     │      │
│  │      Database        │────────▶│      Database        │      │
│  │                      │ Project │                      │      │
│  │  • Snapshot Date     │ Relation│  • Layer 1 Projects  │      │
│  │  • Section           │         │  • Layer 2 Episodes  │      │
│  │  • Headline          │         │  • Layer 3 Tasks     │      │
│  │  • Status Tag        │         │                      │      │
│  │  • Project (relation)│         │  • PARENT ITEM       │      │
│  └──────────────────────┘         │  • SUB-ITEM          │      │
│                                   └──────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                │                              │
                │ /daily-rundown               │ /projects/:id
                ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API (index.js)                          │
└─────────────────────────────────────────────────────────────────┘
                │                              │
                ▼                              ▼
┌───────────────────────────┐    ┌────────────────────────────────┐
│  Commercial Snapshot      │    │      Project Detail Page       │
│  Widget (ViewOnlyApp.html)│───▶│      (project-detail.html)     │
│                           │    │                                │
│  Click item uses          │    │  • Shows full project info     │
│  projectIds[0] to link    │    │  • Auto-redirects if no title  │
└───────────────────────────┘    └────────────────────────────────┘
```

---

## Key Relation Fields

### In Commercial Snapshot Database
- **Project**: Relation to Master Ledger (provides `projectIds` in API)

### In Master Ledger Database
- **PARENT ITEM**: Relation to parent (Layer 1 for Episodes, Layer 2 for Tasks)
- **SUB-ITEM**: Relation to children (Episodes for Projects, Tasks for Episodes)

---

## Files Reference

| File | Purpose |
|------|---------|
| `creative-command-_-daily-updates/ViewOnlyApp.html` | Commercial Snapshot widget |
| `project-detail.html` | Detailed project view with layers |
| `api/index.js` | API endpoints for both widgets |

### Relevant API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /daily-rundown?date=YYYY-MM-DD` | Fetch Commercial Snapshot items for a date |
| `GET /projects/:id` | Fetch single project (any layer) |
| `GET /projects/:id/subitems` | Fetch children of a project |
| `GET /commercial-snapshot` | List all Commercial Snapshot items |
