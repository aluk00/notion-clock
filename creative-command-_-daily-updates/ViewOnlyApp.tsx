import React, { useEffect, useMemo, useState } from 'react';
import { DotGrid } from './components/DotGrid';
import { CommercialSnapshotProject, DailyRundownSection, STATUS_TAG_COLORS } from './types';

// API base URL - adjust for local dev vs production
const API_BASE = 'https://createnotionproject-223535956454.us-central1.run.app';

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

interface RundownData {
  date: string;
  sections: DailyRundownSection[];
  totals: {
    total: number;
    bySection: Record<string, number>;
    byStatusTag: Record<string, number>;
  };
  lastFetched: string;
}

// Tone to Tailwind class mapping
const toneStyles: Record<string, string> = {
  sky: 'border-sky-200 bg-sky-50/40',
  amber: 'border-amber-200 bg-amber-50/40',
  emerald: 'border-emerald-200 bg-emerald-50/40',
  purple: 'border-purple-200 bg-purple-50/40',
  rose: 'border-rose-200 bg-rose-50/40',
  gray: 'border-gray-200 bg-gray-50/50',
  indigo: 'border-indigo-200 bg-indigo-50/40',
  slate: 'border-slate-200 bg-white'
};

const formatDate = (date: Date) => date.toLocaleDateString('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
});

const formatTime = (iso?: string) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

// Parse links from text (can be URLs or formatted text)
const parseLinks = (linksText: string | null): { label: string; url: string }[] => {
  if (!linksText) return [];
  const links: { label: string; url: string }[] = [];

  // Match URLs
  const urlRegex = /https?:\/\/[^\s<]+/g;
  const matches = linksText.match(urlRegex);
  if (matches) {
    matches.forEach((url, i) => {
      links.push({ label: `Link ${i + 1}`, url });
    });
  }

  return links;
};

// Generate Slack-formatted message for a section
const generateSlackMessage = (sections: DailyRundownSection[], date: string): string => {
  const dateStr = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  let message = `*Creative Command — Daily Snapshot*\n${dateStr}\n\n`;

  sections.forEach(section => {
    if (section.items.length === 0) return;

    message += `*${section.title}*\n`;

    section.items.forEach(item => {
      const headline = item.headline || item.projectName || item.record || 'Untitled';
      const tag = item.statusTag ? ` [${item.statusTag}]` : '';
      message += `• ${headline}${tag}\n`;

      if (item.details) {
        // Indent details
        const detailLines = item.details.split('\n').filter(l => l.trim());
        detailLines.forEach(line => {
          message += `    ${line.trim()}\n`;
        });
      }
    });

    message += '\n';
  });

  return message.trim();
};

const ViewOnlyApp: React.FC = () => {
  const [rundown, setRundown] = useState<RundownData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [slackPanelOpen, setSlackPanelOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    const fetchRundown = async () => {
      try {
        const response = await fetch(`${API_BASE}/daily-rundown`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch rundown');
        }

        if (data.itemCount === 0) {
          setLoadState('empty');
          return;
        }

        setRundown({
          date: data.date,
          sections: data.sections,
          totals: data.totals,
          lastFetched: data.lastFetched
        });
        setLoadState('ready');
      } catch (error) {
        console.error('Failed to load daily rundown:', error);
        setLoadState('error');
      }
    };

    fetchRundown();
  }, []);

  const sections = useMemo(() => {
    if (!rundown) return [];
    return rundown.sections.filter(section => section.items.length > 0);
  }, [rundown]);

  const totals = useMemo(() => {
    if (!rundown) return { total: 0, green: 0, yellow: 0, red: 0 };
    return {
      total: rundown.totals.total,
      green: rundown.totals.byStatusTag['Green'] || 0,
      yellow: rundown.totals.byStatusTag['Yellow'] || 0,
      red: rundown.totals.byStatusTag['Red'] || 0
    };
  }, [rundown]);

  const focusItems = useMemo(() => {
    if (!rundown) return [];
    // Get items from active sections with status tags
    return rundown.sections
      .flatMap(section => section.items.map(item => ({ ...item, sectionTitle: section.title })))
      .filter(item => item.statusTag === 'Red' || item.statusTag === 'Yellow')
      .slice(0, 6);
  }, [rundown]);

  const slackMessage = useMemo(() => {
    if (!rundown) return '';
    return generateSlackMessage(rundown.sections, rundown.date);
  }, [rundown]);

  const handleCopySlack = async () => {
    try {
      await navigator.clipboard.writeText(slackMessage);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getStatusTagStyle = (tag: string | null) => {
    if (!tag) return '';
    const colors = STATUS_TAG_COLORS[tag as keyof typeof STATUS_TAG_COLORS];
    if (!colors) return '';
    return `${colors.bg} ${colors.text} ${colors.border} border`;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1C1C1C]">
      {/* Slack Preview Panel */}
      <div
        className={`fixed inset-y-0 right-0 w-[480px] bg-white border-l border-slate-200 shadow-2xl transform transition-transform duration-300 ease-out z-50 ${
          slackPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Slack Preview</p>
            <h2 className="text-lg font-black text-slate-800">Daily Message</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCopySlack}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                copyFeedback
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#E6468B] text-white hover:bg-[#d63d7d]'
              }`}
            >
              {copyFeedback ? 'Copied!' : 'Copy to Clipboard'}
            </button>
            <button
              onClick={() => setSlackPanelOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="p-6 overflow-y-auto h-[calc(100%-80px)]">
          <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700 bg-slate-50 rounded-xl p-4 border border-slate-200">
            {slackMessage || 'No content to preview'}
          </pre>
        </div>
      </div>

      {/* Backdrop when panel open */}
      {slackPanelOpen && (
        <div
          className="fixed inset-0 bg-black/10 z-40"
          onClick={() => setSlackPanelOpen(false)}
        />
      )}

      <div className="max-w-[1500px] mx-auto px-8 py-10">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <DotGrid />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#E6468B]">Creative Command</p>
              <h1 className="text-3xl font-black">Daily Snapshot</h1>
              <p className="text-sm text-slate-500">Live from Commercial Snapshot</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Date</p>
              <p className="text-sm font-semibold text-slate-700">{formatDate(new Date())}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Last Synced</p>
              <p className="text-sm font-semibold text-slate-700">{formatTime(rundown?.lastFetched)}</p>
            </div>
            <button
              onClick={() => setSlackPanelOpen(true)}
              className="rounded-2xl border border-[#E6468B]/30 bg-[#E6468B]/10 px-4 py-3 text-sm shadow-sm hover:bg-[#E6468B]/20 transition-colors cursor-pointer"
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#E6468B]/70">Preview</p>
              <p className="text-sm font-semibold text-[#E6468B]">Slack Message</p>
            </button>
          </div>
        </header>

        {loadState === 'loading' ? (
          <div className="mt-16 text-center text-slate-500">Loading today&apos;s snapshot…</div>
        ) : null}

        {loadState === 'empty' ? (
          <div className="mt-16 rounded-2xl border border-dashed border-slate-200 bg-white px-8 py-10 text-center text-slate-500">
            <p className="text-lg font-semibold">No items for today</p>
            <p className="mt-2 text-sm">Add items to Commercial Snapshot with today&apos;s Snapshot Date to see them here.</p>
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="mt-16 rounded-2xl border border-red-200 bg-red-50 px-8 py-10 text-center text-red-600">
            Unable to load the daily snapshot. Check API connection.
          </div>
        ) : null}

        {loadState === 'ready' && rundown ? (
          <main className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left sidebar - Stats & Focus */}
            <section className="lg:col-span-4 space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">At a glance</p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-3xl font-black text-slate-800">{totals.total}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total items</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-3xl font-black text-emerald-600">{totals.green}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600/70">On track</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <p className="text-3xl font-black text-amber-600">{totals.yellow}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-600/70">Needs attention</p>
                  </div>
                  <div className="rounded-2xl bg-red-50 p-4">
                    <p className="text-3xl font-black text-red-600">{totals.red}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-red-600/70">Blocked</p>
                  </div>
                </div>
              </div>

              {focusItems.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Needs attention</p>
                  <div className="mt-4 space-y-3">
                    {focusItems.map(item => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-700 truncate">
                            {item.headline || item.projectName || item.record || 'Untitled'}
                          </p>
                          {item.statusTag && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusTagStyle(item.statusTag)}`}>
                              {item.statusTag}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{item.sectionTitle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section breakdown */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">By section</p>
                <div className="mt-4 space-y-2">
                  {sections.map(section => (
                    <div key={section.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <span className="text-sm text-slate-600">{section.title}</span>
                      <span className="text-sm font-bold text-slate-800">{section.items.length}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Main content - Sections grid */}
            <section className="lg:col-span-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              {sections.map(section => (
                <div
                  key={section.id}
                  className={`rounded-3xl border p-5 shadow-sm ${toneStyles[section.tone] || toneStyles.slate}`}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-[0.15em] text-slate-700">
                      {section.title}
                    </h2>
                    <span className="text-xs font-semibold text-slate-500">{section.items.length}</span>
                  </div>
                  <div className="mt-4 space-y-4">
                    {section.items.map(item => (
                      <ItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </main>
        ) : null}
      </div>
    </div>
  );
};

// Item card component
const ItemCard: React.FC<{ item: CommercialSnapshotProject }> = ({ item }) => {
  const headline = item.headline || item.projectName || item.record || 'Untitled';
  const links = parseLinks(item.links);

  const getStatusTagStyle = (tag: string | null) => {
    if (!tag) return '';
    const colors = STATUS_TAG_COLORS[tag as keyof typeof STATUS_TAG_COLORS];
    if (!colors) return '';
    return `${colors.bg} ${colors.text} ${colors.border} border`;
  };

  return (
    <div className="rounded-2xl border border-white/80 bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{headline}</p>
          {item.clientPartner && (
            <p className="text-xs text-slate-500 mt-0.5">{item.clientPartner}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.statusTag && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusTagStyle(item.statusTag)}`}>
              {item.statusTag}
            </span>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-bold uppercase tracking-widest text-[#E6468B] hover:underline"
            >
              Notion
            </a>
          )}
        </div>
      </div>

      {item.details && (
        <p className="mt-2 text-xs text-slate-600 whitespace-pre-line">{item.details}</p>
      )}

      {links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-semibold text-[#21a0d8] hover:underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}

      {item.liveLink && (
        <a
          href={item.liveLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </a>
      )}
    </div>
  );
};

export default ViewOnlyApp;
