const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');

const app = express();

// CORS configuration - allow cross-origin requests from any origin
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// Handle preflight requests explicitly
app.options('*', cors());

app.use(express.json());

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Database IDs from environment - must match Cloud Run env var names
const PROJECTS_DB = process.env.NOTION_MASTER_PROJECTS_DB;
const DELIVERABLES_DB = process.env.NOTION_DELIVERABLES_DB;
const DAILY_RUNDOWN_DB = process.env.NOTION_DAILY_RUNDOWN_DB;
const EVENTS_DB = process.env.NOTION_PROD_EVENTS_DB;
const COMMERCIAL_SNAPSHOT_DB = process.env.NOTION_COMMERCIAL_SNAPSHOT_DB;
const STAFF_DIR_DB = process.env.NOTION_STAFF_DIR_DB;

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
        props['(CLIENT) PROJECT DUE DATE'] = { date: data.clientDueDate ? { start: data.clientDueDate } : null };
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

    // Three-Stage Workflow Fields

    // Stage 1: Sales fields
    if (data.salesNotes !== undefined) {
        props['SALES NOTES'] = { rich_text: data.salesNotes ? [{ text: { content: data.salesNotes } }] : [] };
    }
    if (data.probability !== undefined) {
        props['PROBABILITY'] = data.probability ? { select: { name: data.probability } } : { select: null };
    }
    if (data.expectedCloseDate !== undefined) {
        props['EXPECTED CLOSE DATE'] = { date: data.expectedCloseDate ? { start: data.expectedCloseDate } : null };
    }

    // URL fields
    if (data.briefLink !== undefined) {
        props['BRIEF LINK'] = { url: data.briefLink || null };
    }
    if (data.creativeResponseLink !== undefined) {
        props['CREATIVE RESPONSE LINK'] = { url: data.creativeResponseLink || null };
    }
    if (data.frameIoLink !== undefined) {
        props['FRAME.IO LINK'] = { url: data.frameIoLink || null };
    }
    if (data.driveFolder !== undefined) {
        props['DRIVE FOLDER'] = { url: data.driveFolder || null };
    }

    // Stage 2: Handoff fields
    if (data.responseTypeNeeded !== undefined) {
        props['RESPONSE TYPE NEEDED'] = data.responseTypeNeeded ? { select: { name: data.responseTypeNeeded } } : { select: null };
    }
    if (data.suggestedCampaignWindow !== undefined) {
        props['SUGGESTED CAMPAIGN WINDOW'] = { date: data.suggestedCampaignWindow ? { start: data.suggestedCampaignWindow } : null };
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

    // Planned Live Date field
    if (data.plannedLiveDate !== undefined) {
        props['PLANNED LIVE DATE'] = { date: data.plannedLiveDate ? { start: data.plannedLiveDate } : null };
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
        plannedLiveDate: parseProperty(props['PLANNED LIVE DATE']),
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
        // Note: Removed sort by (INTERNAL) DUE DATE as property may not exist
        // Sorting is now done client-side to avoid breaking when Notion schema changes
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            page_size: 100
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
                clientDueDate: parseProperty(props['(CLIENT) PROJECT DUE DATE']) || parseProperty(props['CLIENT DUE DATE']),
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
                // Three-Stage Workflow Fields
                salesNotes: parseProperty(props['SALES NOTES']),
                probability: parseProperty(props['PROBABILITY']),
                expectedCloseDate: parseProperty(props['EXPECTED CLOSE DATE']),
                briefLink: parseProperty(props['BRIEF LINK']),
                creativeResponseLink: parseProperty(props['CREATIVE RESPONSE LINK']),
                frameIoLink: parseProperty(props['FRAME.IO LINK']),
                driveFolder: parseProperty(props['DRIVE FOLDER']),
                responseTypeNeeded: parseProperty(props['RESPONSE TYPE NEEDED']),
                suggestedCampaignWindow: parseProperty(props['SUGGESTED CAMPAIGN WINDOW']),
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
// GET /projects/:id - Get a single project by ID
// ============================================
app.get('/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const page = await notion.pages.retrieve({ page_id: id });
        const props = page.properties;

        const project = {
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
            clientDueDate: parseProperty(props['(CLIENT) PROJECT DUE DATE']) || parseProperty(props['CLIENT DUE DATE']),
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
            salesNotes: parseProperty(props['SALES NOTES']),
            probability: parseProperty(props['PROBABILITY']),
            expectedCloseDate: parseProperty(props['EXPECTED CLOSE DATE']),
            briefLink: parseProperty(props['BRIEF LINK']),
            creativeResponseLink: parseProperty(props['CREATIVE RESPONSE LINK']),
            frameIoLink: parseProperty(props['FRAME.IO LINK']),
            driveFolder: parseProperty(props['DRIVE FOLDER']),
            responseTypeNeeded: parseProperty(props['RESPONSE TYPE NEEDED']),
            suggestedCampaignWindow: parseProperty(props['SUGGESTED CAMPAIGN WINDOW']),
            deliverableCount: parseProperty(props['DELIVERABLE COUNT']),
            deliverablesComplete: parseProperty(props['DELIVERABLES COMPLETE']),
            nextDeliverableDue: parseProperty(props['NEXT DELIVERABLE DUE']),
            parentProject: parseProperty(props['PARENT PROJECT']),
            subItems: parseProperty(props['SUB-ITEMS'])
        };

        res.json({ success: true, project });
    } catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /projects/:id/subitems - Get sub-items for a project
// ============================================
app.get('/projects/:id/subitems', async (req, res) => {
    try {
        const { id } = req.params;

        // Query projects where PARENT PROJECT relation contains this ID
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            filter: {
                property: 'PARENT PROJECT',
                relation: {
                    contains: id
                }
            }
        });

        const subitems = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                url: page.url,
                title: parseProperty(props['NAME']),
                client: parseProperty(props['CLIENT / EXTERNAL PARTNER']),
                projectType: parseProperty(props['PROJECT TYPE']),
                dealStage: parseProperty(props['DEAL STAGE']),
                dueDate: parseProperty(props['(INTERNAL) DUE DATE']),
                creativeWorkflowStatus: parseProperty(props['CREATIVE WORKFLOW STATUS']),
                productionWorkflowStatus: parseProperty(props['PRODUCTION WORKFLOW STATUS'])
            };
        });

        res.json({ success: true, subitems, count: subitems.length });
    } catch (error) {
        console.error('Error fetching subitems:', error);
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
// STAFF DIRECTORY ENDPOINTS (Notion DB)
// ============================================

// Helper: Parse Staff Directory item
function parseStaffMember(page) {
    const props = page.properties;
    return {
        id: page.id,
        notionUrl: page.url,
        firstName: parseProperty(props['First Name']) || parseProperty(props['FIRST NAME']) || '',
        lastName: parseProperty(props['Last Name']) || parseProperty(props['LAST NAME']) || '',
        email: parseProperty(props['Email']) || parseProperty(props['EMAIL']) || '',
        team: parseProperty(props['Team']) || parseProperty(props['TEAM']) || parseProperty(props['Primary Team']) || '',
        role: parseProperty(props['Role']) || parseProperty(props['ROLE']) || parseProperty(props['Job Title']) || '',
        seniority: parseProperty(props['Seniority']) || parseProperty(props['SENIORITY']) || '',
        weeklyCapacityPTS: parseProperty(props['Weekly Capacity']) || parseProperty(props['WEEKLY CAPACITY']) || parseProperty(props['Capacity']) || 40,
        active: parseProperty(props['Active']) !== false && parseProperty(props['ACTIVE']) !== false && parseProperty(props['Status']) !== 'Inactive',
        slackId: parseProperty(props['Slack ID']) || parseProperty(props['SLACK ID']) || '',
        phone: parseProperty(props['Phone']) || parseProperty(props['PHONE']) || '',
        jobRoles: parseProperty(props['Job Roles']) || parseProperty(props['JOB ROLES']) || [],
        // Line Manager fields
        isLineManager: parseProperty(props['IS LINE MANAGER']) || parseProperty(props['Is Line Manager']) || false,
        lineManager: parseProperty(props['LINE MANAGER']) || parseProperty(props['Line Manager']) || '',
        lineManagerName: parseProperty(props['LINE MANAGER NAME (API)']) || parseProperty(props['Line Manager Name (API)']) || '',
        lineManagerDropdown: parseProperty(props['LINE MANAGER (DROPDOWN)']) || parseProperty(props['Line Manager (Dropdown)']) || '',
        createdAt: page.created_time,
        updatedAt: page.last_edited_time
    };
}

// Helper: Build Staff Directory properties for Notion
function buildStaffProperties(data) {
    const props = {};

    if (data.firstName !== undefined) {
        props['First Name'] = { title: [{ text: { content: data.firstName || '' } }] };
    }
    if (data.lastName !== undefined) {
        props['Last Name'] = { rich_text: data.lastName ? [{ text: { content: data.lastName } }] : [] };
    }
    if (data.email !== undefined) {
        props['Email'] = { email: data.email || null };
    }
    if (data.team !== undefined) {
        props['Team'] = data.team ? { select: { name: data.team } } : { select: null };
    }
    if (data.role !== undefined) {
        props['Role'] = { rich_text: data.role ? [{ text: { content: data.role } }] : [] };
    }
    if (data.seniority !== undefined) {
        props['Seniority'] = data.seniority ? { select: { name: data.seniority } } : { select: null };
    }
    if (data.weeklyCapacityPTS !== undefined) {
        props['Weekly Capacity'] = { number: parseInt(data.weeklyCapacityPTS) || 40 };
    }
    if (data.active !== undefined) {
        props['Active'] = { checkbox: data.active !== false };
    }
    if (data.slackId !== undefined) {
        props['Slack ID'] = { rich_text: data.slackId ? [{ text: { content: data.slackId } }] : [] };
    }
    if (data.phone !== undefined) {
        props['Phone'] = { phone_number: data.phone || null };
    }
    if (data.jobRoles !== undefined && Array.isArray(data.jobRoles)) {
        props['Job Roles'] = { multi_select: data.jobRoles.map(r => ({ name: r })) };
    }
    // Line Manager fields
    if (data.isLineManager !== undefined) {
        props['IS LINE MANAGER'] = { checkbox: data.isLineManager === true };
    }
    if (data.lineManagerDropdown !== undefined) {
        props['LINE MANAGER (DROPDOWN)'] = data.lineManagerDropdown ? { select: { name: data.lineManagerDropdown } } : { select: null };
    }

    return props;
}

// GET /staff-directory - List all staff from Notion Staff Directory DB
app.get('/staff-directory', async (req, res) => {
    try {
        if (!STAFF_DIR_DB) {
            return res.status(400).json({ success: false, error: 'Staff Directory DB not configured' });
        }

        const { team, active } = req.query;
        let filter = undefined;

        // Build filter if provided
        const filters = [];
        if (team) {
            filters.push({ property: 'Team', select: { equals: team } });
        }
        if (active !== undefined) {
            filters.push({ property: 'Active', checkbox: { equals: active === 'true' } });
        }
        if (filters.length === 1) {
            filter = filters[0];
        } else if (filters.length > 1) {
            filter = { and: filters };
        }

        const response = await notion.databases.query({
            database_id: STAFF_DIR_DB,
            filter,
            page_size: 100,
            sorts: [{ property: 'First Name', direction: 'ascending' }]
        });

        const staff = response.results.map(parseStaffMember);
        res.json({ success: true, staff, count: staff.length });
    } catch (error) {
        console.error('Error fetching staff directory:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /staff-directory/:id - Get single staff member
app.get('/staff-directory/:id', async (req, res) => {
    try {
        if (!STAFF_DIR_DB) {
            return res.status(400).json({ success: false, error: 'Staff Directory DB not configured' });
        }

        const page = await notion.pages.retrieve({ page_id: req.params.id });
        const member = parseStaffMember(page);
        res.json({ success: true, member });
    } catch (error) {
        console.error('Error fetching staff member:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /staff-directory - Create new staff member
app.post('/staff-directory', async (req, res) => {
    try {
        if (!STAFF_DIR_DB) {
            return res.status(400).json({ success: false, error: 'Staff Directory DB not configured' });
        }

        const { firstName, lastName, email, team, role, seniority, weeklyCapacityPTS, active, jobRoles, phone, slackId } = req.body;

        if (!firstName) {
            return res.status(400).json({ success: false, error: 'firstName is required' });
        }

        const properties = buildStaffProperties({
            firstName, lastName, email, team, role, seniority,
            weeklyCapacityPTS, active: active !== false, jobRoles, phone, slackId
        });

        const page = await notion.pages.create({
            parent: { database_id: STAFF_DIR_DB },
            properties
        });

        const member = parseStaffMember(page);
        res.json({ success: true, member, id: page.id });
    } catch (error) {
        console.error('Error creating staff member:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /staff-directory/:id - Update staff member
app.patch('/staff-directory/:id', async (req, res) => {
    try {
        if (!STAFF_DIR_DB) {
            return res.status(400).json({ success: false, error: 'Staff Directory DB not configured' });
        }

        const properties = buildStaffProperties(req.body);

        if (Object.keys(properties).length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        const page = await notion.pages.update({
            page_id: req.params.id,
            properties
        });

        const member = parseStaffMember(page);
        res.json({ success: true, member, id: page.id });
    } catch (error) {
        console.error('Error updating staff member:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /staff-directory/:id - Archive staff member (soft delete)
app.delete('/staff-directory/:id', async (req, res) => {
    try {
        if (!STAFF_DIR_DB) {
            return res.status(400).json({ success: false, error: 'Staff Directory DB not configured' });
        }

        // Archive the page instead of deleting
        await notion.pages.update({
            page_id: req.params.id,
            archived: true
        });

        res.json({ success: true, archived: true, id: req.params.id });
    } catch (error) {
        console.error('Error archiving staff member:', error);
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

// HELPER: Find and parse the title property from a Notion page
// Notion databases always have exactly one property with type 'title'
function getTitleFromPage(props) {
    // First try common title property names
    const commonTitleNames = ['Event', 'Name', 'Title', 'name', 'title'];
    for (const name of commonTitleNames) {
        if (props[name]?.type === 'title') {
            return parseProperty(props[name]);
        }
    }
    // Fallback: search all properties for the title type
    for (const [key, value] of Object.entries(props)) {
        if (value?.type === 'title') {
            return parseProperty(value);
        }
    }
    return null;
}

// HELPER: Parse event item from Notion page
// Maps to "Events & Accreditation Production + Planning" database schema
function parseEventItem(page) {
    const props = page.properties;

    // Handle date property which can be a date range
    const dateValue = props['Date']?.date;
    const startDate = dateValue?.start || null;
    const endDate = dateValue?.end || null;

    // Get the title - try specific property first, then fallback to finding title by type
    const eventTitle = parseProperty(props['Event']) || getTitleFromPage(props);

    return {
        id: page.id,
        url: page.url,
        title: eventTitle,
        event: eventTitle,
        date: startDate,
        endDate: endDate,
        type: parseProperty(props['Angle Bucket']),
        angleBucket: parseProperty(props['Angle Bucket']),
        status: parseProperty(props['Status']),
        location: parseProperty(props['Where']),
        where: parseProperty(props['Where']),
        accreditationStatus: parseProperty(props['Local Permissions Needed']),
        accreditation: parseProperty(props['Local Permissions Needed']),
        producer: parseProperty(props['Sub-Item Owner']),
        subItemOwner: parseProperty(props['Sub-Item Owner']),
        creators: parseProperty(props['Creator(s)']),
        priority: parseProperty(props['Coverage Priority']),
        coveragePriority: parseProperty(props['Coverage Priority']),
        abroad: parseProperty(props['Abroad']),
        visaNeeded: parseProperty(props['Visa / ESTA Needed']),
        subItemType: parseProperty(props['Sub-Item Type']),
        subItemFormats: parseProperty(props['Sub-Item Format(s)']),
        idea: parseProperty(props['Idea']),
        link: parseProperty(props['Link']),
        additionalContextLink: parseProperty(props['Additional Context Link']),
        externalContactDetails: parseProperty(props['External Contact Details']),
        permissionDetails: parseProperty(props['Permission Details']),
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
                property: 'Date',
                date: { on_or_after: startDate }
            });
        }
        if (endDate) {
            conditions.push({
                property: 'Date',
                date: { on_or_before: endDate }
            });
        }
        if (status) {
            conditions.push({
                property: 'Status',
                select: { equals: status }
            });
        }

        if (conditions.length > 0) {
            filter = conditions.length === 1 ? conditions[0] : { and: conditions };
        }

        const response = await notion.databases.query({
            database_id: EVENTS_DB,
            filter,
            page_size: 100
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
            props['Event'] = { title: [{ text: { content: req.body.title } }] };
        }
        if (req.body.date !== undefined) {
            props['Date'] = { date: req.body.date ? { start: req.body.date, end: req.body.endDate || null } : null };
        }
        if (req.body.status) {
            props['Status'] = { select: { name: req.body.status } };
        }
        if (req.body.location !== undefined) {
            props['Where'] = { rich_text: req.body.location ? [{ text: { content: req.body.location } }] : [] };
        }
        if (req.body.accreditationStatus) {
            props['Local Permissions Needed'] = { select: { name: req.body.accreditationStatus } };
        }
        if (req.body.coveragePriority) {
            props['Coverage Priority'] = { select: { name: req.body.coveragePriority } };
        }
        if (req.body.angleBucket) {
            props['Angle Bucket'] = { select: { name: req.body.angleBucket } };
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

// ============================================
// DEAL AGREED AUTOMATION
// Creates Layer 2 Episodes and Layer 3 Tasks
// from AGREED CONTENT DELIVERABLES text
// ============================================

// In-memory tracking of processed deals (resets on deploy)
// For persistent tracking, could use Firebase
const processedDeals = new Set();

// Parse deliverables text like "3x Love Notes episodes\n2x Trailer cuts"
function parseDeliverables(text) {
    if (!text) return [];

    const deliverables = [];
    const lines = text.trim().split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Match "Nx description" pattern
        const match = trimmed.match(/^(\d+)\s*x\s+(.+)$/i);
        if (match) {
            deliverables.push({
                count: parseInt(match[1], 10),
                description: match[2].trim()
            });
        } else {
            // No pattern match, treat as 1x item
            deliverables.push({ count: 1, description: trimmed });
        }
    }

    return deliverables;
}

// POST /process-deal-agreed - Run the Deal Agreed automation
app.post('/process-deal-agreed', async (req, res) => {
    try {
        if (!PROJECTS_DB) {
            return res.status(400).json({ success: false, error: 'Projects DB not configured' });
        }

        console.log('[Deal Agreed] Starting automation...');

        // Query for deals with deliverables text (filter in code for deal stage)
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            filter: {
                property: 'AGREED CONTENT DELIVERABLES (FOR AI)',
                rich_text: { is_not_empty: true }
            }
        });

        console.log(`[Deal Agreed] Found ${response.results.length} items with deliverables`);

        const results = {
            dealsProcessed: 0,
            dealsSkipped: 0,
            episodesCreated: 0,
            tasksCreated: 0,
            errors: []
        };

        for (const page of response.results) {
            const dealId = page.id;
            const props = page.properties;

            // Check deal stage / project status in code
            const dealStage = parseProperty(props['DEAL STAGE']);
            const projectOutcome = parseProperty(props['PROJECT OUTCOME']);
            const projectStatus = parseProperty(props['PROJECT STATUS']);

            const isDealAgreed = dealStage === 'Deal Agreed';
            const isWonInProgress = projectOutcome === 'Won' && projectStatus === 'In progress';

            if (!isDealAgreed && !isWonInProgress) {
                continue; // Skip items that don't match criteria
            }

            // Skip if already processed
            if (processedDeals.has(dealId)) {
                console.log(`[Deal Agreed] Skipping already processed: ${dealId}`);
                results.dealsSkipped++;
                continue;
            }

            const dealName = parseProperty(props['NAME']) || 'Untitled Deal';
            const deliverablesText = parseProperty(props['AGREED CONTENT DELIVERABLES (FOR AI)']);

            console.log(`[Deal Agreed] Processing: ${dealName}`);
            console.log(`[Deal Agreed] Deliverables text: ${deliverablesText}`);

            const deliverables = parseDeliverables(deliverablesText);

            if (deliverables.length === 0) {
                console.log(`[Deal Agreed] No deliverables parsed for ${dealName}`);
                continue;
            }

            try {
                // Create episodes and tasks for each deliverable
                for (const { count, description } of deliverables) {
                    console.log(`[Deal Agreed] Creating ${count}x ${description}`);

                    for (let i = 1; i <= count; i++) {
                        // Create Layer 2 Episode
                        const episodeName = `${dealName} - ${description} #${i}`;

                        const episodeResponse = await notion.pages.create({
                            parent: { database_id: PROJECTS_DB },
                            properties: {
                                'NAME': { title: [{ text: { content: episodeName } }] },
                                'PARENT ITEM': { relation: [{ id: dealId }] },
                                'STATUS': { status: { name: 'Not started' } }
                            }
                        });

                        const episodeId = episodeResponse.id;
                        results.episodesCreated++;
                        console.log(`[Deal Agreed] Created episode: ${episodeName}`);

                        // Create Layer 3 Edit Task
                        const editTaskName = `${dealName} - ${description} #${i} - Edit`;
                        await notion.pages.create({
                            parent: { database_id: PROJECTS_DB },
                            properties: {
                                'NAME': { title: [{ text: { content: editTaskName } }] },
                                'PARENT ITEM': { relation: [{ id: episodeId }] },
                                'DISCIPLINE': { select: { name: 'Editor' } },
                                'STATUS': { status: { name: 'Not started' } }
                            }
                        });
                        results.tasksCreated++;
                        console.log(`[Deal Agreed] Created task: ${editTaskName}`);

                        // Create Layer 3 Thumbnail Task
                        const thumbnailTaskName = `${dealName} - ${description} #${i} - Thumbnail`;
                        await notion.pages.create({
                            parent: { database_id: PROJECTS_DB },
                            properties: {
                                'NAME': { title: [{ text: { content: thumbnailTaskName } }] },
                                'PARENT ITEM': { relation: [{ id: episodeId }] },
                                'DISCIPLINE': { select: { name: 'Design' } },
                                'STATUS': { status: { name: 'Not started' } }
                            }
                        });
                        results.tasksCreated++;
                        console.log(`[Deal Agreed] Created task: ${thumbnailTaskName}`);
                    }
                }

                // Mark as processed
                processedDeals.add(dealId);
                results.dealsProcessed++;

            } catch (dealError) {
                console.error(`[Deal Agreed] Error processing ${dealName}:`, dealError.message);
                results.errors.push({ deal: dealName, error: dealError.message });
            }
        }

        console.log(`[Deal Agreed] Complete. Processed: ${results.dealsProcessed}, Episodes: ${results.episodesCreated}, Tasks: ${results.tasksCreated}`);

        res.json({
            success: true,
            message: 'Deal Agreed automation complete',
            ...results
        });

    } catch (error) {
        console.error('[Deal Agreed] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /process-deal-agreed/status - Check automation status
app.get('/process-deal-agreed/status', (req, res) => {
    res.json({
        success: true,
        processedDealsCount: processedDeals.size,
        processedDealIds: Array.from(processedDeals)
    });
});

// POST /process-deal-agreed/reset - Reset processed deals tracking
app.post('/process-deal-agreed/reset', (req, res) => {
    const count = processedDeals.size;
    processedDeals.clear();
    res.json({
        success: true,
        message: `Cleared ${count} processed deal(s). Next run will reprocess all matching deals.`
    });
});

// ============================================
// DAILY RUNDOWN AUTOMATION
// Creates Master Ledger items from Daily Rundown
// and links them back
// ============================================

// Vertical to Parent Page ID mapping
const VERTICAL_PARENTS = {
    'UK': '0f78200e-ef2f-4d3d-88e1-313a891b315e',
    'MAIN': '4093ae8c-3363-4ca7-b5c6-d811f493e3ac',
    'SPORT': 'c2c82778-6419-435b-b46d-de0a0256b813',
    'MONEY': 'e7e4081b-5b51-4efa-a18a-61c40bea95cb',
    'RESPAWN': '03806b23-bcf4-4ada-b37a-82eb53384519',
    'SPOTLIGHT': 'dea0d837-fe44-443c-8b38-5470cb5ac2d2'
};

// POST /process-daily-rundown - Sync Daily Rundown to Master Ledger
app.post('/process-daily-rundown', async (req, res) => {
    try {
        if (!DAILY_RUNDOWN_DB || !PROJECTS_DB) {
            return res.status(400).json({
                success: false,
                error: 'Daily Rundown DB or Projects DB not configured'
            });
        }

        console.log('[Daily Rundown] Starting automation...');

        // Query Daily Rundown for items without MASTER LEDGER ITEM link
        const response = await notion.databases.query({
            database_id: DAILY_RUNDOWN_DB,
            filter: {
                property: 'MASTER LEDGER ITEM',
                relation: { is_empty: true }
            }
        });

        console.log(`[Daily Rundown] Found ${response.results.length} items without Master Ledger link`);

        const results = {
            itemsProcessed: 0,
            itemsSkipped: 0,
            ledgerItemsCreated: 0,
            errors: []
        };

        for (const page of response.results) {
            const rundownId = page.id;
            const props = page.properties;

            const title = parseProperty(props['TITLE']) || 'Untitled';
            const vertical = parseProperty(props['VERTICAL']);
            const date = parseProperty(props['DATE']);
            const section = parseProperty(props['SECTION']);
            const creator = parseProperty(props['CREATOR']);

            console.log(`[Daily Rundown] Processing: ${title} (${vertical})`);

            // Skip if no vertical (can't determine parent)
            if (!vertical) {
                console.log(`[Daily Rundown] Skipping ${title} - no VERTICAL set`);
                results.itemsSkipped++;
                continue;
            }

            // Get parent page ID for this vertical
            const parentId = VERTICAL_PARENTS[vertical];
            if (!parentId) {
                console.log(`[Daily Rundown] Skipping ${title} - unknown VERTICAL: ${vertical}`);
                results.itemsSkipped++;
                continue;
            }

            try {
                // Create Layer 2 item in Master Ledger
                const ledgerItemName = title;

                const ledgerProperties = {
                    'NAME': { title: [{ text: { content: ledgerItemName } }] },
                    'PARENT ITEM': { relation: [{ id: parentId }] },
                    'STATUS': { status: { name: 'Not started' } }
                };

                // Add VERTICAL if the field exists in Master Ledger
                if (vertical) {
                    ledgerProperties['VERTICAL'] = { select: { name: vertical } };
                }

                // Add DUE DATE if date is set
                if (date) {
                    ledgerProperties['DUE DATE'] = { date: { start: date } };
                }

                const ledgerResponse = await notion.pages.create({
                    parent: { database_id: PROJECTS_DB },
                    properties: ledgerProperties
                });

                const ledgerItemId = ledgerResponse.id;
                results.ledgerItemsCreated++;
                console.log(`[Daily Rundown] Created Master Ledger item: ${ledgerItemName}`);

                // Create Layer 3 Edit Task
                const editTaskName = `${title} - Edit`;
                await notion.pages.create({
                    parent: { database_id: PROJECTS_DB },
                    properties: {
                        'NAME': { title: [{ text: { content: editTaskName } }] },
                        'PARENT ITEM': { relation: [{ id: ledgerItemId }] },
                        'DISCIPLINE': { select: { name: 'Editor' } },
                        'STATUS': { status: { name: 'Not started' } }
                    }
                });
                console.log(`[Daily Rundown] Created Edit task: ${editTaskName}`);

                // Create Layer 3 Thumbnail Task
                const thumbnailTaskName = `${title} - Thumbnail`;
                await notion.pages.create({
                    parent: { database_id: PROJECTS_DB },
                    properties: {
                        'NAME': { title: [{ text: { content: thumbnailTaskName } }] },
                        'PARENT ITEM': { relation: [{ id: ledgerItemId }] },
                        'DISCIPLINE': { select: { name: 'Design' } },
                        'STATUS': { status: { name: 'Not started' } }
                    }
                });
                console.log(`[Daily Rundown] Created Thumbnail task: ${thumbnailTaskName}`);

                // Update Daily Rundown item with link back to Master Ledger
                await notion.pages.update({
                    page_id: rundownId,
                    properties: {
                        'MASTER LEDGER ITEM': { relation: [{ id: ledgerItemId }] }
                    }
                });
                console.log(`[Daily Rundown] Linked back to Daily Rundown: ${title}`);

                results.itemsProcessed++;

            } catch (itemError) {
                console.error(`[Daily Rundown] Error processing ${title}:`, itemError.message);
                results.errors.push({ title, error: itemError.message });
            }
        }

        console.log(`[Daily Rundown] Complete. Processed: ${results.itemsProcessed}, Created: ${results.ledgerItemsCreated}`);

        res.json({
            success: true,
            message: 'Daily Rundown automation complete',
            ...results
        });

    } catch (error) {
        console.error('[Daily Rundown] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// POST /process-events-to-ledger - Sync Events to Master Ledger
// Creates Master Ledger items + Layer 3 tasks from Events
// ============================================
app.post('/process-events-to-ledger', async (req, res) => {
    try {
        if (!EVENTS_DB || !PROJECTS_DB) {
            return res.status(400).json({
                success: false,
                error: 'Events DB or Projects DB not configured'
            });
        }

        console.log('[Events→Ledger] Starting automation...');

        // Query Events where Master Ledger Row is empty
        const response = await notion.databases.query({
            database_id: EVENTS_DB,
            filter: {
                property: 'Master Ledger Row',
                relation: { is_empty: true }
            }
        });

        console.log(`[Events→Ledger] Found ${response.results.length} events without Master Ledger link`);

        const results = {
            eventsProcessed: 0,
            eventsSkipped: 0,
            ledgerItemsCreated: 0,
            tasksCreated: 0,
            errors: []
        };

        // Helper to detect vertical from event title prefix
        function detectVerticalFromTitle(title) {
            const upperTitle = (title || '').toUpperCase();
            for (const vertical of Object.keys(VERTICAL_PARENTS)) {
                if (upperTitle.startsWith(vertical + ' -') || upperTitle.startsWith(vertical + ' –')) {
                    return vertical;
                }
            }
            return 'MAIN'; // Default to MAIN if no prefix detected
        }

        for (const page of response.results) {
            const eventId = page.id;
            const props = page.properties;

            const title = parseProperty(props['Event']) || 'Untitled Event';
            const date = parseProperty(props['Date']);
            const location = parseProperty(props['Where']);

            console.log(`[Events→Ledger] Processing: ${title}`);

            // Detect vertical from title prefix
            const vertical = detectVerticalFromTitle(title);
            const parentId = VERTICAL_PARENTS[vertical];

            if (!parentId) {
                console.log(`[Events→Ledger] Skipping ${title} - no parent found for vertical: ${vertical}`);
                results.eventsSkipped++;
                continue;
            }

            try {
                // Create Master Ledger item
                const ledgerProperties = {
                    'NAME': { title: [{ text: { content: title } }] },
                    'PARENT ITEM': { relation: [{ id: parentId }] },
                    'STATUS': { status: { name: 'Not started' } },
                    'VERTICAL': { select: { name: vertical } }
                };

                // Add DUE DATE if event has a date
                if (date) {
                    ledgerProperties['DUE DATE'] = { date: { start: date } };
                }

                // Add SHOOT LOCATION if event has a location
                if (location) {
                    ledgerProperties['SHOOT LOCATION'] = { rich_text: [{ text: { content: location } }] };
                }

                const ledgerResponse = await notion.pages.create({
                    parent: { database_id: PROJECTS_DB },
                    properties: ledgerProperties
                });

                const ledgerItemId = ledgerResponse.id;
                results.ledgerItemsCreated++;
                console.log(`[Events→Ledger] Created Master Ledger item: ${title}`);

                // Create Layer 3 Edit Task
                const editTaskName = `${title} - Edit`;
                await notion.pages.create({
                    parent: { database_id: PROJECTS_DB },
                    properties: {
                        'NAME': { title: [{ text: { content: editTaskName } }] },
                        'PARENT ITEM': { relation: [{ id: ledgerItemId }] },
                        'DISCIPLINE': { select: { name: 'Editor' } },
                        'STATUS': { status: { name: 'Not started' } }
                    }
                });
                results.tasksCreated++;
                console.log(`[Events→Ledger] Created Edit task: ${editTaskName}`);

                // Create Layer 3 Thumbnail Task
                const thumbnailTaskName = `${title} - Thumbnail`;
                await notion.pages.create({
                    parent: { database_id: PROJECTS_DB },
                    properties: {
                        'NAME': { title: [{ text: { content: thumbnailTaskName } }] },
                        'PARENT ITEM': { relation: [{ id: ledgerItemId }] },
                        'DISCIPLINE': { select: { name: 'Design' } },
                        'STATUS': { status: { name: 'Not started' } }
                    }
                });
                results.tasksCreated++;
                console.log(`[Events→Ledger] Created Thumbnail task: ${thumbnailTaskName}`);

                // Update Event with link back to Master Ledger
                await notion.pages.update({
                    page_id: eventId,
                    properties: {
                        'Master Ledger Row': { relation: [{ id: ledgerItemId }] }
                    }
                });
                console.log(`[Events→Ledger] Linked Event back to Master Ledger: ${title}`);

                results.eventsProcessed++;

            } catch (itemError) {
                console.error(`[Events→Ledger] Error processing ${title}:`, itemError.message);
                results.errors.push({ title, error: itemError.message });
            }
        }

        console.log(`[Events→Ledger] Complete. Processed: ${results.eventsProcessed}, Created: ${results.ledgerItemsCreated} items, ${results.tasksCreated} tasks`);

        res.json({
            success: true,
            message: 'Events to Ledger automation complete',
            ...results
        });

    } catch (error) {
        console.error('[Events→Ledger] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// POST /process-ledger-to-events - Sync Master Ledger to Events
// Creates Events from Master Ledger items that need shoots
// ============================================
app.post('/process-ledger-to-events', async (req, res) => {
    try {
        if (!EVENTS_DB || !PROJECTS_DB) {
            return res.status(400).json({
                success: false,
                error: 'Events DB or Projects DB not configured'
            });
        }

        console.log('[Ledger→Events] Starting automation...');

        // Query Master Ledger items where Events relation is empty
        // Only get items that have a PARENT ITEM (i.e., Layer 2 deliverables, not Layer 1 parents)
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            filter: {
                and: [
                    {
                        property: 'Events',
                        relation: { is_empty: true }
                    },
                    {
                        property: 'PARENT ITEM',
                        relation: { is_not_empty: true }
                    }
                ]
            }
        });

        console.log(`[Ledger→Events] Found ${response.results.length} ledger items without Events link`);

        const results = {
            ledgerItemsProcessed: 0,
            ledgerItemsSkipped: 0,
            eventsCreated: 0,
            errors: []
        };

        for (const page of response.results) {
            const ledgerId = page.id;
            const props = page.properties;

            const title = parseProperty(props['NAME']) || 'Untitled';
            const dueDate = parseProperty(props['DUE DATE']);
            const callTime = parseProperty(props['CALL TIME']);
            const shootLocation = parseProperty(props['SHOOT LOCATION']);
            const budget = parseProperty(props['BUDGET']);
            const productionLead = props['PRODUCTION LEAD(S) 1']?.people?.[0]?.id;
            const creators = props['CONTENT CREATOR(S)']?.relation || [];

            console.log(`[Ledger→Events] Processing: ${title}`);

            // Skip items that look like Layer 3 tasks (have DISCIPLINE set)
            const discipline = parseProperty(props['DISCIPLINE']);
            if (discipline) {
                console.log(`[Ledger→Events] Skipping ${title} - is a Layer 3 task (DISCIPLINE: ${discipline})`);
                results.ledgerItemsSkipped++;
                continue;
            }

            try {
                // Create Event
                const eventProperties = {
                    'Event': { title: [{ text: { content: title } }] },
                    'Status': { select: { name: 'Booked' } },
                    'Master Ledger Row': { relation: [{ id: ledgerId }] }
                };

                // Add Date from DUE DATE or CALL TIME
                const eventDate = callTime || dueDate;
                if (eventDate) {
                    eventProperties['Date'] = { date: { start: eventDate } };
                }

                // Add Where from SHOOT LOCATION
                if (shootLocation) {
                    eventProperties['Where'] = { rich_text: [{ text: { content: shootLocation } }] };
                }

                // Add Shoot Budget from BUDGET
                if (budget) {
                    eventProperties['Shoot Budget'] = { number: budget };
                }

                // Add Shoot Lead from PRODUCTION LEAD(S) 1
                if (productionLead) {
                    eventProperties['Shoot Lead'] = { people: [{ id: productionLead }] };
                }

                // Add Creator(s) from CONTENT CREATOR(S)
                if (creators.length > 0) {
                    eventProperties['Creator(s)'] = { relation: creators.map(c => ({ id: c.id || c })) };
                }

                const eventResponse = await notion.pages.create({
                    parent: { database_id: EVENTS_DB },
                    properties: eventProperties
                });

                const eventId = eventResponse.id;
                results.eventsCreated++;
                console.log(`[Ledger→Events] Created Event: ${title}`);

                // Update Master Ledger item with link back to Event
                await notion.pages.update({
                    page_id: ledgerId,
                    properties: {
                        'Events': { relation: [{ id: eventId }] }
                    }
                });
                console.log(`[Ledger→Events] Linked Master Ledger back to Event: ${title}`);

                results.ledgerItemsProcessed++;

            } catch (itemError) {
                console.error(`[Ledger→Events] Error processing ${title}:`, itemError.message);
                results.errors.push({ title, error: itemError.message });
            }
        }

        console.log(`[Ledger→Events] Complete. Processed: ${results.ledgerItemsProcessed}, Created: ${results.eventsCreated} events`);

        res.json({
            success: true,
            message: 'Ledger to Events automation complete',
            ...results
        });

    } catch (error) {
        console.error('[Ledger→Events] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// DAILY SNAPSHOT ENDPOINT (Commercial Snapshot)
// ============================================

// Section configuration for daily snapshot grouping
const SECTION_CONFIG = {
    '⭐️ Recent Wins': { id: 'wins', order: 1, title: 'Recent Wins', tone: 'emerald' },
    '🔥 Hot Today': { id: 'hot', order: 2, title: 'Hot Today', tone: 'rose' },
    '📦 Delivering Soon': { id: 'delivering', order: 3, title: 'Delivering Soon', tone: 'amber' },
    '🎬 In Production': { id: 'production', order: 4, title: 'In Production', tone: 'sky' },
    '💰 Deals In Progress': { id: 'deals', order: 5, title: 'Deals In Progress', tone: 'purple' },
    '📊 Noteworthy Updates': { id: 'updates', order: 6, title: 'Noteworthy Updates', tone: 'indigo' },
    '🛠 Internal / Workflow': { id: 'internal', order: 7, title: 'Internal / Workflow', tone: 'gray' },
    '👋 Coming Up': { id: 'coming_up', order: 8, title: 'Coming Up', tone: 'indigo' },
    'Other': { id: 'other', order: 9, title: 'Other', tone: 'slate' }
};

// Helper functions for daily snapshot
function getFirstRollup(parsed) {
    if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    return parsed;
}

function getPeopleFromRollup(parsed) {
    if (Array.isArray(parsed)) {
        return parsed.flat().filter(p => p && p.name);
    }
    return [];
}

// GET /daily-rundown - Get today's snapshot items grouped by section
app.get('/daily-rundown', async (req, res) => {
    try {
        if (!COMMERCIAL_SNAPSHOT_DB) {
            return res.status(400).json({
                success: false,
                error: 'Commercial Snapshot DB not configured'
            });
        }

        // Allow date override via query param (for testing/historical views)
        const targetDate = req.query.date || new Date().toISOString().split('T')[0];

        // Query with filter for Snapshot Date = today
        const response = await notion.databases.query({
            database_id: COMMERCIAL_SNAPSHOT_DB,
            filter: {
                property: 'Snapshot Date',
                date: {
                    equals: targetDate
                }
            },
            page_size: 100
        });

        // Parse all items
        const items = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                url: page.url,
                lastEditedTime: page.last_edited_time,

                // Core identity
                record: parseProperty(props['Record']),
                projectIds: parseProperty(props['Project']),

                // Daily rundown control fields (the ones user sets)
                snapshotDate: parseProperty(props['Snapshot Date']),
                weekCommencing: parseProperty(props['Week Commencing']),
                section: parseProperty(props['Section']),
                itemType: parseProperty(props['Item Type']),
                headline: parseProperty(props['Headline']),
                details: parseProperty(props['Details']),
                links: parseProperty(props['Links']),
                slackMentions: parseProperty(props['Slack Mentions']),
                statusTag: parseProperty(props['Status Tag']),
                rawSnapshotBlock: parseProperty(props['Raw Snapshot Block']),

                // Project metadata (rollups)
                projectName: getFirstRollup(parseProperty(props['Project Name'])),
                clientPartner: getFirstRollup(parseProperty(props['Client / Partner'])),
                vertical: getFirstRollup(parseProperty(props['Vertical'])),
                salesLeads: getPeopleFromRollup(parseProperty(props['Sales Lead(s)'])),
                cardSummary: getFirstRollup(parseProperty(props['Card Summary'])),
                aiStatusRecap: getFirstRollup(parseProperty(props['AI Status Recap'])),

                // Status and workflow
                status1: getFirstRollup(parseProperty(props['Status 1'])),
                status: getFirstRollup(parseProperty(props['Status'])),
                creativeWorkflowStatus: getFirstRollup(parseProperty(props['Creative Workflow Status'])),
                productionWorkflowStatus: getFirstRollup(parseProperty(props['Production Workflow Status'])),
                projectOutcome: getFirstRollup(parseProperty(props['Project Outcome'])),
                priorityLevel: getFirstRollup(parseProperty(props['Priority Level'])),

                // Commercial info
                dealStage: getFirstRollup(parseProperty(props['Deal Stage'])),
                dealValue: parseProperty(props['Deal Value']),

                // Timeline
                clientProjectDueDate: getFirstRollup(parseProperty(props['Client Project Due Date'])),
                internalProjectDueDate: getFirstRollup(parseProperty(props['Internal Project Due Date'])),
                earliestDeliverableDue: parseProperty(props['Earliest Deliverable Due']),
                latestDeliverableDue: parseProperty(props['Latest Deliverable Due']),

                // Live campaign
                liveLink: getFirstRollup(parseProperty(props['Live Link'])),

                // Slack
                slackChannelName: getFirstRollup(parseProperty(props['Slack Channel Name'])),
                slackChannelId: getFirstRollup(parseProperty(props['Slack Channel ID']))
            };
        });

        // Group items by section
        const sectionGroups = {};
        items.forEach(item => {
            const sectionName = item.section || 'Other';
            if (!sectionGroups[sectionName]) {
                sectionGroups[sectionName] = [];
            }
            sectionGroups[sectionName].push(item);
        });

        // Convert to ordered sections array
        const sections = Object.entries(sectionGroups)
            .map(([sectionName, sectionItems]) => {
                const config = SECTION_CONFIG[sectionName] || {
                    id: sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
                    order: 99,
                    title: sectionName,
                    tone: 'slate'
                };
                return {
                    ...config,
                    name: sectionName,
                    items: sectionItems
                };
            })
            .sort((a, b) => a.order - b.order);

        res.json({
            success: true,
            date: targetDate,
            totalItems: items.length,
            sectionCount: sections.length,
            sections
        });

    } catch (error) {
        console.error('Error fetching daily snapshot:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// COMMERCIAL SNAPSHOT CRUD
// For the editor widget
// ============================================

// POST /commercial-snapshot - Create new snapshot item
app.post('/commercial-snapshot', async (req, res) => {
    try {
        if (!COMMERCIAL_SNAPSHOT_DB) {
            return res.status(400).json({ success: false, error: 'Commercial Snapshot DB not configured' });
        }

        const { projectId, section, statusTag, headline, details, links, snapshotDate } = req.body;

        if (!section || !headline) {
            return res.status(400).json({ success: false, error: 'Section and Headline are required' });
        }

        const properties = {
            'Headline': { title: [{ text: { content: headline } }] },
            'Section': { select: { name: section } },
            'Snapshot Date': { date: { start: snapshotDate || new Date().toISOString().split('T')[0] } }
        };

        if (statusTag) {
            properties['Status Tag'] = { select: { name: statusTag } };
        }
        if (details) {
            properties['Details'] = { rich_text: [{ text: { content: details } }] };
        }
        if (links) {
            properties['Links'] = { rich_text: [{ text: { content: links } }] };
        }
        if (projectId) {
            properties['Project'] = { relation: [{ id: projectId }] };
        }

        const response = await notion.pages.create({
            parent: { database_id: COMMERCIAL_SNAPSHOT_DB },
            properties
        });

        res.json({ success: true, id: response.id, url: response.url });
    } catch (error) {
        console.error('Error creating snapshot item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PATCH /commercial-snapshot/:id - Update snapshot item
app.patch('/commercial-snapshot/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { section, statusTag, headline, details, links, snapshotDate, projectId } = req.body;

        const properties = {};

        if (headline !== undefined) {
            properties['Headline'] = { title: [{ text: { content: headline } }] };
        }
        if (section !== undefined) {
            properties['Section'] = { select: { name: section } };
        }
        if (statusTag !== undefined) {
            properties['Status Tag'] = statusTag ? { select: { name: statusTag } } : { select: null };
        }
        if (details !== undefined) {
            properties['Details'] = { rich_text: details ? [{ text: { content: details } }] : [] };
        }
        if (links !== undefined) {
            properties['Links'] = { rich_text: links ? [{ text: { content: links } }] : [] };
        }
        if (snapshotDate !== undefined) {
            properties['Snapshot Date'] = { date: { start: snapshotDate } };
        }
        if (projectId !== undefined) {
            properties['Project'] = projectId ? { relation: [{ id: projectId }] } : { relation: [] };
        }

        await notion.pages.update({
            page_id: id,
            properties
        });

        res.json({ success: true, id });
    } catch (error) {
        console.error('Error updating snapshot item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /commercial-snapshot/:id - Archive snapshot item
app.delete('/commercial-snapshot/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await notion.pages.update({
            page_id: id,
            archived: true
        });

        res.json({ success: true, id });
    } catch (error) {
        console.error('Error deleting snapshot item:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /commercial-snapshot/carry-over - Copy items from source date to target date
app.post('/commercial-snapshot/carry-over', async (req, res) => {
    try {
        if (!COMMERCIAL_SNAPSHOT_DB) {
            return res.status(400).json({ success: false, error: 'Commercial Snapshot DB not configured' });
        }

        const today = new Date().toISOString().split('T')[0];
        const { fromDate, toDate = today } = req.body;

        // Default: carry over from yesterday
        const sourceDate = fromDate || (() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        })();

        // Get items from source date
        const sourceItems = await notion.databases.query({
            database_id: COMMERCIAL_SNAPSHOT_DB,
            filter: {
                property: 'Snapshot Date',
                date: { equals: sourceDate }
            }
        });

        if (sourceItems.results.length === 0) {
            return res.json({ success: true, message: `No items found for ${sourceDate}`, itemsCopied: 0 });
        }

        // Check what already exists on target date
        const existingItems = await notion.databases.query({
            database_id: COMMERCIAL_SNAPSHOT_DB,
            filter: {
                property: 'Snapshot Date',
                date: { equals: toDate }
            }
        });

        const existingHeadlines = new Set(
            existingItems.results.map(p => parseProperty(p.properties['Headline']))
        );

        let itemsCopied = 0;
        const errors = [];

        for (const page of sourceItems.results) {
            const props = page.properties;
            const headline = parseProperty(props['Headline']);

            // Skip if already exists
            if (existingHeadlines.has(headline)) {
                continue;
            }

            try {
                const newProps = {
                    'Headline': { title: [{ text: { content: headline || 'Untitled' } }] },
                    'Snapshot Date': { date: { start: toDate } }
                };

                const section = parseProperty(props['Section']);
                if (section) newProps['Section'] = { select: { name: section } };

                const statusTag = parseProperty(props['Status Tag']);
                if (statusTag) newProps['Status Tag'] = { select: { name: statusTag } };

                const details = parseProperty(props['Details']);
                if (details) newProps['Details'] = { rich_text: [{ text: { content: details } }] };

                const links = parseProperty(props['Links']);
                if (links) newProps['Links'] = { rich_text: [{ text: { content: links } }] };

                const projectIds = parseProperty(props['Project']);
                if (projectIds && projectIds.length > 0) {
                    newProps['Project'] = { relation: projectIds.map(id => ({ id })) };
                }

                await notion.pages.create({
                    parent: { database_id: COMMERCIAL_SNAPSHOT_DB },
                    properties: newProps
                });

                itemsCopied++;
            } catch (err) {
                errors.push({ headline, error: err.message });
            }
        }

        res.json({
            success: true,
            fromDate: sourceDate,
            toDate,
            itemsCopied,
            itemsSkipped: sourceItems.results.length - itemsCopied - errors.length,
            errors
        });
    } catch (error) {
        console.error('Error carrying over items:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /commercial-snapshot/projects - Get list of projects for dropdown
app.get('/commercial-snapshot/projects', async (req, res) => {
    try {
        if (!PROJECTS_DB) {
            return res.status(400).json({ success: false, error: 'Projects DB not configured' });
        }

        // Get recent/active projects for the dropdown
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            filter: {
                or: [
                    { property: 'STATUS 1', select: { equals: 'Active' } },
                    { property: 'STATUS 1', select: { equals: 'Pipeline' } }
                ]
            },
            sorts: [{ property: 'NAME', direction: 'ascending' }],
            page_size: 100
        });

        const projects = response.results.map(page => ({
            id: page.id,
            name: parseProperty(page.properties['NAME']),
            client: parseProperty(page.properties['CLIENT / EXTERNAL PARTNER']),
            status: parseProperty(page.properties['STATUS 1'])
        }));

        res.json({ success: true, projects });
    } catch (error) {
        console.error('Error fetching projects:', error);
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
            events: EVENTS_DB ? 'configured' : 'missing',
            commercialSnapshot: COMMERCIAL_SNAPSHOT_DB ? 'configured' : 'missing'
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
            'PATCH /events/:id',
            'POST /process-deal-agreed',
            'GET /process-deal-agreed/status',
            'POST /process-deal-agreed/reset',
            'POST /process-daily-rundown',
            'POST /process-events-to-ledger',
            'POST /process-ledger-to-events',
            'GET /daily-rundown?date=YYYY-MM-DD',
            'POST /commercial-snapshot',
            'PATCH /commercial-snapshot/:id',
            'DELETE /commercial-snapshot/:id',
            'POST /commercial-snapshot/carry-over',
            'GET /commercial-snapshot/projects'
        ]
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
