# Make.com Module Reference Guide

Use this document when manually creating modules in Make.com. Each route needs 4 modules created in order.

## Configuration Values

| Setting | Value |
|---------|-------|
| Notion Connection ID | `4706454` |
| Master Ledger (Tasks DB) | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Daily Rundown DB | `794ebd52-49e3-4aee-8b11-a5bea4ad8d1f` |
| Firebase Endpoint | `https://createnotionproject-223535956454.us-central1.run.app/sync-to-firebase` |

## Notion Field IDs

| Field | ID (URL-encoded) |
|-------|------------------|
| PARENT ITEM (relation) | `EBq%5D` |
| DUE DATE | `Mb%7Ch` |
| DISCIPLINE (select) | `I%5BF%3A` |
| STATUS (select) | `PzIO` |
| MASTER LEDGER ITEM | `%5BlUH` |

## Vertical Page IDs

| Vertical | Page ID |
|----------|---------|
| MAIN | `4093ae8c-3363-4ca7-b5c6-d811f493e3ac` |
| SPORT | `c2c82778-6419-435b-b46d-de0a0256b813` |
| RESPAWN | `03806b23-bcf4-4ada-b37a-82eb53384519` |
| MONEY | `e7e4081b-5b51-4efa-a18a-61c40bea95cb` |
| SPOTLIGHT | `dea0d837-fe44-443c-8b38-5470cb5ac2d2` |
| UK | `0f78200e-ef2f-4d3d-88e1-313a891b315e` |

## Module Reference IDs (in your Make.com scenario)

| Module | What it references |
|--------|-------------------|
| `{{1.xxx}}` | Trigger (Watch Database Items) |
| `{{3.id}}` | MAIN route episode |
| `{{5.id}}` | SPORT route episode |
| `{{7.id}}` | RESPAWN route episode |
| `{{9.id}}` | MONEY route episode |
| `{{11.id}}` | SPOTLIGHT route episode |
| `{{16.id}}` | UK route episode |

---

## MAIN Route (Episode Module: 3)

### 1. Create Edit Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `📹 Edit – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{3.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Editor` |

### 2. Create Thumbnail Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{3.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Design` |

### 3. Sync Edit to Firebase (HTTP - POST)
- **URL:** `https://createnotionproject-223535956454.us-central1.run.app/sync-to-firebase`
- **Method:** POST
- **Body Type:** Raw (JSON)

```json
{
  "notionId": "{{EDIT_MODULE.id}}",
  "type": "edit",
  "episodeId": "{{3.id}}",
  "title": "📹 Edit – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Editor",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "MAIN",
  "status": "Not Started",
  "notionUrl": "{{EDIT_MODULE.url}}",
  "createdAt": "{{now}}"
}
```
> Replace `EDIT_MODULE` with the actual module number of "Create Edit Task - MAIN"

### 4. Sync Thumbnail to Firebase (HTTP - POST)
- **URL:** `https://createnotionproject-223535956454.us-central1.run.app/sync-to-firebase`
- **Method:** POST
- **Body Type:** Raw (JSON)

```json
{
  "notionId": "{{THUMB_MODULE.id}}",
  "type": "design",
  "episodeId": "{{3.id}}",
  "title": "🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Design",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "MAIN",
  "status": "Not Started",
  "notionUrl": "{{THUMB_MODULE.url}}",
  "createdAt": "{{now}}"
}
```
> Replace `THUMB_MODULE` with the actual module number of "Create Thumbnail Task - MAIN"

---

## SPORT Route (Episode Module: 5)

### 1. Create Edit Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `📹 Edit – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{5.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Editor` |

### 2. Create Thumbnail Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{5.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Design` |

### 3. Sync Edit to Firebase (HTTP - POST)
```json
{
  "notionId": "{{EDIT_MODULE.id}}",
  "type": "edit",
  "episodeId": "{{5.id}}",
  "title": "📹 Edit – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Editor",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "SPORT",
  "status": "Not Started",
  "notionUrl": "{{EDIT_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

### 4. Sync Thumbnail to Firebase (HTTP - POST)
```json
{
  "notionId": "{{THUMB_MODULE.id}}",
  "type": "design",
  "episodeId": "{{5.id}}",
  "title": "🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Design",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "SPORT",
  "status": "Not Started",
  "notionUrl": "{{THUMB_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

---

## RESPAWN Route (Episode Module: 7)

### 1. Create Edit Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `📹 Edit – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{7.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Editor` |

### 2. Create Thumbnail Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{7.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Design` |

### 3. Sync Edit to Firebase (HTTP - POST)
```json
{
  "notionId": "{{EDIT_MODULE.id}}",
  "type": "edit",
  "episodeId": "{{7.id}}",
  "title": "📹 Edit – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Editor",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "RESPAWN",
  "status": "Not Started",
  "notionUrl": "{{EDIT_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

### 4. Sync Thumbnail to Firebase (HTTP - POST)
```json
{
  "notionId": "{{THUMB_MODULE.id}}",
  "type": "design",
  "episodeId": "{{7.id}}",
  "title": "🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Design",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "RESPAWN",
  "status": "Not Started",
  "notionUrl": "{{THUMB_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

---

## MONEY Route (Episode Module: 9)

### 1. Create Edit Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `📹 Edit – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{9.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Editor` |

### 2. Create Thumbnail Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{9.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Design` |

### 3. Sync Edit to Firebase (HTTP - POST)
```json
{
  "notionId": "{{EDIT_MODULE.id}}",
  "type": "edit",
  "episodeId": "{{9.id}}",
  "title": "📹 Edit – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Editor",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "MONEY",
  "status": "Not Started",
  "notionUrl": "{{EDIT_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

### 4. Sync Thumbnail to Firebase (HTTP - POST)
```json
{
  "notionId": "{{THUMB_MODULE.id}}",
  "type": "design",
  "episodeId": "{{9.id}}",
  "title": "🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Design",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "MONEY",
  "status": "Not Started",
  "notionUrl": "{{THUMB_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

---

## SPOTLIGHT Route (Episode Module: 11)

### 1. Create Edit Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `📹 Edit – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{11.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Editor` |

### 2. Create Thumbnail Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{11.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Design` |

### 3. Sync Edit to Firebase (HTTP - POST)
```json
{
  "notionId": "{{EDIT_MODULE.id}}",
  "type": "edit",
  "episodeId": "{{11.id}}",
  "title": "📹 Edit – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Editor",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "SPOTLIGHT",
  "status": "Not Started",
  "notionUrl": "{{EDIT_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

### 4. Sync Thumbnail to Firebase (HTTP - POST)
```json
{
  "notionId": "{{THUMB_MODULE.id}}",
  "type": "design",
  "episodeId": "{{11.id}}",
  "title": "🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Design",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "SPOTLIGHT",
  "status": "Not Started",
  "notionUrl": "{{THUMB_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

---

## UK Route (Episode Module: 16)

### 1. Create Edit Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `📹 Edit – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{16.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Editor` |

### 2. Create Thumbnail Task (Notion - Create Database Item)
| Field | Value |
|-------|-------|
| Database | `2eb950e6-ee58-81c7-953c-000b6ae77c74` |
| Name | `🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}` |
| Parent Item | `{{16.id}}` |
| Due Date | `{{1.properties_value.PLANNED LIVE DATE.start}}` |
| Status | `Not Started` |
| Discipline | `Design` |

### 3. Sync Edit to Firebase (HTTP - POST)
```json
{
  "notionId": "{{EDIT_MODULE.id}}",
  "type": "edit",
  "episodeId": "{{16.id}}",
  "title": "📹 Edit – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Editor",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "UK",
  "status": "Not Started",
  "notionUrl": "{{EDIT_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

### 4. Sync Thumbnail to Firebase (HTTP - POST)
```json
{
  "notionId": "{{THUMB_MODULE.id}}",
  "type": "design",
  "episodeId": "{{16.id}}",
  "title": "🎨 Thumbnail – {{1.properties_value.TITLE[].text.content}}",
  "discipline": "Design",
  "dueDate": "{{1.properties_value.PLANNED LIVE DATE.start}}",
  "vertical": "UK",
  "status": "Not Started",
  "notionUrl": "{{THUMB_MODULE.url}}",
  "createdAt": "{{now}}"
}
```

---

## Checklist

- [ ] **MAIN** - Create Edit Task
- [ ] **MAIN** - Create Thumbnail Task
- [ ] **MAIN** - Sync Edit to Firebase
- [ ] **MAIN** - Sync Thumbnail to Firebase
- [ ] **SPORT** - Create Edit Task
- [ ] **SPORT** - Create Thumbnail Task
- [ ] **SPORT** - Sync Edit to Firebase
- [ ] **SPORT** - Sync Thumbnail to Firebase
- [ ] **RESPAWN** - Create Edit Task
- [ ] **RESPAWN** - Create Thumbnail Task
- [ ] **RESPAWN** - Sync Edit to Firebase
- [ ] **RESPAWN** - Sync Thumbnail to Firebase
- [ ] **MONEY** - Create Edit Task
- [ ] **MONEY** - Create Thumbnail Task
- [ ] **MONEY** - Sync Edit to Firebase
- [ ] **MONEY** - Sync Thumbnail to Firebase
- [ ] **SPOTLIGHT** - Create Edit Task
- [ ] **SPOTLIGHT** - Create Thumbnail Task
- [ ] **SPOTLIGHT** - Sync Edit to Firebase
- [ ] **SPOTLIGHT** - Sync Thumbnail to Firebase
- [ ] **UK** - Create Edit Task
- [ ] **UK** - Create Thumbnail Task
- [ ] **UK** - Sync Edit to Firebase
- [ ] **UK** - Sync Thumbnail to Firebase
