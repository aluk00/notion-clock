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
const COMMERCIAL_SNAPSHOT_DB = process.env.NOTION_COMMERCIAL_SNAPSHOT;

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
        case 'rollup': return parseRollupProperty(prop.rollup);
        default: return null;
    }
}

// Enhanced rollup parser to handle nested types
function parseRollupProperty(rollup) {
    if (!rollup) return null;

    const rollupType = rollup.type;
    const value = rollup[rollupType];

    // Handle array rollups (most common)
    if (rollupType === 'array' && Array.isArray(value)) {
        return value.map(item => {
            if (!item) return null;
            switch (item.type) {
                case 'title': return item.title?.[0]?.plain_text || '';
                case 'rich_text': return item.rich_text?.[0]?.plain_text || '';
                case 'select': return item.select?.name || null;
                case 'status': return item.status?.name || null;
                case 'date': return item.date?.start || null;
                case 'number': return item.number;
                case 'url': return item.url || null;
                case 'people': return item.people?.map(p => ({ id: p.id, name: p.name })) || [];
                default: return item[item.type] || null;
            }
        }).filter(Boolean);
    }

    // Handle single value rollups (number, date)
    return value;
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
        props['(CLIENT) PROJECT DUE DATE'] = { date: data.clientDueDate ? { start: data.clientDueDate } : null };
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
    // Budget fields (new Master Ledger fields)
    if (data.projectBudget !== undefined) {
        props['PROJECT BUDGET'] = { number: data.projectBudget };
    }
    if (data.budget !== undefined) {
        props['BUDGET'] = { number: data.budget };
    }
    if (data.actualSpend !== undefined) {
        props['ACTUAL SPEND'] = { number: data.actualSpend };
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
// GET /projects - List all Layer 1 projects (PARENT ITEM is empty)
// ============================================
app.get('/projects', async (req, res) => {
    try {
        // Filter for Layer 1 projects only (items without a PARENT ITEM)
        // This excludes Layer 2 (Episodes) and Layer 3 (Tasks) which have PARENT ITEM set
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            page_size: 100,
            filter: {
                property: 'PARENT ITEM',
                relation: {
                    is_empty: true
                }
            }
        });

        const projects = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                url: page.url,
                title: parseProperty(props['NAME']) || parseProperty(props['TITLE']),
                client: parseProperty(props['CLIENT / EXTERNAL PARTNER']),
                projectType: parseProperty(props['PROJECT TYPE']),
                priority: parseProperty(props['PRIORITY']),
                vertical: parseProperty(props['VERTICAL']),
                dealStage: parseProperty(props['DEAL STAGE']),
                dealValue: parseProperty(props['DEAL VALUE']),
                probability: parseProperty(props['PROBABILITY']),
                dueDate: parseProperty(props['(INTERNAL) DUE DATE']),
                clientDueDate: parseProperty(props['(CLIENT) PROJECT DUE DATE']) || parseProperty(props['CLIENT DUE DATE']),
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
                nextDeliverableDue: parseProperty(props['NEXT DELIVERABLE DUE']),
                // Budget fields (Master Ledger)
                projectBudget: parseProperty(props['PROJECT BUDGET']),
                budget: parseProperty(props['BUDGET']),
                actualSpend: parseProperty(props['ACTUAL SPEND']),
                // Budget rollups (from SUB-ITEM relation)
                totalSubItemBudget: parseProperty(props['TOTAL SUB-ITEM BUDGET']),
                totalActualSpend: parseProperty(props['TOTAL ACTUAL SPEND']),
                // Budget formulas
                budgetRemaining: parseProperty(props['BUDGET REMAINING']),
                budgetVsActual: parseProperty(props['BUDGET VS ACTUAL']),
                // Event budget rollups (from Events relation)
                eventShootBudget: parseProperty(props['EVENT SHOOT BUDGET']),
                eventShootActual: parseProperty(props['EVENT SHOOT ACTUAL']),
                totalDeliverableBudget: parseProperty(props['TOTAL DELIVERABLE BUDGET']),
                // Events relation
                eventsRelation: parseProperty(props['Events'])
            };
        });

        res.json({ success: true, projects, count: projects.length });
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /projects/:id - Get single project by ID
// Works for any layer (Project, Episode, or Task)
// ============================================
app.get('/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch the page directly from Notion
        const page = await notion.pages.retrieve({ page_id: id });

        if (!page || page.archived) {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }

        const props = page.properties;

        // Parse the project data (same as in /projects list)
        const project = {
            id: page.id,
            url: page.url,
            title: parseProperty(props['NAME']) || parseProperty(props['TITLE']),
            client: parseProperty(props['CLIENT / EXTERNAL PARTNER']),
            projectType: parseProperty(props['PROJECT TYPE']),
            priority: parseProperty(props['PRIORITY']),
            vertical: parseProperty(props['VERTICAL']),
            dealStage: parseProperty(props['DEAL STAGE']),
            dealValue: parseProperty(props['DEAL VALUE']),
            probability: parseProperty(props['PROBABILITY']),
            dueDate: parseProperty(props['(INTERNAL) DUE DATE']),
            clientDueDate: parseProperty(props['(CLIENT) PROJECT DUE DATE']) || parseProperty(props['CLIENT DUE DATE']),
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
            nextDeliverableDue: parseProperty(props['NEXT DELIVERABLE DUE']),
            // Budget fields (Master Ledger)
            projectBudget: parseProperty(props['PROJECT BUDGET']),
            budget: parseProperty(props['BUDGET']),
            actualSpend: parseProperty(props['ACTUAL SPEND']),
            // Budget rollups (from SUB-ITEM relation)
            totalSubItemBudget: parseProperty(props['TOTAL SUB-ITEM BUDGET']),
            totalActualSpend: parseProperty(props['TOTAL ACTUAL SPEND']),
            // Budget formulas
            budgetRemaining: parseProperty(props['BUDGET REMAINING']),
            budgetVsActual: parseProperty(props['BUDGET VS ACTUAL']),
            // Event budget rollups (from Events relation)
            eventShootBudget: parseProperty(props['EVENT SHOOT BUDGET']),
            eventShootActual: parseProperty(props['EVENT SHOOT ACTUAL']),
            totalDeliverableBudget: parseProperty(props['TOTAL DELIVERABLE BUDGET']),
            // Events relation
            eventsRelation: parseProperty(props['Events']),
            // Parent relation (for Layer 2/3 items)
            parentItemIds: parseProperty(props['PARENT ITEM']),
            // Sub-items relation (for hierarchy)
            subItemIds: parseProperty(props['SUB-ITEM'])
        };

        res.json({ success: true, project });
    } catch (error) {
        console.error('Error fetching project by ID:', error);
        if (error.code === 'object_not_found') {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// GET /projects/:id/subitems - Get sub-items (children) for a project/episode
// Uses PARENT ITEM relation to find items whose parent is this ID
// ============================================
app.get('/projects/:id/subitems', async (req, res) => {
    try {
        const { id } = req.params;

        // Query items where PARENT ITEM contains this ID
        const response = await notion.databases.query({
            database_id: PROJECTS_DB,
            page_size: 100,
            filter: {
                property: 'PARENT ITEM',
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
                title: parseProperty(props['NAME']) || parseProperty(props['TITLE']),
                client: parseProperty(props['CLIENT / EXTERNAL PARTNER']),
                projectType: parseProperty(props['PROJECT TYPE']),
                status: parseProperty(props['STATUS']),
                status1: parseProperty(props['STATUS 1']),
                dueDate: parseProperty(props['DUE DATE']) || parseProperty(props['(INTERNAL) DUE DATE']),
                discipline: parseProperty(props['DISCIPLINE']),
                format: parseProperty(props['FORMAT']),
                channel: parseProperty(props['CHANNEL']),
                effortScore: parseProperty(props['EFFORT SCORE']),
                effortPts: parseProperty(props['EFFORT (PTS)']),
                creativeWorkflowStatus: parseProperty(props['CREATIVE WORKFLOW STATUS']),
                productionWorkflowStatus: parseProperty(props['PRODUCTION WORKFLOW STATUS']),
                feedbackStatus: parseProperty(props['FEEDBACK STATUS']),
                assignedTo: parseProperty(props['ASSIGNED TO 1']),
                // Check if this item has its own sub-items (for Layer 2 with Layer 3 children)
                hasSubItems: (parseProperty(props['SUB-ITEM']) || []).length > 0,
                subItemCount: (parseProperty(props['SUB-ITEM']) || []).length,
                parentItemIds: parseProperty(props['PARENT ITEM'])
            };
        });

        res.json({ success: true, subitems, count: subitems.length, parentId: id });
    } catch (error) {
        console.error('Error fetching sub-items:', error);
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

// ============================================
// COMMERCIAL SNAPSHOT ENDPOINTS
// Read-only view of projects for dashboards/APIs
// Data comes from rollups - updates go to master Projects DB
// ============================================

// GET /commercial-snapshot - List all projects from Commercial Snapshot
app.get('/commercial-snapshot', async (req, res) => {
    try {
        if (!COMMERCIAL_SNAPSHOT_DB) {
            return res.status(400).json({
                success: false,
                error: 'Commercial Snapshot DB not configured. Add NOTION_COMMERCIAL_SNAPSHOT env variable.'
            });
        }

        const response = await notion.databases.query({
            database_id: COMMERCIAL_SNAPSHOT_DB,
            page_size: 100
        });

        const projects = response.results.map(page => {
            const props = page.properties;

            // Helper to get first value from rollup array
            const getFirstRollup = (parsed) => {
                if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
                return parsed;
            };

            // Helper to flatten people arrays from rollups
            const getPeopleFromRollup = (parsed) => {
                if (Array.isArray(parsed)) {
                    return parsed.flat().filter(p => p && p.name);
                }
                return [];
            };

            return {
                id: page.id,
                url: page.url,
                lastEditedTime: page.last_edited_time,

                // Core identity
                record: parseProperty(props['Record']),
                projectIds: parseProperty(props['Project']),

                // Project metadata (rollups from Project)
                projectName: getFirstRollup(parseProperty(props['Project Name'])),
                clientPartner: getFirstRollup(parseProperty(props['Client / Partner'])),
                vertical: getFirstRollup(parseProperty(props['Vertical'])),
                salesLeads: getPeopleFromRollup(parseProperty(props['Sales Lead(s)'])),
                cardSummary: getFirstRollup(parseProperty(props['Card Summary'])),
                aiStatusRecap: getFirstRollup(parseProperty(props['AI Status Recap'])),

                // Status and workflow (rollups)
                status1: getFirstRollup(parseProperty(props['Status 1'])),
                status: getFirstRollup(parseProperty(props['Status'])),
                creativeWorkflowStatus: getFirstRollup(parseProperty(props['Creative Workflow Status'])),
                productionWorkflowStatus: getFirstRollup(parseProperty(props['Production Workflow Status'])),
                projectOutcome: getFirstRollup(parseProperty(props['Project Outcome'])),
                priorityLevel: getFirstRollup(parseProperty(props['Priority Level'])),
                totalProjectEffort: parseProperty(props['Total Project Effort (PTS)']),

                // Commercial info (rollups)
                dealStage: getFirstRollup(parseProperty(props['Deal Stage'])),
                dealValue: parseProperty(props['Deal Value']),

                // Timeline and delivery (rollups)
                clientProjectDueDate: getFirstRollup(parseProperty(props['Client Project Due Date'])),
                internalProjectDueDate: getFirstRollup(parseProperty(props['Internal Project Due Date'])),
                earliestDeliverableDue: parseProperty(props['Earliest Deliverable Due']),
                latestDeliverableDue: parseProperty(props['Latest Deliverable Due']),

                // Live campaign
                liveLink: getFirstRollup(parseProperty(props['Live Link'])),

                // Slack integration (rollups)
                slackChannelName: getFirstRollup(parseProperty(props['Slack Channel Name'])),
                slackChannelId: getFirstRollup(parseProperty(props['Slack Channel ID']))
            };
        });

        // Sort by project name for consistent ordering
        projects.sort((a, b) => {
            const nameA = a.projectName || a.record || '';
            const nameB = b.projectName || b.record || '';
            return nameA.localeCompare(nameB);
        });

        res.json({
            success: true,
            projects,
            count: projects.length,
            databaseId: COMMERCIAL_SNAPSHOT_DB
        });
    } catch (error) {
        console.error('Error fetching commercial snapshot:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /commercial-snapshot/:id - Get single project by ID
app.get('/commercial-snapshot/:id', async (req, res) => {
    try {
        if (!COMMERCIAL_SNAPSHOT_DB) {
            return res.status(400).json({ success: false, error: 'Commercial Snapshot DB not configured' });
        }

        const { id } = req.params;
        const page = await notion.pages.retrieve({ page_id: id });

        if (!page || page.archived) {
            return res.status(404).json({ success: false, error: 'Project not found in Commercial Snapshot' });
        }

        const props = page.properties;

        // Helper functions
        const getFirstRollup = (parsed) => {
            if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
            return parsed;
        };

        const getPeopleFromRollup = (parsed) => {
            if (Array.isArray(parsed)) {
                return parsed.flat().filter(p => p && p.name);
            }
            return [];
        };

        const project = {
            id: page.id,
            url: page.url,
            lastEditedTime: page.last_edited_time,

            record: parseProperty(props['Record']),
            projectIds: parseProperty(props['Project']),

            projectName: getFirstRollup(parseProperty(props['Project Name'])),
            clientPartner: getFirstRollup(parseProperty(props['Client / Partner'])),
            vertical: getFirstRollup(parseProperty(props['Vertical'])),
            salesLeads: getPeopleFromRollup(parseProperty(props['Sales Lead(s)'])),
            cardSummary: getFirstRollup(parseProperty(props['Card Summary'])),
            aiStatusRecap: getFirstRollup(parseProperty(props['AI Status Recap'])),

            status1: getFirstRollup(parseProperty(props['Status 1'])),
            status: getFirstRollup(parseProperty(props['Status'])),
            creativeWorkflowStatus: getFirstRollup(parseProperty(props['Creative Workflow Status'])),
            productionWorkflowStatus: getFirstRollup(parseProperty(props['Production Workflow Status'])),
            projectOutcome: getFirstRollup(parseProperty(props['Project Outcome'])),
            priorityLevel: getFirstRollup(parseProperty(props['Priority Level'])),
            totalProjectEffort: parseProperty(props['Total Project Effort (PTS)']),

            dealStage: getFirstRollup(parseProperty(props['Deal Stage'])),
            dealValue: parseProperty(props['Deal Value']),

            clientProjectDueDate: getFirstRollup(parseProperty(props['Client Project Due Date'])),
            internalProjectDueDate: getFirstRollup(parseProperty(props['Internal Project Due Date'])),
            earliestDeliverableDue: parseProperty(props['Earliest Deliverable Due']),
            latestDeliverableDue: parseProperty(props['Latest Deliverable Due']),

            liveLink: getFirstRollup(parseProperty(props['Live Link'])),

            slackChannelName: getFirstRollup(parseProperty(props['Slack Channel Name'])),
            slackChannelId: getFirstRollup(parseProperty(props['Slack Channel ID']))
        };

        res.json({ success: true, project });
    } catch (error) {
        console.error('Error fetching commercial snapshot project:', error);
        if (error.code === 'object_not_found') {
            return res.status(404).json({ success: false, error: 'Project not found' });
        }
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /commercial-snapshot/by-status/:status - Filter by workflow status
app.get('/commercial-snapshot/by-status/:status', async (req, res) => {
    try {
        if (!COMMERCIAL_SNAPSHOT_DB) {
            return res.status(400).json({ success: false, error: 'Commercial Snapshot DB not configured' });
        }

        const { status } = req.params;

        // Note: Filtering on rollup fields has limitations in Notion API
        // We fetch all and filter client-side for reliability
        const response = await notion.databases.query({
            database_id: COMMERCIAL_SNAPSHOT_DB,
            page_size: 100
        });

        const getFirstRollup = (parsed) => {
            if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
            return parsed;
        };

        const getPeopleFromRollup = (parsed) => {
            if (Array.isArray(parsed)) {
                return parsed.flat().filter(p => p && p.name);
            }
            return [];
        };

        const projects = response.results
            .map(page => {
                const props = page.properties;
                return {
                    id: page.id,
                    url: page.url,
                    lastEditedTime: page.last_edited_time,
                    record: parseProperty(props['Record']),
                    projectIds: parseProperty(props['Project']),
                    projectName: getFirstRollup(parseProperty(props['Project Name'])),
                    clientPartner: getFirstRollup(parseProperty(props['Client / Partner'])),
                    vertical: getFirstRollup(parseProperty(props['Vertical'])),
                    salesLeads: getPeopleFromRollup(parseProperty(props['Sales Lead(s)'])),
                    cardSummary: getFirstRollup(parseProperty(props['Card Summary'])),
                    aiStatusRecap: getFirstRollup(parseProperty(props['AI Status Recap'])),
                    status1: getFirstRollup(parseProperty(props['Status 1'])),
                    status: getFirstRollup(parseProperty(props['Status'])),
                    creativeWorkflowStatus: getFirstRollup(parseProperty(props['Creative Workflow Status'])),
                    productionWorkflowStatus: getFirstRollup(parseProperty(props['Production Workflow Status'])),
                    projectOutcome: getFirstRollup(parseProperty(props['Project Outcome'])),
                    priorityLevel: getFirstRollup(parseProperty(props['Priority Level'])),
                    totalProjectEffort: parseProperty(props['Total Project Effort (PTS)']),
                    dealStage: getFirstRollup(parseProperty(props['Deal Stage'])),
                    dealValue: parseProperty(props['Deal Value']),
                    clientProjectDueDate: getFirstRollup(parseProperty(props['Client Project Due Date'])),
                    internalProjectDueDate: getFirstRollup(parseProperty(props['Internal Project Due Date'])),
                    earliestDeliverableDue: parseProperty(props['Earliest Deliverable Due']),
                    latestDeliverableDue: parseProperty(props['Latest Deliverable Due']),
                    liveLink: getFirstRollup(parseProperty(props['Live Link'])),
                    slackChannelName: getFirstRollup(parseProperty(props['Slack Channel Name'])),
                    slackChannelId: getFirstRollup(parseProperty(props['Slack Channel ID']))
                };
            })
            .filter(p => {
                const statusLower = status.toLowerCase();
                return (
                    (p.status1 && p.status1.toLowerCase().includes(statusLower)) ||
                    (p.status && p.status.toLowerCase().includes(statusLower)) ||
                    (p.creativeWorkflowStatus && p.creativeWorkflowStatus.toLowerCase().includes(statusLower)) ||
                    (p.productionWorkflowStatus && p.productionWorkflowStatus.toLowerCase().includes(statusLower))
                );
            });

        res.json({
            success: true,
            projects,
            count: projects.length,
            filter: status
        });
    } catch (error) {
        console.error('Error filtering commercial snapshot:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// NOTE: To update project data, use PATCH /projects/:id endpoint
// Commercial Snapshot is a rollup view - source of truth is the Projects database
// The Commercial Snapshot row's Project relation contains the ID of the master project

// Health check
app.get('/', (req, res) => {
    const { version } = require('./package.json');
    res.json({
        status: 'ok',
        version,
        databases: {
            projects: PROJECTS_DB ? 'configured' : 'missing',
            deliverables: DELIVERABLES_DB ? 'configured' : 'missing',
            commercialSnapshot: COMMERCIAL_SNAPSHOT_DB ? 'configured' : 'missing'
        },
        endpoints: [
            'GET /projects',
            'GET /projects/:id',
            'GET /projects/:id/subitems',
            'PATCH /projects/:id',
            'POST /projects',
            'GET /deliverables',
            'GET /deliverables/project/:projectId',
            'POST /deliverables',
            'POST /deliverables/bulk',
            'PATCH /deliverables/:id',
            'GET /staff',
            'GET /capacity',
            'GET /commercial-snapshot',
            'GET /commercial-snapshot/:id',
            'GET /commercial-snapshot/by-status/:status'
        ]
    });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
