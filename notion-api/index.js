const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Database IDs from environment - must match Cloud Run env var names
const PROJECTS_DB = process.env.NOTION_MASTER_PROJECTS_DB;
const DELIVERABLES_DB = process.env.NOTION_DELIVERABLES_DB;
const DAILY_RUNDOWN_DB = process.env.NOTION_DAILY_RUNDOWN_DB;
const EVENTS_DB = process.env.NOTION_PROD_EVENTS_DB;

// ============================================
// HELPER: Parse Notion properties
// ============================================
function parseProperty(prop) {
    if (!prop) return null;
    switch (prop.type) {
        case 'title': return prop.title?.[0]?.plain_text || '';
        case 'rich_text': return prop.rich_text?.[0]?.plain_text || '';
        case 'number': return prop.number;
        case 'select': return prop.select?.name || null;
        case 'multi_select': return prop.multi_select?.map(s => s.name) || [];
        case 'status': return prop.status?.name || null;
        case 'date': return prop.date?.start || null;
        case 'checkbox': return prop.checkbox || false;
        case 'url': return prop.url || null;
        case 'email': return prop.email || null;
        case 'phone_number': return prop.phone_number || null;
        case 'people': return prop.people?.map(p => ({ id: p.id, name: p.name })) || [];
        case 'relation': return prop.relation?.map(r => r.id) || [];
        case 'formula': return prop.formula?.[prop.formula.type] || null;
        case 'rollup': return prop.rollup?.[prop.rollup.type] || null;
        default: return null;
    }
}

// ============================================
// HELPER: Resolve Notion property types
// ============================================
let projectPropertyTypeCache = null;
let projectPropertyTypeCacheAt = 0;
const PROPERTY_TYPE_CACHE_TTL_MS = 5 * 60 * 1000;

async function getProjectPropertyTypes() {
    if (!PROJECTS_DB) return {};

    const now = Date.now();
    if (projectPropertyTypeCache && (now - projectPropertyTypeCacheAt) < PROPERTY_TYPE_CACHE_TTL_MS) {
        return projectPropertyTypeCache;
    }

    try {
        const response = await notion.databases.retrieve({ database_id: PROJECTS_DB });
        const types = Object.entries(response.properties || {}).reduce((acc, [name, property]) => {
            acc[name] = property.type;
            return acc;
        }, {});
        projectPropertyTypeCache = types;
        projectPropertyTypeCacheAt = now;
        return types;
    } catch (error) {
        console.error('Error fetching project property types:', error);
        return projectPropertyTypeCache || {};
    }
}

function buildStatusProperty(value, propertyType) {
    if (!value) return null;
    if (propertyType === 'select') return { select: { name: value } };
    return { status: { name: value } };
}

// ============================================
// HELPER: Build Project properties for Notion
// ============================================
async function buildProjectProperties(data) {
    const props = {};
    const propertyTypes = await getProjectPropertyTypes();

    if (data.title) {
        props['NAME'] = { title: [{ text: { content: data.title } }] };
    }
    if (data.cardSummary !== undefined) {
        props['CARD SUMMARY'] = { rich_text: data.cardSummary ? [{ text: { content: data.cardSummary } }] : [] };
    }
    if (data.notes !== undefined) {
        props['(INTERNAL) NOTES'] = { rich_text: data.notes ? [{ text: { content: data.notes } }] : [] };
    }
    if (data.client) {
        props['CLIENT / EXTERNAL PARTNER'] = { select: { name: data.client } };
    }
    if (data.projectType) {
        props['PROJECT TYPE'] = { select: { name: data.projectType } };
    }
    if (data.priority) {
        props['PRIORITY'] = { select: { name: data.priority } };
    }
    if (data.vertical) {
        props['VERTICAL'] = { select: { name: data.vertical } };
    }
    if (data.ownerRole) {
        props['OWNER ROLE'] = { select: { name: data.ownerRole } };
    }
    if (data.deskState) {
        props['DESK STATE'] = { select: { name: data.deskState } };
    }
    if (data.dealStage) {
        props['DEAL STAGE'] = { select: { name: data.dealStage } };
    }
    if (data.creativeWorkflowStatus) {
        props['CREATIVE WORKFLOW STATUS'] = buildStatusProperty(
            data.creativeWorkflowStatus,
            propertyTypes['CREATIVE WORKFLOW STATUS']
        );
    }
    if (data.productionWorkflowStatus) {
        props['PRODUCTION WORKFLOW STATUS'] = buildStatusProperty(
            data.productionWorkflowStatus,
            propertyTypes['PRODUCTION WORKFLOW STATUS']
        );
    }
    if (data.socialWorkflowStatus) {
        props['SOCIAL WORKFLOW STATUS'] = buildStatusProperty(
            data.socialWorkflowStatus,
            propertyTypes['SOCIAL WORKFLOW STATUS']
        );
    }
    if (data.primaryTeam && Array.isArray(data.primaryTeam)) {
        props['PRIMARY TEAM'] = { multi_select: data.primaryTeam.map(t => ({ name: t })) };
    }
    if (data.assetsNeeded && Array.isArray(data.assetsNeeded)) {
        props['ASSET(S) NEEDED'] = { multi_select: data.assetsNeeded.map(a => ({ name: a })) };
    }
    if (data.dueDate !== undefined) {
        props['(INTERNAL) DUE DATE'] = { date: data.dueDate ? { start: data.dueDate } : null };
    }
    if (data.clientDueDate !== undefined) {
        props['CLIENT DUE DATE'] = { date: data.clientDueDate ? { start: data.clientDueDate } : null };
    }
    if (data.dealValue !== undefined) {
        props['DEAL VALUE'] = { number: data.dealValue };
    }
    if (data.effortScore !== undefined) {
        props['EFFORT SCORE'] = { number: data.effortScore };
    }
    if (data.salesLeadId) {
        props['SALES LEAD'] = { people: [{ id: data.salesLeadId }] };
    }
    if (data.creativeLeadId) {
        props['CREATIVE LEAD'] = { people: [{ id: data.creativeLeadId }] };
    }
    if (data.productionLeadId) {
        props['PRODUCTION LEAD'] = { people: [{ id: data.productionLeadId }] };
    }
    if (data.editorialLeadId) {
        props['EDITORIAL LEAD'] = { people: [{ id: data.editorialLeadId }] };
    }
    
    return props;
}

// ============================================
// HELPER: Build Deliverable properties
// Matches your actual Notion Deliverables DB schema
// ============================================
function buildDeliverableProperties(data, projectId) {
    const props = {};
    
    // Title field
    if (data.title) {
        props['TITLE'] = { title: [{ text: { content: data.title } }] };
    }
    
    // CAMPAIGN relation (links to Master Ledger project)
    if (projectId) {
        props['CAMPAIGN'] = { relation: [{ id: projectId }] };
    }
    
    // Select fields
    if (data.status) {
        props['STATUS'] = { select: { name: data.status } };
    }
    if (data.deskState) {
        props['DESK STATE'] = { select: { name: data.deskState } };
    }
    if (data.format) {
        props['FORMAT'] = { select: { name: data.format } };
    }
    
    // Multi-select fields
    if (data.assetsNeeded && Array.isArray(data.assetsNeeded)) {
        props['ASSET(S) NEEDED'] = { multi_select: data.assetsNeeded.map(a => ({ name: a })) };
    }
    if (data.staticAssetsNeeded && Array.isArray(data.staticAssetsNeeded)) {
        props['STATIC ASSET(S) NEEDED'] = { multi_select: data.staticAssetsNeeded.map(a => ({ name: a })) };
    }
    if (data.movingAssetsNeeded && Array.isArray(data.movingAssetsNeeded)) {
        props['MOVING ASSET(S) NEEDED'] = { multi_select: data.movingAssetsNeeded.map(a => ({ name: a })) };
    }
    
    // Date field
    if (data.dueDate !== undefined) {
        props['DUE DATE'] = { date: data.dueDate ? { start: data.dueDate } : null };
    }
    
    // Number fields (effort points)
    if (data.creativeEffort !== undefined) {
        props['CREATIVE EFFORT (PTS)'] = { number: data.creativeEffort };
    }
    if (data.designEffort !== undefined) {
        props['DESIGN EFFORT (PTS)'] = { number: data.designEffort };
    }
    if (data.editorEffort !== undefined) {
        props['EDITOR EFFORT (PTS)'] = { number: data.editorEffort };
    }
    if (data.staticAssetCount !== undefined) {
        props['STATIC ASSET COUNT'] = { number: data.staticAssetCount };
    }
    if (data.movingAssetCount !== undefined) {
        props['MOVING ASSET COUNT'] = { number: data.movingAssetCount };
    }
    
    // Rich text fields
    if (data.notes !== undefined) {
        props['NOTES'] = { rich_text: data.notes ? [{ text: { content: data.notes } }] : [] };
    }
    
    // URL field
    if (data.liveLink !== undefined) {
        props['LIVE LINK'] = { url: data.liveLink || null };
    }
    
    // People fields (require Notion user IDs)
    if (data.contentCreatorId) {
        props['CONTENT CREATOR(S)'] = { people: [{ id: data.contentCreatorId }] };
    }
    if (data.assignedCreativeId) {
        props['ASSIGNED CREATIVE/DESIGNER/EDITOR'] = { people: [{ id: data.assignedCreativeId }] };
    }
    if (data.graphicDesignerId) {
        props['GRAPHIC DESIGNER'] = { people: [{ id: data.graphicDesignerId }] };
    }
    if (data.videoEditorId) {
        props['VIDEO EDITOR'] = { people: [{ id: data.videoEditorId }] };
    }
    if (data.finalReviewerId) {
        props['FINAL REVIEWER'] = { people: [{ id: data.finalReviewerId }] };
    }
    
    return props;
}

// ============================================
// HELPER: Build Daily Rundown properties
// ============================================
function buildRundownProperties(data) {
    const props = {};

    // Title field
    if (data.title) {
        props['TITLE'] = { title: [{ text: { content: data.title } }] };
    }

    // Date field
    if (data.date !== undefined) {
        props['DATE'] = { date: data.date ? { start: data.date } : null };
    }

    // Select fields
    if (data.section) {
        props['SECTION'] = { select: { name: data.section } };
    }
    if (data.vertical) {
        props['VERTICAL'] = { select: { name: data.vertical } };
    }
    if (data.creator) {
        props['CREATOR'] = { select: { name: data.creator } };
    }

    // Status field (Notion status type)
    if (data.status !== undefined) {
        // Map widget status to Notion status
        let statusName = 'To set';
        if (data.status === 'done') statusName = 'Done';
        else if (data.status === 'pending') statusName = 'Pending';
        else if (data.status === 'blocked') statusName = 'To set'; // No blocked status, use To set
        props['STATUS'] = { status: { name: statusName } };
    }

    // Person field (CREATOR @)
    if (data.creatorId) {
        props['CREATOR @'] = { people: [{ id: data.creatorId }] };
    }

    // Relation field (MASTER LEDGER ITEM)
    if (data.masterLedgerItemIds && Array.isArray(data.masterLedgerItemIds)) {
        props['MASTER LEDGER ITEM'] = { relation: data.masterLedgerItemIds.map(id => ({ id })) };
    }

    return props;
}

// ============================================
// HELPER: Parse rundown item from Notion page
// ============================================
function parseRundownItem(page) {
    const props = page.properties;

    // Map Notion status back to widget status
    const notionStatus = parseProperty(props['STATUS']);
    let status = '';
    if (notionStatus === 'Done') status = 'done';
    else if (notionStatus === 'Pending') status = 'pending';
    // 'To set' maps to empty status

    return {
        id: page.id,
        url: page.url,
        title: parseProperty(props['TITLE']),
        date: parseProperty(props['DATE']),
        section: parseProperty(props['SECTION']),
        vertical: parseProperty(props['VERTICAL']),
        creator: parseProperty(props['CREATOR']),
        creatorPerson: parseProperty(props['CREATOR @']),
        status: status,
        aiTitle: parseProperty(props['AI TITLE']),
        masterLedgerItemIds: parseProperty(props['MASTER LEDGER ITEM']),
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time
    };
}

// ============================================
// GET /projects - List all projects
// ============================================
app.get('/projects', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            page_size: 100,
            sorts: [{ property: '(INTERNAL) DUE DATE', direction: 'ascending' }]
        });
        
        const projects = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                url: page.url,
                title: parseProperty(props['NAME']),
                client: parseProperty(props['CLIENT / EXTERNAL PARTNER']),
                projectType: parseProperty(props['PROJECT TYPE']),
                priority: parseProperty(props['PRIORITY']),
                vertical: parseProperty(props['VERTICAL']),
                dealStage: parseProperty(props['DEAL STAGE']),
                dealValue: parseProperty(props['DEAL VALUE']),
                dueDate: parseProperty(props['(INTERNAL) DUE DATE']),
                clientDueDate: parseProperty(props['CLIENT DUE DATE']),
                creativeWorkflowStatus: parseProperty(props['CREATIVE WORKFLOW STATUS']),
                productionWorkflowStatus: parseProperty(props['PRODUCTION WORKFLOW STATUS']),
                socialWorkflowStatus: parseProperty(props['SOCIAL WORKFLOW STATUS']),
                deskState: parseProperty(props['DESK STATE']),
                ownerRole: parseProperty(props['OWNER ROLE']),
                primaryTeam: parseProperty(props['PRIMARY TEAM']),
                assetsNeeded: parseProperty(props['ASSET(S) NEEDED']),
                effortScore: parseProperty(props['EFFORT SCORE']),
                cardSummary: parseProperty(props['CARD SUMMARY']),
                salesLead: parseProperty(props['SALES LEAD']),
                creativeLead: parseProperty(props['CREATIVE LEAD']),
                productionLead: parseProperty(props['PRODUCTION LEAD']),
                editorialLead: parseProperty(props['EDITORIAL LEAD']),
                // Rollups from Deliverables
                deliverableCount: parseProperty(props['DELIVERABLE COUNT']),
                deliverablesComplete: parseProperty(props['DELIVERABLES COMPLETE']),
                nextDeliverableDue: parseProperty(props['NEXT DELIVERABLE DUE'])
            };
        });
        
        res.json({ success: true, projects, count: projects.length });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PATCH /projects/:id - Update a project
// ============================================
app.patch('/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const properties = await buildProjectProperties(req.body);
        
        if (Object.keys(properties).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid properties to update' });
        }
        
        await notion.pages.update({
            page_id: id,
            properties
        });
        
        res.json({ success: true, message: 'Project updated' });
    } catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// POST /projects - Create a new project
// ============================================
app.post('/projects', async (req, res) => {
    try {
        const properties = await buildProjectProperties(req.body);
        
        if (!properties['NAME']) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }
        
        const response = await notion.pages.create({
            parent: { database_id: PROJECTS_DB },
            properties
        });
        
        res.json({ 
            success: true, 
            message: 'Project created',
            id: response.id,
            url: response.url
        });
    } catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /deliverables - List all deliverables
// ============================================
app.get('/deliverables', async (req, res) => {
    try {
        if (!DELIVERABLES_DB) {
            return res.status(400).json({ success: false, error: 'Deliverables DB not configured' });
        }
        
        const response = await notion.databases.query({
            database_id: DELIVERABLES_DB,
            page_size: 100,
            sorts: [{ property: 'DUE DATE', direction: 'ascending' }]
        });
        
        const deliverables = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                url: page.url,
                title: parseProperty(props['TITLE']),
                campaignIds: parseProperty(props['CAMPAIGN']),
                status: parseProperty(props['STATUS']),
                deskState: parseProperty(props['DESK STATE']),
                dueDate: parseProperty(props['DUE DATE']),
                format: parseProperty(props['FORMAT']),
                assetsNeeded: parseProperty(props['ASSET(S) NEEDED']),
                staticAssetCount: parseProperty(props['STATIC ASSET COUNT']),
                movingAssetCount: parseProperty(props['MOVING ASSET COUNT']),
                creativeEffort: parseProperty(props['CREATIVE EFFORT (PTS)']),
                designEffort: parseProperty(props['DESIGN EFFORT (PTS)']),
                editorEffort: parseProperty(props['EDITOR EFFORT (PTS)']),
                contentCreator: parseProperty(props['CONTENT CREATOR(S)']),
                assignedCreative: parseProperty(props['ASSIGNED CREATIVE/DESIGNER/EDITOR']),
                liveLink: parseProperty(props['LIVE LINK']),
                notes: parseProperty(props['NOTES'])
            };
        });
        
        res.json({ success: true, deliverables, count: deliverables.length });
    } catch (error) {
        console.error('Error fetching deliverables:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /deliverables/project/:projectId
// Get deliverables linked to a specific project
// ============================================
app.get('/deliverables/project/:projectId', async (req, res) => {
    try {
        if (!DELIVERABLES_DB) {
            return res.status(400).json({ success: false, error: 'Deliverables DB not configured' });
        }
        
        const { projectId } = req.params;
        
        const response = await notion.databases.query({
            database_id: DELIVERABLES_DB,
            filter: {
                property: 'CAMPAIGN',
                relation: {
                    contains: projectId
                }
            },
            sorts: [{ property: 'DUE DATE', direction: 'ascending' }]
        });
        
        const deliverables = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                url: page.url,
                title: parseProperty(props['TITLE']),
                status: parseProperty(props['STATUS']),
                deskState: parseProperty(props['DESK STATE']),
                dueDate: parseProperty(props['DUE DATE']),
                format: parseProperty(props['FORMAT']),
                assetsNeeded: parseProperty(props['ASSET(S) NEEDED']),
                staticAssetCount: parseProperty(props['STATIC ASSET COUNT']),
                movingAssetCount: parseProperty(props['MOVING ASSET COUNT']),
                creativeEffort: parseProperty(props['CREATIVE EFFORT (PTS)']),
                designEffort: parseProperty(props['DESIGN EFFORT (PTS)']),
                editorEffort: parseProperty(props['EDITOR EFFORT (PTS)']),
                contentCreator: parseProperty(props['CONTENT CREATOR(S)']),
                assignedCreative: parseProperty(props['ASSIGNED CREATIVE/DESIGNER/EDITOR']),
                liveLink: parseProperty(props['LIVE LINK']),
                notes: parseProperty(props['NOTES'])
            };
        });
        
        res.json({ success: true, deliverables, count: deliverables.length, projectId });
    } catch (error) {
        console.error('Error fetching project deliverables:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// POST /deliverables - Create single deliverable
// ============================================
app.post('/deliverables', async (req, res) => {
    try {
        if (!DELIVERABLES_DB) {
            return res.status(400).json({ success: false, error: 'Deliverables DB not configured' });
        }
        
        const { projectId, ...data } = req.body;
        
        if (!data.title) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }
        
        const properties = buildDeliverableProperties(data, projectId);
        
        const response = await notion.pages.create({
            parent: { database_id: DELIVERABLES_DB },
            properties
        });
        
        res.json({ 
            success: true, 
            message: 'Deliverable created',
            id: response.id,
            url: response.url
        });
    } catch (error) {
        console.error('Error creating deliverable:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// POST /deliverables/bulk - Create multiple deliverables
// For "Generate 7 Assets" feature
// ============================================
app.post('/deliverables/bulk', async (req, res) => {
    try {
        if (!DELIVERABLES_DB) {
            return res.status(400).json({ success: false, error: 'Deliverables DB not configured' });
        }
        
        const { projectId, deliverables } = req.body;
        
        if (!projectId) {
            return res.status(400).json({ success: false, error: 'projectId is required' });
        }
        if (!deliverables || !Array.isArray(deliverables) || deliverables.length === 0) {
            return res.status(400).json({ success: false, error: 'deliverables array is required' });
        }
        
        const results = [];
        const errors = [];
        
        // Create each deliverable (Notion API doesn't support batch create)
        for (const item of deliverables) {
            try {
                const properties = buildDeliverableProperties(item, projectId);
                
                const response = await notion.pages.create({
                    parent: { database_id: DELIVERABLES_DB },
                    properties
                });
                
                results.push({ id: response.id, title: item.title });
            } catch (err) {
                errors.push({ title: item.title, error: err.message });
            }
        }
        
        res.json({ 
            success: errors.length === 0, 
            created: results.length,
            failed: errors.length,
            ids: results,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error bulk creating deliverables:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PATCH /deliverables/:id - Update deliverable
// ============================================
app.patch('/deliverables/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const properties = buildDeliverableProperties(req.body, null);
        
        if (Object.keys(properties).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid properties to update' });
        }
        
        await notion.pages.update({
            page_id: id,
            properties
        });
        
        res.json({ success: true, message: 'Deliverable updated' });
    } catch (error) {
        console.error('Error updating deliverable:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /staff - List Notion workspace users
// ============================================
app.get('/staff', async (req, res) => {
    try {
        const response = await notion.users.list();
        
        const users = response.results
            .filter(user => user.type === 'person')
            .map(user => ({
                id: user.id,
                name: user.name,
                email: user.person?.email || null,
                avatarUrl: user.avatar_url
            }));
        
        res.json({ success: true, users, count: users.length });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /capacity - Get project counts per user
// ============================================
app.get('/capacity', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            page_size: 100,
            filter: {
                property: 'DEAL STAGE',
                select: {
                    does_not_equal: 'Campaign Complete'
                }
            }
        });
        
        const capacity = {};
        
        response.results.forEach(page => {
            const props = page.properties;
            
            const leads = [
                { field: 'SALES LEAD', data: props['SALES LEAD'] },
                { field: 'CREATIVE LEAD', data: props['CREATIVE LEAD'] },
                { field: 'PRODUCTION LEAD', data: props['PRODUCTION LEAD'] },
                { field: 'EDITORIAL LEAD', data: props['EDITORIAL LEAD'] }
            ];
            
            leads.forEach(({ field, data }) => {
                if (data?.people) {
                    data.people.forEach(person => {
                        const id = person.id;
                        if (!capacity[id]) {
                            capacity[id] = { 
                                id, 
                                name: person.name || 'Unknown',
                                projects: 0,
                                roles: {}
                            };
                        }
                        capacity[id].projects++;
                        capacity[id].roles[field] = (capacity[id].roles[field] || 0) + 1;
                    });
                }
            });
        });
        
        res.json({ 
            success: true, 
            capacity: Object.values(capacity),
            totalActiveProjects: response.results.length
        });
    } catch (error) {
        console.error('Error fetching capacity:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// DAILY RUNDOWN ENDPOINTS
// ============================================

// GET /rundown - List rundown items for a specific date
app.get('/rundown', async (req, res) => {
    try {
        if (!DAILY_RUNDOWN_DB) {
            return res.status(400).json({ success: false, error: 'Daily Rundown DB not configured' });
        }

        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ success: false, error: 'date query parameter is required (YYYY-MM-DD)' });
        }

        const response = await notion.databases.query({
            database_id: DAILY_RUNDOWN_DB,
            filter: {
                property: 'DATE',
                date: {
                    equals: date
                }
            },
            sorts: [{ timestamp: 'created_time', direction: 'ascending' }]
        });

        const items = response.results.map(parseRundownItem);

        res.json({ success: true, items, count: items.length, date });
    } catch (error) {
        console.error('Error fetching rundown items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /rundown - Create a new rundown item
app.post('/rundown', async (req, res) => {
    try {
        if (!DAILY_RUNDOWN_DB) {
            return res.status(400).json({ success: false, error: 'Daily Rundown DB not configured' });
        }

        const { title, date, section, vertical, creator, status, creatorId, masterLedgerItemIds } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, error: 'title is required' });
        }
        if (!date) {
            return res.status(400).json({ success: false, error: 'date is required' });
        }
        if (!section) {
            return res.status(400).json({ success: false, error: 'section is required' });
        }
        if (!vertical) {
            return res.status(400).json({ success: false, error: 'vertical is required' });
        }

        const properties = buildRundownProperties({
            title, date, section, vertical, creator,
            status: status || '',
            creatorId,
            masterLedgerItemIds
        });

        const response = await notion.pages.create({
            parent: { database_id: DAILY_RUNDOWN_DB },
            properties
        });

        const item = parseRundownItem(response);

        res.json({
            success: true,
            message: 'Rundown item created',
            item
        });
    } catch (error) {
        console.error('Error creating rundown item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /rundown/:id - Update a rundown item
app.patch('/rundown/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const properties = buildRundownProperties(req.body);

        if (Object.keys(properties).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid properties to update' });
        }

        const response = await notion.pages.update({
            page_id: id,
            properties
        });

        const item = parseRundownItem(response);

        res.json({ success: true, message: 'Rundown item updated', item });
    } catch (error) {
        console.error('Error updating rundown item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /rundown/:id - Archive (delete) a rundown item
app.delete('/rundown/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await notion.pages.update({
            page_id: id,
            archived: true
        });

        res.json({ success: true, message: 'Rundown item deleted' });
    } catch (error) {
        console.error('Error deleting rundown item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /rundown/carry-over - Carry over pending items to next day
app.post('/rundown/carry-over', async (req, res) => {
    try {
        if (!DAILY_RUNDOWN_DB) {
            return res.status(400).json({ success: false, error: 'Daily Rundown DB not configured' });
        }

        const { fromDate, toDate } = req.body;

        if (!fromDate || !toDate) {
            return res.status(400).json({ success: false, error: 'fromDate and toDate are required' });
        }

        // Fetch all non-done items for fromDate
        const response = await notion.databases.query({
            database_id: DAILY_RUNDOWN_DB,
            filter: {
                and: [
                    {
                        property: 'DATE',
                        date: { equals: fromDate }
                    },
                    {
                        property: 'STATUS',
                        status: { does_not_equal: 'Done' }
                    }
                ]
            }
        });

        const pendingItems = response.results;
        const results = [];
        const errors = [];

        // Create copies for toDate
        for (const page of pendingItems) {
            try {
                const parsed = parseRundownItem(page);
                const properties = buildRundownProperties({
                    title: parsed.title,
                    date: toDate,
                    section: parsed.section,
                    vertical: parsed.vertical,
                    creator: parsed.creator,
                    status: parsed.status
                });

                const newPage = await notion.pages.create({
                    parent: { database_id: DAILY_RUNDOWN_DB },
                    properties
                });

                results.push({ id: newPage.id, title: parsed.title });
            } catch (err) {
                errors.push({ title: parseRundownItem(page).title, error: err.message });
            }
        }

        res.json({
            success: errors.length === 0,
            message: `${results.length} item(s) carried over to ${toDate}`,
            created: results.length,
            failed: errors.length,
            items: results,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error('Error carrying over rundown items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// EVENTS & ACCREDITATION ENDPOINTS
// ============================================

// HELPER: Parse event item from Notion page
function parseEventItem(page) {
    const props = page.properties;

    return {
        id: page.id,
        url: page.url,
        title: parseProperty(props['NAME'] || props['Title'] || props['Event Name']),
        date: parseProperty(props['DATE'] || props['Event Date'] || props['Start Date']),
        endDate: parseProperty(props['END DATE'] || props['End Date']),
        type: parseProperty(props['TYPE'] || props['Event Type']),
        status: parseProperty(props['STATUS'] || props['Status']),
        location: parseProperty(props['LOCATION'] || props['Location'] || props['Venue']),
        description: parseProperty(props['DESCRIPTION'] || props['Description'] || props['Notes']),
        accreditationStatus: parseProperty(props['ACCREDITATION STATUS'] || props['Accreditation']),
        producer: parseProperty(props['PRODUCER'] || props['Producer'] || props['Lead']),
        team: parseProperty(props['TEAM'] || props['Team']),
        budget: parseProperty(props['BUDGET'] || props['Budget']),
        priority: parseProperty(props['PRIORITY'] || props['Priority']),
        deliverables: parseProperty(props['DELIVERABLES'] || props['Deliverables']),
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time
    };
}

// GET /events - List all events
app.get('/events', async (req, res) => {
    try {
        if (!EVENTS_DB) {
            return res.status(400).json({ success: false, error: 'Events DB not configured' });
        }

        const { startDate, endDate, status } = req.query;

        let filter = undefined;
        const conditions = [];

        if (startDate) {
            conditions.push({
                property: 'DATE',
                date: { on_or_after: startDate }
            });
        }
        if (endDate) {
            conditions.push({
                property: 'DATE',
                date: { on_or_before: endDate }
            });
        }
        if (status) {
            conditions.push({
                property: 'STATUS',
                select: { equals: status }
            });
        }

        if (conditions.length > 0) {
            filter = conditions.length === 1 ? conditions[0] : { and: conditions };
        }

        const response = await notion.databases.query({
            database_id: EVENTS_DB,
            filter,
            page_size: 100,
            sorts: [{ property: 'DATE', direction: 'ascending' }]
        });

        const events = response.results.map(parseEventItem);

        res.json({ success: true, events, count: events.length });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /events/:id - Get single event
app.get('/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const page = await notion.pages.retrieve({ page_id: id });
        const event = parseEventItem(page);
        res.json({ success: true, event });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /events/:id - Update an event
app.patch('/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const props = {};

        if (req.body.title) {
            props['NAME'] = { title: [{ text: { content: req.body.title } }] };
        }
        if (req.body.date !== undefined) {
            props['DATE'] = { date: req.body.date ? { start: req.body.date } : null };
        }
        if (req.body.status) {
            props['STATUS'] = { select: { name: req.body.status } };
        }
        if (req.body.location !== undefined) {
            props['LOCATION'] = { rich_text: req.body.location ? [{ text: { content: req.body.location } }] : [] };
        }
        if (req.body.accreditationStatus) {
            props['ACCREDITATION STATUS'] = { select: { name: req.body.accreditationStatus } };
        }
        if (req.body.description !== undefined) {
            props['DESCRIPTION'] = { rich_text: req.body.description ? [{ text: { content: req.body.description } }] : [] };
        }

        if (Object.keys(props).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid properties to update' });
        }

        await notion.pages.update({
            page_id: id,
            properties: props
        });

        res.json({ success: true, message: 'Event updated' });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/', (req, res) => {
    const { version } = require('./package.json');
    res.json({
        status: 'ok',
        version,
        databases: {
            projects: PROJECTS_DB ? 'configured' : 'missing',
            deliverables: DELIVERABLES_DB ? 'configured' : 'missing',
            dailyRundown: DAILY_RUNDOWN_DB ? 'configured' : 'missing',
            events: EVENTS_DB ? 'configured' : 'missing'
        },
        endpoints: [
            'GET /projects',
            'PATCH /projects/:id',
            'POST /projects',
            'GET /deliverables',
            'GET /deliverables/project/:projectId',
            'POST /deliverables',
            'POST /deliverables/bulk',
            'PATCH /deliverables/:id',
            'GET /staff',
            'GET /capacity',
            'GET /rundown?date=YYYY-MM-DD',
            'POST /rundown',
            'PATCH /rundown/:id',
            'DELETE /rundown/:id',
            'POST /rundown/carry-over',
            'GET /events',
            'GET /events/:id',
            'PATCH /events/:id'
        ]
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
