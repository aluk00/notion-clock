import { CommercialSnapshotProject, ProjectsByStatus } from '../types';

const API_BASE = "https://createnotionproject-223535956454.us-central1.run.app";

export interface CommercialSnapshotResponse {
    success: boolean;
    projects: CommercialSnapshotProject[];
    count: number;
    databaseId?: string;
    error?: string;
}

// Fetch all projects from Commercial Snapshot
export const fetchCommercialSnapshot = async (): Promise<CommercialSnapshotProject[]> => {
    try {
        const response = await fetch(`${API_BASE}/commercial-snapshot`, { method: 'GET' });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to fetch commercial snapshot: ${response.status}`);
        }

        const data: CommercialSnapshotResponse = await response.json();
        return data.projects || [];
    } catch (error) {
        console.error("Error fetching commercial snapshot:", error);
        throw error;
    }
};

// Fetch single project by ID
export const fetchCommercialSnapshotProject = async (id: string): Promise<CommercialSnapshotProject | null> => {
    try {
        const response = await fetch(`${API_BASE}/commercial-snapshot/${id}`, { method: 'GET' });
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Failed to fetch project: ${response.status}`);
        }

        const data = await response.json();
        return data.project || null;
    } catch (error) {
        console.error("Error fetching commercial snapshot project:", error);
        throw error;
    }
};

// Fetch projects filtered by status
export const fetchCommercialSnapshotByStatus = async (status: string): Promise<CommercialSnapshotProject[]> => {
    try {
        const response = await fetch(`${API_BASE}/commercial-snapshot/by-status/${encodeURIComponent(status)}`, { method: 'GET' });
        if (!response.ok) {
            throw new Error(`Failed to fetch projects by status: ${response.status}`);
        }

        const data = await response.json();
        return data.projects || [];
    } catch (error) {
        console.error("Error fetching commercial snapshot by status:", error);
        throw error;
    }
};

// Group projects by workflow/deal stage status
export const groupProjectsByStatus = (projects: CommercialSnapshotProject[]): ProjectsByStatus => {
    const grouped: ProjectsByStatus = {
        active: [],
        inProgress: [],
        completed: [],
        pipeline: []
    };

    projects.forEach(project => {
        const dealStage = project.dealStage?.toLowerCase() || '';
        const creativeStatus = project.creativeWorkflowStatus?.toLowerCase() || '';
        const productionStatus = project.productionWorkflowStatus?.toLowerCase() || '';
        const outcome = project.projectOutcome?.toLowerCase() || '';

        // Completed projects
        if (outcome === 'won' || dealStage === 'campaign complete' || outcome === 'completed') {
            grouped.completed.push(project);
        }
        // Active/Live projects
        else if (creativeStatus === 'live' || productionStatus === 'live' || creativeStatus === 'approved') {
            grouped.active.push(project);
        }
        // In progress (in production, review, concepting)
        else if (
            creativeStatus.includes('production') ||
            productionStatus.includes('production') ||
            creativeStatus === 'review' ||
            creativeStatus === 'concepting'
        ) {
            grouped.inProgress.push(project);
        }
        // Pipeline (prospecting, proposal, contracting, briefing)
        else {
            grouped.pipeline.push(project);
        }
    });

    return grouped;
};

// Get projects with upcoming deadlines
export const getUpcomingDeadlines = (projects: CommercialSnapshotProject[], daysAhead = 14): CommercialSnapshotProject[] => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    return projects
        .filter(project => {
            const clientDue = project.clientProjectDueDate ? new Date(project.clientProjectDueDate) : null;
            const internalDue = project.internalProjectDueDate ? new Date(project.internalProjectDueDate) : null;
            const earliestDue = project.earliestDeliverableDue ? new Date(project.earliestDeliverableDue) : null;

            const nearestDeadline = [clientDue, internalDue, earliestDue]
                .filter((d): d is Date => d !== null && d >= now)
                .sort((a, b) => a.getTime() - b.getTime())[0];

            return nearestDeadline && nearestDeadline <= cutoff;
        })
        .sort((a, b) => {
            const getEarliest = (p: CommercialSnapshotProject) => {
                const dates = [
                    p.clientProjectDueDate,
                    p.internalProjectDueDate,
                    p.earliestDeliverableDue
                ].filter(Boolean).map(d => new Date(d!).getTime());
                return Math.min(...dates) || Infinity;
            };
            return getEarliest(a) - getEarliest(b);
        });
};

// Get high priority projects
export const getHighPriorityProjects = (projects: CommercialSnapshotProject[]): CommercialSnapshotProject[] => {
    return projects.filter(p =>
        p.priorityLevel?.toLowerCase() === 'high' ||
        p.status1?.toLowerCase().includes('urgent') ||
        p.status1?.toLowerCase().includes('at risk')
    );
};

// Calculate total deal value in pipeline
export const calculatePipelineValue = (projects: CommercialSnapshotProject[]): number => {
    return projects.reduce((total, p) => total + (p.dealValue || 0), 0);
};

// Format currency for display
export const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

// Format date for display
export const formatDate = (dateString: string | null): string => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

// Get days until deadline
export const getDaysUntil = (dateString: string | null): number | null => {
    if (!dateString) return null;
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};
