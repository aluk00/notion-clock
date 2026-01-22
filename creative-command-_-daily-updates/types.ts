export interface Project {
    id: string;
    name: string;
    client?: string;
}

// Commercial Snapshot types - read-only view of projects for dashboards
export interface CommercialSnapshotProject {
    id: string;
    url: string;
    lastEditedTime: string;

    // Core identity
    record: string;
    projectIds: string[];

    // Project metadata (rollups from master Project)
    projectName: string | null;
    clientPartner: string | null;
    vertical: string | null;
    salesLeads: { id: string; name: string }[];
    cardSummary: string | null;
    aiStatusRecap: string | null;

    // Status and workflow
    status1: string | null;
    status: string | null;
    creativeWorkflowStatus: string | null;
    productionWorkflowStatus: string | null;
    projectOutcome: string | null;
    priorityLevel: string | null;
    totalProjectEffort: number | null;

    // Commercial info
    dealStage: string | null;
    dealValue: number | null;

    // Timeline and delivery
    clientProjectDueDate: string | null;
    internalProjectDueDate: string | null;
    earliestDeliverableDue: string | null;
    latestDeliverableDue: string | null;

    // Live campaign
    liveLink: string | null;

    // Slack integration
    slackChannelName: string | null;
    slackChannelId: string | null;
}

// Grouped view for dashboard display
export interface ProjectsByStatus {
    active: CommercialSnapshotProject[];
    inProgress: CommercialSnapshotProject[];
    completed: CommercialSnapshotProject[];
    pipeline: CommercialSnapshotProject[];
}

// Status configuration for Commercial Snapshot widget
export const COMMERCIAL_STATUS_CONFIG = {
    dealStages: ['Prospecting', 'Proposal', 'Contracting', 'Won', 'Lost', 'Campaign Complete'],
    workflowStatuses: ['Briefing', 'Concepting', 'In Production', 'Review', 'Approved', 'Live'],
    priorityLevels: ['High', 'Medium', 'Low'],
    outcomes: ['Won', 'Lost', 'Cancelled', 'On Hold']
};

export interface BulletPoint {
    id: string;
    text: string;
}

export interface UpdateItem {
    id: string;
    projectId: string; // Could be a notion ID or custom text
    projectName: string;
    statusNote: string; // e.g., "Creative Response (Google Doc)"
    link: string;
    bullets: BulletPoint[];
}

export interface SectionData {
    id: string;
    title: string;
    items: UpdateItem[];
}

export interface RundownData {
    id?: string;
    date: string;
    timestamp: any;
    sections: SectionData[];
}

export const SECTIONS_CONFIG = [
    { id: 'completed', title: 'COMPLETED CREATIVE RESPONSES' },
    { id: 'pending', title: 'PENDING / IN PROGRESS CREATIVE RESPONSES' },
    { id: 'live', title: 'LIVE / ACTIVE PROJECTS' },
    { id: 'media', title: 'NEW MEDIA VENTURES' },
    { id: 'partnerships', title: 'PROSPECTIVE & STRATEGIC PARTNERSHIPS' },
    { id: 'internal', title: 'INTERNAL / WORKFLOW' },
    { id: 'coming_up', title: 'COMING UP' }
];