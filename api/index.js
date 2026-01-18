const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Database IDs from environment
const PROJECTS_DB = process.env.NOTION_PROJECTS_DB;
const DELIVERABLES_DB = process.env.NOTION_DELIVERABLES_DB;

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

    // Title (required for create, optional for update)
    if (data.title) {
        props['TITLE'] = { title: [{ text: { content: data.title } }] };
    }

    // Rich text fields
    if (data.cardSummary !== undefined) {
        props['CARD SUMMARY'] = { rich_text: data.cardSummary ? [{ text: { content: data.cardSummary } }] : [] };
    }
    if (data.notes !== undefined) {
        props['(INTERNAL) NOTES'] = { rich_text: data.notes ? [{ text: { content: data.notes } }] : [] };
    }
    if (data.salesNotes !== undefined) {
        props['SALES NOTES'] = { rich_text: data.salesNotes ? [{ text: { content: data.salesNotes } }] : [] };
    }

    // Select fields - use !== undefined to allow clearing
    if (data.client !== undefined) {
        props['CLIENT / EXTERNAL PARTNER'] = data.client ? { select: { name: data.client } } : { select: null };
    }
    if (data.projectType !== undefined) {
        props['PROJECT TYPE'] = data.projectType ? { select: { name: data.projectType } } : { select: null };
    }
    if (data.priority !== undefined) {
        props['PRIORITY'] = data.priority ? { select: { name: data.priority } } : { select: null };
    }
    if (data.vertical !== undefined) {
        props['VERTICAL'] = data.vertical ? { select: { name: data.vertical } } : { select: null };
    }
    if (data.ownerRole !== undefined) {
        props['OWNER ROLE'] = data.ownerRole ? { select: { name: data.ownerRole } } : { select: null };
    }
    if (data.deskState !== undefined) {
        props['DESK STATE'] = data.deskState ? { select: { name: data.deskState } } : { select: null };
    }
    if (data.dealStage !== undefined) {
        props['DEAL STAGE'] = data.dealStage ? { select: { name: data.dealStage } } : { select: null };
    }
    if (data.responseTypeNeeded !== undefined) {
        props['RESPONSE TYPE NEEDED'] = data.responseTypeNeeded ? { select: { name: data.responseTypeNeeded } } : { select: null };
    }
    if (data.probability !== undefined) {
        props['PROBABILITY'] = data.probability ? { select: { name: data.probability } } : { select: null };
    }

    // Status/Select fields (workflow)
    if (data.creativeWorkflowStatus !== undefined) {
        props['CREATIVE WORKFLOW STATUS'] = buildStatusProperty(
            data.creativeWorkflowStatus,
            propertyTypes['CREATIVE WORKFLOW STATUS']
        );
    }
    if (data.productionWorkflowStatus !== undefined) {
        props['PRODUCTION WORKFLOW STATUS'] = buildStatusProperty(
            data.productionWorkflowStatus,
            propertyTypes['PRODUCTION WORKFLOW STATUS']
        );
    }
    if (data.socialWorkflowStatus !== undefined) {
        props['SOCIAL WORKFLOW STATUS'] = buildStatusProperty(
            data.socialWorkflowStatus,
            propertyTypes['SOCIAL WORKFLOW STATUS']
        );
    }

    // Multi-select fields
    if (data.primaryTeam && Array.isArray(data.primaryTeam)) {
        props['PRIMARY TEAM'] = { multi_select: data.primaryTeam.map(t => ({ name: t })) };
    }
    if (data.assetsNeeded && Array.isArray(data.assetsNeeded)) {
        props['ASSET(S) NEEDED'] = { multi_select: data.assetsNeeded.map(a => ({ name: a })) };
    }

    // Date fields
    if (data.dueDate !== undefined) {
        props['(INTERNAL) DUE DATE'] = { date: data.dueDate ? { start: data.dueDate } : null };
    }
    if (data.clientDueDate !== undefined) {
        props['CLIENT DUE DATE'] = { date: data.clientDueDate ? { start: data.clientDueDate } : null };
    }
    if (data.expectedCloseDate !== undefined) {
        props['EXPECTED CLOSE DATE'] = { date: data.expectedCloseDate ? { start: data.expectedCloseDate } : null };
    }
    if (data.suggestedCampaignWindow !== undefined) {
        props['SUGGESTED CAMPAIGN WINDOW'] = { date: data.suggestedCampaignWindow ? { start: data.suggestedCampaignWindow } : null };
    }

    // Number fields
    if (data.dealValue !== undefined) {
        props['DEAL VALUE'] = { number: data.dealValue };
    }
    if (data.effortScore !== undefined) {
        props['EFFORT SCORE'] = { number: data.effortScore };
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

    // People fields (require Notion user IDs)
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
                title: parseProperty(props['TITLE']),
                client: parseProperty(props['CLIENT / EXTERNAL PARTNER']),
                projectType: parseProperty(props['PROJECT TYPE']),
                priority: parseProperty(props['PRIORITY']),
                vertical: parseProperty(props['VERTICAL']),
                dealStage: parseProperty(props['DEAL STAGE']),
                dealValue: parseProperty(props['DEAL VALUE']),
                probability: parseProperty(props['PROBABILITY']),
                dueDate: parseProperty(props['(INTERNAL) DUE DATE']),
                clientDueDate: parseProperty(props['CLIENT DUE DATE']),
                expectedCloseDate: parseProperty(props['EXPECTED CLOSE DATE']),
                suggestedCampaignWindow: parseProperty(props['SUGGESTED CAMPAIGN WINDOW']),
                creativeWorkflowStatus: parseProperty(props['CREATIVE WORKFLOW STATUS']),
                productionWorkflowStatus: parseProperty(props['PRODUCTION WORKFLOW STATUS']),
                socialWorkflowStatus: parseProperty(props['SOCIAL WORKFLOW STATUS']),
                deskState: parseProperty(props['DESK STATE']),
                ownerRole: parseProperty(props['OWNER ROLE']),
                primaryTeam: parseProperty(props['PRIMARY TEAM']),
                assetsNeeded: parseProperty(props['ASSET(S) NEEDED']),
                effortScore: parseProperty(props['EFFORT SCORE']),
                cardSummary: parseProperty(props['CARD SUMMARY']),
                notes: parseProperty(props['(INTERNAL) NOTES']),
                salesNotes: parseProperty(props['SALES NOTES']),
                // URL fields
                briefLink: parseProperty(props['BRIEF LINK']),
                creativeResponseLink: parseProperty(props['CREATIVE RESPONSE LINK']),
                frameIoLink: parseProperty(props['FRAME.IO LINK']),
                driveFolder: parseProperty(props['DRIVE FOLDER']),
                responseTypeNeeded: parseProperty(props['RESPONSE TYPE NEEDED']),
                // People
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

        // Log incoming request for debugging
        console.log(`PATCH /projects/${id}`);
        console.log('Request body:', JSON.stringify(req.body, null, 2));

        const properties = await buildProjectProperties(req.body);

        console.log('Built Notion properties:', JSON.stringify(properties, null, 2));

        if (Object.keys(properties).length === 0) {
            console.log('No valid properties found to update');
            return res.status(400).json({
                success: false,
                error: 'No valid properties to update',
                receivedFields: Object.keys(req.body)
            });
        }

        const response = await notion.pages.update({
            page_id: id,
            properties
        });

        console.log('Notion update successful for page:', id);

        res.json({
            success: true,
            message: 'Project updated',
            updatedFields: Object.keys(properties)
        });
    } catch (error) {
        console.error('Error updating project:', error);
        console.error('Project ID:', req.params.id);
        console.error('Request body:', req.body);
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.code || 'UNKNOWN'
        });
    }
});

// ============================================
// POST /projects - Create a new project
// ============================================
app.post('/projects', async (req, res) => {
    try {
        const properties = await buildProjectProperties(req.body);
        
        if (!properties['TITLE']) {
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

// Health check
app.get('/', (req, res) => {
    const { version } = require('./package.json');
    res.json({ 
        status: 'ok', 
        version,
        databases: {
            projects: PROJECTS_DB ? 'configured' : 'missing',
            deliverables: DELIVERABLES_DB ? 'configured' : 'missing'
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
            'GET /capacity'
        ]
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
