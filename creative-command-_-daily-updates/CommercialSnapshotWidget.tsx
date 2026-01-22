import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DotGrid } from './components/DotGrid';
import {
    calculatePipelineValue,
    fetchCommercialSnapshot,
    formatCurrency,
    formatDate,
    getDaysUntil,
    getHighPriorityProjects,
    getUpcomingDeadlines,
    groupProjectsByStatus
} from './services/commercialSnapshotService';
import { CommercialSnapshotProject, ProjectsByStatus } from './types';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';
type ViewMode = 'overview' | 'list' | 'timeline';

// Slack formatting helper
const formatSlackDate = () => {
    const now = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    // Get week commencing (Monday of current week)
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);

    return {
        weekCommencing: `W/C ${weekStart.getDate()} ${monthNames[weekStart.getMonth()]} ${weekStart.getFullYear()}`,
        today: `${dayNames[now.getDay()]} ${now.getDate()} ${monthNames[now.getMonth()]}`
    };
};

const generateSlackMessage = (grouped: ProjectsByStatus, projects: CommercialSnapshotProject[]): string => {
    const { weekCommencing, today } = formatSlackDate();
    const lines: string[] = [];

    lines.push(`📍 WHAT'S HAPPENING AT DMG NEW MEDIA | SNAPSHOT`);
    lines.push(`@channel`);
    lines.push(weekCommencing);
    lines.push(`📆 ${today}`);
    lines.push('');

    // Completed projects
    if (grouped.completed.length > 0) {
        lines.push(`✅ COMPLETED PROJECTS`);
        lines.push('');
        grouped.completed.forEach(p => {
            const name = p.projectName || p.record;
            if (p.liveLink) {
                lines.push(`📄 ${name}: ${p.liveLink}`);
            } else {
                lines.push(`📄 ${name}`);
            }
        });
        lines.push('');
    }

    // In Progress / Creative Responses
    const inProgressCommercial = grouped.inProgress.filter(p =>
        p.creativeWorkflowStatus?.toLowerCase().includes('creative') ||
        p.dealStage?.toLowerCase().includes('proposal')
    );
    const inProduction = grouped.inProgress.filter(p =>
        !inProgressCommercial.includes(p)
    );

    if (inProgressCommercial.length > 0) {
        lines.push(`🛠 IN PROGRESS CREATIVE RESPONSES`);
        lines.push('');
        inProgressCommercial.forEach(p => {
            const name = p.projectName || p.record;
            lines.push(`📄 ${name}${p.creativeWorkflowStatus ? ` – ${p.creativeWorkflowStatus}` : ''}`);
        });
        lines.push('');
    }

    // Live Projects
    if (grouped.active.length > 0) {
        lines.push(`🚦 LIVE / ACTIVE PROJECTS`);
        lines.push('');
        grouped.active.forEach(p => {
            const name = p.projectName || p.record;
            lines.push(`*${name.toUpperCase()}*`);

            // Add sales leads if available
            if (p.salesLeads && p.salesLeads.length > 0) {
                const leads = p.salesLeads.map(l => `@${l.name}`).join(' ');
                lines.push(leads);
            }

            // Add card summary as bullet points
            if (p.cardSummary) {
                const bullets = p.cardSummary.split(/[.;]/).filter(b => b.trim());
                bullets.forEach(bullet => {
                    if (bullet.trim()) {
                        lines.push(`• ${bullet.trim()}`);
                    }
                });
            }

            // Add AI status recap if available
            if (p.aiStatusRecap) {
                lines.push(`• ${p.aiStatusRecap}`);
            }

            // Add due date info
            const dueDate = p.clientProjectDueDate || p.internalProjectDueDate;
            if (dueDate) {
                lines.push(`• 📅 Due: ${formatDate(dueDate)}`);
            }

            // Add link
            if (p.liveLink) {
                lines.push(`🔗 ${p.liveLink}`);
            }
            lines.push('');
        });
    }

    // Active / In Production
    if (inProduction.length > 0) {
        lines.push(`🎬 ACTIVE / IN PRODUCTION`);
        lines.push('');
        inProduction.forEach(p => {
            const name = p.projectName || p.record;
            lines.push(`*${name.toUpperCase()}*`);

            if (p.salesLeads && p.salesLeads.length > 0) {
                const leads = p.salesLeads.map(l => `@${l.name}`).join(' ');
                lines.push(leads);
            }

            if (p.cardSummary) {
                const bullets = p.cardSummary.split(/[.;]/).filter(b => b.trim());
                bullets.forEach(bullet => {
                    if (bullet.trim()) {
                        lines.push(`• ${bullet.trim()}`);
                    }
                });
            }

            if (p.productionWorkflowStatus) {
                lines.push(`• Status: ${p.productionWorkflowStatus}`);
            }

            const dueDate = p.clientProjectDueDate || p.internalProjectDueDate;
            if (dueDate) {
                lines.push(`• 📅 Due: ${formatDate(dueDate)}`);
            }

            if (p.liveLink) {
                lines.push(`🔗 ${p.liveLink}`);
            }
            lines.push('');
        });
    }

    // Pipeline / Prospective
    if (grouped.pipeline.length > 0) {
        lines.push(`🤝 PIPELINE / PROSPECTIVE`);
        lines.push('');
        grouped.pipeline.forEach(p => {
            const name = p.projectName || p.record;
            const stage = p.dealStage ? ` (${p.dealStage})` : '';
            const value = p.dealValue ? ` – ${formatCurrency(p.dealValue)}` : '';
            lines.push(`• ${name}${stage}${value}`);
        });
        lines.push('');
    }

    // Coming Up - projects with deadlines in next 7 days
    const comingUp = projects.filter(p => {
        const d = getDaysUntil(p.clientProjectDueDate || p.internalProjectDueDate);
        return d !== null && d > 0 && d <= 7;
    });

    if (comingUp.length > 0) {
        lines.push(`👋 COMING UP THIS WEEK`);
        lines.push('');
        comingUp.forEach(p => {
            const name = p.projectName || p.record;
            const dueDate = p.clientProjectDueDate || p.internalProjectDueDate;
            lines.push(`• ${name} – Due ${formatDate(dueDate)}`);
        });
        lines.push('');
    }

    return lines.join('\n');
};

const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    inProgress: 'bg-amber-50 border-amber-200 text-amber-700',
    completed: 'bg-sky-50 border-sky-200 text-sky-700',
    pipeline: 'bg-purple-50 border-purple-200 text-purple-700'
};

const statusLabels: Record<string, string> = {
    active: 'Live / Active',
    inProgress: 'In Production',
    completed: 'Completed',
    pipeline: 'Pipeline'
};

const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-slate-100 text-slate-600'
};

const CommercialSnapshotWidget: React.FC = () => {
    const [projects, setProjects] = useState<CommercialSnapshotProject[]>([]);
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

    const handleCopyForSlack = useCallback(() => {
        const grouped = groupProjectsByStatus(projects);
        const slackMessage = generateSlackMessage(grouped, projects);

        navigator.clipboard.writeText(slackMessage).then(() => {
            setCopyFeedback('Copied!');
            setTimeout(() => setCopyFeedback(null), 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            setCopyFeedback('Failed to copy');
            setTimeout(() => setCopyFeedback(null), 2000);
        });
    }, [projects]);

    const handleSendToSlack = useCallback(() => {
        // Placeholder for future Slack integration
        // Will be configured to post to a specific channel
        alert('Send to Slack coming soon! Configure your Slack webhook URL.');
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchCommercialSnapshot();
                if (data.length === 0) {
                    setLoadState('empty');
                } else {
                    setProjects(data);
                    setLoadState('ready');
                }
            } catch (err) {
                console.error('Failed to load commercial snapshot:', err);
                setError(err instanceof Error ? err.message : 'Failed to load data');
                setLoadState('error');
            }
        };

        load();
    }, []);

    const groupedProjects = useMemo(() => groupProjectsByStatus(projects), [projects]);
    const upcomingDeadlines = useMemo(() => getUpcomingDeadlines(projects, 14), [projects]);
    const highPriority = useMemo(() => getHighPriorityProjects(projects), [projects]);
    const pipelineValue = useMemo(() => calculatePipelineValue(groupedProjects.pipeline), [groupedProjects]);

    const clients = useMemo(() => {
        const uniqueClients = new Set(projects.map(p => p.clientPartner).filter(Boolean) as string[]);
        return Array.from(uniqueClients).sort();
    }, [projects]);

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchesSearch = !searchQuery ||
                p.projectName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.clientPartner?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.record?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesClient = !selectedClient || p.clientPartner === selectedClient;
            return matchesSearch && matchesClient;
        });
    }, [projects, searchQuery, selectedClient]);

    const renderDeadlineBadge = (project: CommercialSnapshotProject) => {
        const nearestDate = project.clientProjectDueDate || project.internalProjectDueDate || project.earliestDeliverableDue;
        const daysUntil = getDaysUntil(nearestDate);

        if (daysUntil === null) return null;

        let bgColor = 'bg-slate-100 text-slate-600';
        if (daysUntil < 0) bgColor = 'bg-red-100 text-red-700';
        else if (daysUntil <= 3) bgColor = 'bg-red-100 text-red-700';
        else if (daysUntil <= 7) bgColor = 'bg-amber-100 text-amber-700';

        return (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bgColor}`}>
                {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d`}
            </span>
        );
    };

    const renderProjectCard = (project: CommercialSnapshotProject, showStatus = true) => (
        <div
            key={project.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">
                        {project.projectName || project.record}
                    </h3>
                    {project.clientPartner && (
                        <p className="text-xs text-slate-500 mt-0.5">{project.clientPartner}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {renderDeadlineBadge(project)}
                    {project.priorityLevel && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priorityColors[project.priorityLevel.toLowerCase()] || priorityColors.low}`}>
                            {project.priorityLevel}
                        </span>
                    )}
                </div>
            </div>

            {project.cardSummary && (
                <p className="text-xs text-slate-600 mt-2 line-clamp-2">{project.cardSummary}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
                {showStatus && project.creativeWorkflowStatus && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {project.creativeWorkflowStatus}
                    </span>
                )}
                {project.dealStage && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
                        {project.dealStage}
                    </span>
                )}
                {project.vertical && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
                        {project.vertical}
                    </span>
                )}
            </div>

            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span>Due: {formatDate(project.clientProjectDueDate || project.internalProjectDueDate)}</span>
                {project.dealValue && (
                    <span className="font-semibold text-slate-600">{formatCurrency(project.dealValue)}</span>
                )}
            </div>

            <div className="mt-2 flex items-center gap-3">
                {project.liveLink && (
                    <a
                        href={project.liveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-bold text-[#E6468B] hover:underline"
                    >
                        Live Link
                    </a>
                )}
                {project.url && (
                    <a
                        href={project.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[9px] text-slate-400 hover:text-slate-600 hover:underline"
                        title="View in Notion"
                    >
                        ↗
                    </a>
                )}
            </div>
        </div>
    );

    const renderStatusSection = (status: keyof ProjectsByStatus, projects: CommercialSnapshotProject[]) => {
        if (projects.length === 0) return null;

        return (
            <div key={status} className={`rounded-3xl border p-5 ${statusColors[status]}`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black uppercase tracking-[0.15em]">
                        {statusLabels[status]}
                    </h2>
                    <span className="text-xs font-semibold opacity-70">{projects.length} projects</span>
                </div>
                <div className="space-y-3">
                    {projects.slice(0, 5).map(p => renderProjectCard(p, false))}
                    {projects.length > 5 && (
                        <p className="text-xs text-center opacity-70">+{projects.length - 5} more</p>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#1C1C1C]">
            <div className="max-w-[1600px] mx-auto px-8 py-10">
                {/* Header */}
                <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                        <DotGrid />
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#E6468B]">Commercial Snapshot</p>
                            <h1 className="text-3xl font-black">Project Dashboard</h1>
                            <p className="text-sm text-slate-500">Real-time view of active projects and pipeline</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* View mode toggle */}
                        <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden">
                            {(['overview', 'list', 'timeline'] as ViewMode[]).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-4 py-2 text-xs font-semibold capitalize transition-colors ${
                                        viewMode === mode
                                            ? 'bg-slate-800 text-white'
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        {/* Slack Actions */}
                        {loadState === 'ready' && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopyForSlack}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <span>📋</span>
                                    {copyFeedback || 'Copy for Slack'}
                                </button>
                                <button
                                    onClick={handleSendToSlack}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#4A154B] text-white hover:bg-[#611f64] transition-colors"
                                >
                                    <span>💬</span>
                                    Send to Slack
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                {/* Search and Filters */}
                {loadState === 'ready' && (
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px] max-w-md">
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#21A0D8]/30"
                            />
                        </div>
                        <select
                            value={selectedClient || ''}
                            onChange={e => setSelectedClient(e.target.value || null)}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#21A0D8]/30"
                        >
                            <option value="">All Clients</option>
                            {clients.map(client => (
                                <option key={client} value={client}>{client}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Loading State */}
                {loadState === 'loading' && (
                    <div className="mt-16 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#E6468B]"></div>
                        <p className="mt-4 text-slate-500">Loading projects from Notion...</p>
                    </div>
                )}

                {/* Empty State */}
                {loadState === 'empty' && (
                    <div className="mt-16 rounded-2xl border border-dashed border-slate-200 bg-white px-8 py-10 text-center">
                        <p className="text-slate-500">No projects found in Commercial Snapshot.</p>
                        <p className="text-xs text-slate-400 mt-2">Make sure the database is configured and has data.</p>
                    </div>
                )}

                {/* Error State */}
                {loadState === 'error' && (
                    <div className="mt-16 rounded-2xl border border-red-200 bg-red-50 px-8 py-10 text-center">
                        <p className="text-red-600 font-semibold">Unable to load Commercial Snapshot</p>
                        <p className="text-xs text-red-500 mt-2">{error}</p>
                    </div>
                )}

                {/* Ready State */}
                {loadState === 'ready' && (
                    <main className="mt-8">
                        {/* Overview Mode */}
                        {viewMode === 'overview' && (
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                                {/* Left Sidebar - Stats */}
                                <section className="lg:col-span-4 space-y-6">
                                    {/* Quick Stats */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">At a glance</p>
                                        <div className="mt-4 grid grid-cols-2 gap-4">
                                            <div className="rounded-2xl bg-emerald-50 p-4">
                                                <p className="text-3xl font-black text-emerald-600">{groupedProjects.active.length}</p>
                                                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600/70">Live</p>
                                            </div>
                                            <div className="rounded-2xl bg-amber-50 p-4">
                                                <p className="text-3xl font-black text-amber-600">{groupedProjects.inProgress.length}</p>
                                                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600/70">In Progress</p>
                                            </div>
                                            <div className="rounded-2xl bg-purple-50 p-4">
                                                <p className="text-3xl font-black text-purple-600">{groupedProjects.pipeline.length}</p>
                                                <p className="text-xs font-semibold uppercase tracking-widest text-purple-600/70">Pipeline</p>
                                            </div>
                                            <div className="rounded-2xl bg-sky-50 p-4">
                                                <p className="text-3xl font-black text-sky-600">{groupedProjects.completed.length}</p>
                                                <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">Complete</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pipeline Value */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Pipeline Value</p>
                                        <p className="mt-2 text-3xl font-black text-slate-800">{formatCurrency(pipelineValue)}</p>
                                        <p className="text-xs text-slate-500 mt-1">{groupedProjects.pipeline.length} active opportunities</p>
                                    </div>

                                    {/* High Priority */}
                                    {highPriority.length > 0 && (
                                        <div className="rounded-3xl border border-red-200 bg-red-50/50 p-6 shadow-sm">
                                            <p className="text-[11px] font-bold uppercase tracking-widest text-red-600">High Priority</p>
                                            <div className="mt-4 space-y-3">
                                                {highPriority.slice(0, 4).map(p => (
                                                    <div key={p.id} className="rounded-2xl bg-white border border-red-100 px-4 py-3">
                                                        <p className="text-sm font-semibold text-slate-700 truncate">{p.projectName || p.record}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{p.clientPartner}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Upcoming Deadlines */}
                                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Next 14 Days</p>
                                        <div className="mt-4 space-y-3">
                                            {upcomingDeadlines.length === 0 ? (
                                                <p className="text-sm text-slate-500">No upcoming deadlines</p>
                                            ) : (
                                                upcomingDeadlines.slice(0, 5).map(p => (
                                                    <div key={p.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-slate-700 truncate">{p.projectName || p.record}</p>
                                                        </div>
                                                        {renderDeadlineBadge(p)}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* Main Content - Project Grid */}
                                <section className="lg:col-span-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                                    {renderStatusSection('active', groupedProjects.active)}
                                    {renderStatusSection('inProgress', groupedProjects.inProgress)}
                                    {renderStatusSection('pipeline', groupedProjects.pipeline)}
                                    {renderStatusSection('completed', groupedProjects.completed)}
                                </section>
                            </div>
                        )}

                        {/* List Mode */}
                        {viewMode === 'list' && (
                            <div className="space-y-4">
                                <p className="text-sm text-slate-500">
                                    Showing {filteredProjects.length} of {projects.length} projects
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredProjects.map(p => renderProjectCard(p))}
                                </div>
                            </div>
                        )}

                        {/* Timeline Mode */}
                        {viewMode === 'timeline' && (
                            <div className="space-y-6">
                                <p className="text-sm text-slate-500">Projects sorted by deadline</p>

                                {/* Overdue */}
                                {(() => {
                                    const overdue = filteredProjects.filter(p => {
                                        const d = getDaysUntil(p.clientProjectDueDate || p.internalProjectDueDate);
                                        return d !== null && d < 0;
                                    });
                                    if (overdue.length === 0) return null;
                                    return (
                                        <div className="rounded-3xl border border-red-200 bg-red-50/50 p-5">
                                            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-red-700 mb-4">
                                                Overdue ({overdue.length})
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {overdue.map(p => renderProjectCard(p))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* This Week */}
                                {(() => {
                                    const thisWeek = filteredProjects.filter(p => {
                                        const d = getDaysUntil(p.clientProjectDueDate || p.internalProjectDueDate);
                                        return d !== null && d >= 0 && d <= 7;
                                    });
                                    if (thisWeek.length === 0) return null;
                                    return (
                                        <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5">
                                            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-amber-700 mb-4">
                                                This Week ({thisWeek.length})
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {thisWeek.map(p => renderProjectCard(p))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Next 2 Weeks */}
                                {(() => {
                                    const next2Weeks = filteredProjects.filter(p => {
                                        const d = getDaysUntil(p.clientProjectDueDate || p.internalProjectDueDate);
                                        return d !== null && d > 7 && d <= 14;
                                    });
                                    if (next2Weeks.length === 0) return null;
                                    return (
                                        <div className="rounded-3xl border border-sky-200 bg-sky-50/50 p-5">
                                            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-sky-700 mb-4">
                                                Next 2 Weeks ({next2Weeks.length})
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {next2Weeks.map(p => renderProjectCard(p))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Later / No Date */}
                                {(() => {
                                    const later = filteredProjects.filter(p => {
                                        const d = getDaysUntil(p.clientProjectDueDate || p.internalProjectDueDate);
                                        return d === null || d > 14;
                                    });
                                    if (later.length === 0) return null;
                                    return (
                                        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-5">
                                            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-600 mb-4">
                                                Later / No Due Date ({later.length})
                                            </h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {later.map(p => renderProjectCard(p))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </main>
                )}
            </div>
        </div>
    );
};

export default CommercialSnapshotWidget;
