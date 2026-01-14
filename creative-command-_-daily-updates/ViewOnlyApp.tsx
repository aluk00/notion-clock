import React, { useEffect, useMemo, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { DotGrid } from './components/DotGrid';
import { auth, COLLECTION_PATH, db } from './services/firebase';
import { RundownData, SectionData } from './types';

type RundownMeta = RundownData & {
  session?: string;
  lastModified?: string;
  createdAt?: string;
};

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

const highlightOrder = ['pending', 'live', 'completed', 'media', 'partnerships', 'internal', 'coming_up'];

const cardStyles: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50/40',
  live: 'border-emerald-200 bg-emerald-50/40',
  completed: 'border-sky-200 bg-sky-50/40',
  media: 'border-purple-200 bg-purple-50/40',
  partnerships: 'border-rose-200 bg-rose-50/40',
  internal: 'border-gray-200 bg-gray-50/50',
  coming_up: 'border-indigo-200 bg-indigo-50/40'
};

const getSectionTone = (sectionId: string) => cardStyles[sectionId] || 'border-slate-200 bg-white';

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

const countItems = (sections: SectionData[]) => sections.reduce((total, section) => total + section.items.length, 0);

const ViewOnlyApp: React.FC = () => {
  const [rundown, setRundown] = useState<RundownMeta | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        await signInAnonymously(auth);
        const today = new Date().toISOString().split('T')[0];
        const todayQuery = query(collection(db, COLLECTION_PATH), where('date', '==', today));
        const todaySnapshot = await getDocs(todayQuery);

        if (!todaySnapshot.empty) {
          const docSnap = todaySnapshot.docs[0];
          setRundown({ ...(docSnap.data() as RundownMeta), id: docSnap.id });
          setLoadState('ready');
          return;
        }

        const fallbackQuery = query(collection(db, COLLECTION_PATH), orderBy('date', 'desc'), limit(1));
        const fallbackSnapshot = await getDocs(fallbackQuery);
        if (!fallbackSnapshot.empty) {
          const docSnap = fallbackSnapshot.docs[0];
          setRundown({ ...(docSnap.data() as RundownMeta), id: docSnap.id });
          setIsFallback(true);
          setLoadState('ready');
          return;
        }

        setLoadState('empty');
      } catch (error) {
        console.error('Failed to load updates', error);
        setLoadState('error');
      }
    };

    load();
  }, []);

  const sections = useMemo(() => {
    if (!rundown) return [];
    const sorted = [...rundown.sections].sort(
      (a, b) => highlightOrder.indexOf(a.id) - highlightOrder.indexOf(b.id)
    );
    return sorted.filter(section => section.items.length > 0);
  }, [rundown]);

  const totals = useMemo(() => {
    if (!rundown) return { total: 0, live: 0, pending: 0, completed: 0 };
    const total = countItems(rundown.sections);
    const live = rundown.sections.find(section => section.id === 'live')?.items.length ?? 0;
    const pending = rundown.sections.find(section => section.id === 'pending')?.items.length ?? 0;
    const completed = rundown.sections.find(section => section.id === 'completed')?.items.length ?? 0;
    return { total, live, pending, completed };
  }, [rundown]);

  const focusItems = useMemo(() => {
    if (!rundown) return [];
    const focusSectionIds = new Set(['pending', 'live', 'coming_up']);
    return rundown.sections
      .filter(section => focusSectionIds.has(section.id))
      .flatMap(section => section.items.map(item => ({ ...item, sectionId: section.id })))
      .slice(0, 6);
  }, [rundown]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1C1C1C]">
      <div className="max-w-[1500px] mx-auto px-8 py-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <DotGrid />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Date</p>
              <p className="text-sm font-semibold text-slate-700">{formatDate(new Date())}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Session</p>
              <p className="text-sm font-semibold text-slate-700">{rundown?.session ?? 'Latest'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Last Updated</p>
              <p className="text-sm font-semibold text-slate-700">{formatTime(rundown?.lastModified)}</p>
            </div>
          </div>
        </header>

        {isFallback && loadState === 'ready' && rundown ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Showing the most recent update from {rundown.date}.
          </div>
        ) : null}

        {loadState === 'loading' ? (
          <div className="mt-16 text-center text-slate-500">Loading today&apos;s update…</div>
        ) : null}

        {loadState === 'empty' ? (
          <div className="mt-16 rounded-2xl border border-dashed border-slate-200 bg-white px-8 py-10 text-center text-slate-500">
            No updates have been posted yet.
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="mt-16 rounded-2xl border border-red-200 bg-red-50 px-8 py-10 text-center text-red-600">
            Unable to load the daily update right now.
          </div>
        ) : null}

        {loadState === 'ready' && rundown ? (
          <main className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section className="lg:col-span-4 space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">At a glance</p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-3xl font-black text-slate-800">{totals.total}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total items</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-3xl font-black text-emerald-600">{totals.live}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600/70">Live projects</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-4">
                    <p className="text-3xl font-black text-amber-600">{totals.pending}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-600/70">In progress</p>
                  </div>
                  <div className="rounded-2xl bg-sky-50 p-4">
                    <p className="text-3xl font-black text-sky-600">{totals.completed}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-sky-600/70">Completed</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Key focus</p>
                <div className="mt-4 space-y-3">
                  {focusItems.length === 0 ? (
                    <p className="text-sm text-slate-500">No priority items shared yet.</p>
                  ) : (
                    focusItems.map(item => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-slate-700">{item.projectName || 'Untitled'}</p>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {item.sectionId.replace('_', ' ')}
                          </span>
                        </div>
                        {item.statusNote ? (
                          <p className="mt-1 text-xs text-slate-500">{item.statusNote}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="lg:col-span-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              {sections.map(section => (
                <div key={section.id} className={`rounded-3xl border p-5 shadow-sm ${getSectionTone(section.id)}`}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-700">
                      {section.title}
                    </h2>
                    <span className="text-xs font-semibold text-slate-500">{section.items.length} items</span>
                  </div>
                  <div className="mt-4 space-y-4">
                    {section.items.map(item => (
                      <div key={item.id} className="rounded-2xl border border-white/80 bg-white/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">{item.projectName || 'Untitled'}</p>
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] font-bold uppercase tracking-widest text-[#21A0D8]"
                            >
                              Link
                            </a>
                          ) : null}
                        </div>
                        {item.statusNote ? (
                          <p className="mt-1 text-xs text-slate-500">{item.statusNote}</p>
                        ) : null}
                        {item.bullets.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-xs text-slate-500">
                            {item.bullets.map(bullet => (
                              <li key={bullet.id} className="flex items-start gap-2">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                                <span>{bullet.text}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
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

export default ViewOnlyApp;
