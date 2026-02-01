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

    // Daily rundown control fields (user-editable in Notion)
    snapshotDate: string | null;
    weekCommencing: string | null;
    section: string | null;
    itemType: string | null;
    headline: string | null;
    details: string | null;
    links: string | null;
    slackMentions: string | null;
    statusTag: 'Green' | 'Yellow' | 'Red' | 'Info' | null;
    rawSnapshotBlock: string | null;

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

// Daily Rundown types - for the ViewOnlyApp widget
export interface DailyRundownSection {
    id: string;
    notionSection: string;
    title: string;
    tone: string;
    order: number;
    items: CommercialSnapshotProject[];
}

export interface DailyRundownResponse {
    success: boolean;
    date: string;
    sections: DailyRundownSection[];
    totals: {
        total: number;
        bySection: Record<string, number>;
        byStatusTag: Record<string, number>;
    };
    itemCount: number;
    sectionCount: number;
    lastFetched: string;
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
    dealStages: ['Brief Received', 'In Progress', 'Pitch Sent', 'Deal Agreed', 'Campaign Complete', 'Closed Lost'],
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

// Legacy sections config (for backward compatibility with Firestore data)
export const SECTIONS_CONFIG = [
    { id: 'completed', title: 'COMPLETED CREATIVE RESPONSES' },
    { id: 'pending', title: 'PENDING / IN PROGRESS CREATIVE RESPONSES' },
    { id: 'live', title: 'LIVE / ACTIVE PROJECTS' },
    { id: 'media', title: 'NEW MEDIA VENTURES' },
    { id: 'partnerships', title: 'PROSPECTIVE & STRATEGIC PARTNERSHIPS' },
    { id: 'internal', title: 'INTERNAL / WORKFLOW' },
    { id: 'coming_up', title: 'COMING UP' }
];

// New section config matching Commercial Snapshot database
export const NOTION_SECTIONS_CONFIG = {
    '✅ Completed – Creative Responses (Last Week)': { id: 'completed_last_week', order: 1, title: 'Completed – Last Week', tone: 'sky' },
    '✅ Completed – Creative Responses (This Week)': { id: 'completed_this_week', order: 2, title: 'Completed – This Week', tone: 'sky' },
    '🆕 New Briefs in Progress': { id: 'new_briefs', order: 3, title: 'New Briefs in Progress', tone: 'amber' },
    '🟡 Active / In Production Projects': { id: 'active', order: 4, title: 'Active / In Production', tone: 'emerald' },
    '🧠 New Media Ventures': { id: 'ventures', order: 5, title: 'New Media Ventures', tone: 'purple' },
    '🧠 Prospective & Strategic Partnerships': { id: 'partnerships', order: 6, title: 'Prospective & Strategic Partnerships', tone: 'rose' },
    '🛠 Internal / Workflow': { id: 'internal', order: 7, title: 'Internal / Workflow', tone: 'gray' },
    '👋 Coming Up': { id: 'coming_up', order: 8, title: 'Coming Up', tone: 'indigo' },
    'Other': { id: 'other', order: 9, title: 'Other', tone: 'slate' }
} as const;

// Status tag colors for traffic-light indicators
export const STATUS_TAG_COLORS = {
    Green: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
    Yellow: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    Red: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
    Info: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' }
} as const;