export interface Project {
    id: string;
    name: string;
    client?: string;
}

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