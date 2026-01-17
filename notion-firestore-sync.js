#!/usr/bin/env node

/**
 * Notion to Firestore Sync Script
 * 
 * This script syncs data from Notion databases to Firestore collections.
 * It's designed to run as a scheduled job (e.g., via cron or Cloud Scheduler).
 * 
 * Environment Variables Required:
 * - NOTION_API_KEY: Notion integration token
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to Firebase service account JSON
 * - NOTION_STAFF_DB_ID: Notion database ID for staff directory (legacy)
 * - NOTION_STAFF_DIR_DB: Notion database ID for staff directory (new)
 * - NOTION_PROJECTS_DB_ID: Notion database ID for projects (legacy, optional)
 * - NOTION_MASTER_PROJECTS_DB: Notion database ID for master projects ledger (new)
 * - APP_ID: Application ID (default: dmg-command-centre-native)
 * - FIREBASE_PROJECT_ID: Firebase project ID (default: dmg-command-centre-native)
 * 
 * Usage:
 *   node notion-firestore-sync.js
 *   node notion-firestore-sync.js --collection=staff_directory
 *   node notion-firestore-sync.js --dry-run
 */

const { Client } = require('@notionhq/client');
const admin = require('firebase-admin');

// Configuration
const APP_ID = process.env.APP_ID || 'dmg-command-centre-native';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'dmg-command-centre-native';
const BASE_PATH = `artifacts/${APP_ID}/public/data`;

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: FIREBASE_PROJECT_ID
    });
}

const db = admin.firestore();

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const collectionArg = args.find(arg => arg.startsWith('--collection='));
const targetCollection = collectionArg ? collectionArg.split('=')[1] : null;

/**
 * Sync staff directory from Notion to Firestore
 */
async function syncStaffDirectory() {
    console.log('📋 Syncing Staff Directory...');
    
    const databaseId = process.env.NOTION_STAFF_DIR_DB || process.env.NOTION_STAFF_DB_ID;
    if (!databaseId) {
        console.error('❌ NOTION_STAFF_DIR_DB or NOTION_STAFF_DB_ID not set');
        return;
    }

    try {
        // Query Notion database
        const response = await notion.databases.query({
            database_id: databaseId,
            filter: {
                property: 'STATUS',
                select: { equals: 'Active' }
            }
        });

        console.log(`Found ${response.results.length} active staff members`);

        const batch = db.batch();
        let updateCount = 0;

        for (const page of response.results) {
            const props = page.properties;
            
            // Extract staff data from Notion properties
            const staffData = {
                firstName: getTextProperty(props['FIRST NAME']),
                lastName: getTextProperty(props['LAST NAME']),
                email: getFormulaStringProperty(props['EMAIL']),
                team: getSelectProperty(props['TEAM']),
                role: getSelectProperty(props['ROLE']),
                seniority: getSelectProperty(props['SENIORITY']),
                status: getSelectProperty(props['STATUS']),
                maxHoursPerWeek: getNumberProperty(props['MAX HOURS PER WEEK']),
                weeklyCapacityPTS: getNumberProperty(props['MAX HOURS PER WEEK']),
                managerName: getFormulaStringProperty(props['MANAGER NAME (API)']),
                isManager: getCheckboxProperty(props['IS MANAGER']),
                isEditor: getCheckboxProperty(props['IS EDITOR']),
                isCreator: getCheckboxProperty(props['IS CREATOR']),
                isProducer: getCheckboxProperty(props['IS PRODUCER']),
                employmentType: getSelectProperty(props['EMPLOYMENT TYPE']),
                notionPageId: page.id,
                lastSynced: admin.firestore.FieldValue.serverTimestamp()
            };

            // Skip if no email (required field)
            if (!staffData.email) {
                console.warn(`⚠️  Skipping entry without email: ${staffData.firstName} ${staffData.lastName}`);
                continue;
            }

            // Generate document ID from email with hash to prevent collisions
            const crypto = require('crypto');
            const emailLocal = staffData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
            const emailHash = crypto.createHash('md5').update(staffData.email).digest('hex').substring(0, 8);
            const docId = `${emailLocal}_${emailHash}`;

            if (dryRun) {
                console.log(`[DRY RUN] Would update: ${docId}`, staffData);
            } else {
                const docRef = db.collection(BASE_PATH).doc('staff_directory')
                    .collection('staff_directory').doc(docId);
                batch.set(docRef, staffData, { merge: true });
                updateCount++;
            }
        }

        if (!dryRun && updateCount > 0) {
            await batch.commit();
            console.log(`✅ Successfully synced ${updateCount} staff members`);
        } else if (dryRun) {
            console.log(`[DRY RUN] Would sync ${updateCount} staff members`);
        }

    } catch (error) {
        console.error('❌ Error syncing staff directory:', error.message);
        throw error;
    }
}

/**
 * Sync projects from Notion to Firestore
 */
async function syncProjects() {
    console.log('📋 Syncing Projects...');
    
    const databaseId = process.env.NOTION_MASTER_PROJECTS_DB || process.env.NOTION_PROJECTS_DB_ID;
    if (!databaseId) {
        console.log('ℹ️  NOTION_MASTER_PROJECTS_DB or NOTION_PROJECTS_DB_ID not set, skipping projects sync');
        return;
    }

    try {
        // Query Notion database
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [
                {
                    property: 'DUE DATE',
                    direction: 'ascending'
                }
            ]
        });

        console.log(`Found ${response.results.length} projects`);

        const batch = db.batch();
        let updateCount = 0;

        for (const page of response.results) {
            const props = page.properties;
            
            const assignedTo = await getRelationNames(props['ASSIGNED TO']);
            const creativeLeads = await getRelationNames(props['CREATIVE LEAD(S)']);
            const productionLeads = await getRelationNames(props['PRODUCTION LEAD(S)']);
            const socialLeads = await getRelationNames(props['SOCIAL LEAD(S)']);

            const projectData = {
                name: getTitleProperty(props['NAME']) || getTextProperty(props['NAME']),
                client: getTextProperty(props['CLIENT / EXTERNAL PARTNER']),
                status: getSelectProperty(props['STATUS 1']) || getSelectProperty(props['STATUS']) || getSelectProperty(props['PROJECT STATUS']),
                dealStage: getSelectProperty(props['DEAL STAGE']),
                priority: getSelectProperty(props['PRIORITY LEVEL']),
                dueDate: getDateProperty(props['DUE DATE']),
                internalDueDate: getDateProperty(props['(INTERNAL) PROJECT DUE DATE']),
                team: getSelectProperty(props['TEAM']),
                assignee: assignedTo[0] || null,
                assignedTo: assignedTo,
                creativeLead: creativeLeads,
                productionLead: productionLeads,
                socialLead: socialLeads,
                projectType: getSelectProperty(props['PROJECT TYPE']),
                discipline: getSelectProperty(props['DISCIPLINE']),
                effortPTS: getNumberProperty(props['EFFORT SCORE']) || getFormulaNumberProperty(props['EFFORT (PTS)']),
                totalProjectEffortPTS: getNumberProperty(props['Total Project Effort (PTS)']) || getNumberProperty(props['TOTAL PROJECT EFFORT (PTS)']),
                notionPageId: page.id,
                notionUrl: page.url,
                lastSynced: admin.firestore.FieldValue.serverTimestamp()
            };

            if (!projectData.name) {
                console.warn('⚠️  Skipping project without name');
                continue;
            }

            const docId = page.id;

            if (dryRun) {
                console.log(`[DRY RUN] Would update: ${docId}`, projectData);
            } else {
                const docRef = db.collection(BASE_PATH).doc('projects')
                    .collection('projects').doc(docId);
                batch.set(docRef, projectData, { merge: true });
                updateCount++;
            }
        }

        if (!dryRun && updateCount > 0) {
            await batch.commit();
            console.log(`✅ Successfully synced ${updateCount} projects`);
        } else if (dryRun) {
            console.log(`[DRY RUN] Would sync ${updateCount} projects`);
        }

    } catch (error) {
        console.error('❌ Error syncing projects:', error.message);
        throw error;
    }
}

/**
 * Helper functions to extract data from Notion properties
 */
function getTitleProperty(prop) {
    if (!prop || prop.type !== 'title') return null;
    return prop.title[0]?.plain_text || null;
}

function getTextProperty(prop) {
    if (!prop) return null;
    if (prop.type === 'rich_text') {
        return prop.rich_text[0]?.plain_text || null;
    }
    if (prop.type === 'title') {
        return prop.title[0]?.plain_text || null;
    }
    return null;
}

function getEmailProperty(prop) {
    if (!prop || prop.type !== 'email') return null;
    return prop.email;
}

function getSelectProperty(prop) {
    if (!prop || prop.type !== 'select') return null;
    return prop.select?.name || null;
}

function getDateProperty(prop) {
    if (!prop || prop.type !== 'date') return null;
    return prop.date?.start || null;
}

function getNumberProperty(prop) {
    if (!prop || prop.type !== 'number') return null;
    return prop.number;
}

function getCheckboxProperty(prop) {
    if (!prop || prop.type !== 'checkbox') return false;
    return prop.checkbox;
}

function getFormulaStringProperty(prop) {
    if (!prop || prop.type !== 'formula') return null;
    if (prop.formula.type === 'string') return prop.formula.string || null;
    if (prop.formula.type === 'number') return prop.formula.number?.toString() || null;
    return null;
}

function getFormulaNumberProperty(prop) {
    if (!prop || prop.type !== 'formula') return null;
    if (prop.formula.type === 'number') return prop.formula.number;
    return null;
}

const relationNameCache = new Map();

async function getRelationNames(prop) {
    if (!prop || prop.type !== 'relation') return [];
    const ids = prop.relation?.map(rel => rel.id) || [];
    const names = [];

    for (const id of ids) {
        if (relationNameCache.has(id)) {
            names.push(relationNameCache.get(id));
            continue;
        }
        try {
            const page = await notion.pages.retrieve({ page_id: id });
            const titleProp = Object.values(page.properties || {}).find(p => p.type === 'title');
            const name = getTitleProperty(titleProp) || 'Untitled';
            relationNameCache.set(id, name);
            names.push(name);
        } catch (error) {
            console.warn(`⚠️  Failed to fetch related page ${id}: ${error.message}`);
        }
    }

    return names;
}

/**
 * Main sync function
 */
async function main() {
    console.log('🚀 Starting Notion → Firestore Sync');
    console.log(`📁 Target: ${BASE_PATH}`);
    console.log(`🔧 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    
    if (targetCollection) {
        console.log(`🎯 Target Collection: ${targetCollection}`);
    }

    try {
        // Sync based on target collection or all
        if (!targetCollection || targetCollection === 'staff_directory') {
            await syncStaffDirectory();
        }

        if (!targetCollection || targetCollection === 'projects') {
            await syncProjects();
        }

        console.log('✅ Sync completed successfully');
        process.exit(0);

    } catch (error) {
        console.error('❌ Sync failed:', error);
        process.exit(1);
    }
}

// Run the sync
if (require.main === module) {
    main();
}

module.exports = {
    syncStaffDirectory,
    syncProjects
};
