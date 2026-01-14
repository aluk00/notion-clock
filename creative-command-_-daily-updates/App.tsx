import React, { useState, useEffect } from 'react';
import { DotGrid } from './components/DotGrid';
import { SectionEditor } from './components/SectionEditor';
import { SlackPreview } from './components/SlackPreview';
import { fetchActiveProjects } from './services/notionService';
import { auth, db, COLLECTION_PATH } from './services/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, orderBy, limit } from 'firebase/firestore';
import { Project, RundownData, SECTIONS_CONFIG } from './types';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- 🪄 MAGIC PEN COMPONENT ---
const MagicPenWidget = ({ onAnalyze }: { onAnalyze: (data: any) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleMagic = async () => {
    if (!text.trim()) return;
    setLoading(true);

    try {
      // ⚠️ REPLACE THIS WITH YOUR ACTUAL API KEY
      const genAI = new GoogleGenerativeAI("AIzaSyBrV1NuvPO-_CLtQPyOhR_ERsRvE2dxDlY"); 
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        You are a project assistant. Convert these messy notes into a structured JSON array for a status report.
        Valid Section IDs: "completed", "pending", "live", "media", "partnerships", "internal", "coming_up".
        
        Notes: "${text}"

        Output ONLY JSON in this format:
        [
          {
            "sectionId": "pending",
            "items": [
              {
                "projectName": "Project Title",
                "statusNote": "Current status",
                "link": "url here if found",
                "bullets": ["detail 1", "detail 2"]
              }
            ]
          }
        ]
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const jsonText = response.text().replace(/```json/g, "").replace(/```/g, "").trim();
      onAnalyze(JSON.parse(jsonText));
      setIsOpen(false);
      setText("");
    } catch (error) {
      console.error(error);
      alert("Error parsing notes. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {isOpen && (
        <div className="bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 w-80 mb-2 transition-all">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black text-[#21A0D8] uppercase tracking-widest">Update Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-red-500">✕</button>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 p-3 text-xs bg-gray-50 border border-gray-200 rounded-lg outline-none resize-none mb-3 focus:ring-1 focus:ring-[#21A0D8]"
            placeholder="Input drips and drops of notes..."
          />
          <button
            onClick={handleMagic}
            disabled={loading}
            className="w-full py-2 bg-[#1C1C1C] text-white rounded-lg text-xs font-bold hover:bg-[#21A0D8] transition-colors"
          >
            {loading ? "Processing..." : "Format Updates"}
          </button>
        </div>
      )}
      
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${isOpen ? 'bg-gray-100' : 'bg-[#21A0D8] text-white'}`}
      >
        {/* Pen Icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z" />
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            <path d="M2 2l7.586 7.586" />
        </svg>
      </button>
    </div>
  );
};

// Hardcoded data for Ground Zero EOD
const HARDCODED_EOD: Partial<RundownData> = {
    sections: [
        {
            id: 'completed',
            title: 'COMPLETED CREATIVE RESPONSES',
            items: [
                { id: 'h1', projectId: '', projectName: 'MJ: The Movie', statusNote: 'Creative Response (Google Doc)', link: 'https://docs.google.com/document/u/0/', bullets: [] },
                { id: 'h2', projectId: '', projectName: 'Burger King x World Cup', statusNote: 'Creative Response (Google Doc)', link: 'https://docs.google.com/document/u/0/', bullets: [] },
                { id: 'h3', projectId: '', projectName: 'Ramona’s', statusNote: 'Creative Response (Google Doc)', link: 'https://docs.google.com/document/u/0/', bullets: [] },
                { id: 'h4', projectId: '', projectName: 'Abu Dhabi', statusNote: 'Creative Response (Google Doc)', link: 'https://docs.google.com/document/u/0/', bullets: [] }
            ]
        },
        {
            id: 'pending',
            title: 'PENDING / IN PROGRESS CREATIVE RESPONSES',
            items: [
                { 
                    id: 'h5', projectId: '', projectName: 'Duracell x Football (La Liga + World Cup)', statusNote: 'Creative Response support and format stills', link: 'https://docs.google.com/document/u/0/', 
                    bullets: [
                        { id: 'b1', text: 'Pulling example stills for Headlines, Mail Talks, Deep Dive, Now You Know, Street Talks, Mail Investigates' },
                        { id: 'b2', text: 'Battery visual language and distance + charging framing in progress' },
                        { id: 'b3', text: 'Clarifying editorial permissions if not tournament sponsor' }
                    ] 
                },
                { 
                    id: 'h6', projectId: '', projectName: 'Superdrug', statusNote: 'BRIEF COMING SOON', link: '', 
                    bullets: [
                        { id: 'b4', text: '2–3 video ideas' },
                        { id: 'b5', text: 'Deadline EOP Thursday' }
                    ] 
                }
            ]
        },
        {
            id: 'live',
            title: 'LIVE / ACTIVE PROJECTS',
            items: [
                { id: 'h7', projectId: '', projectName: 'SUNWEB', statusNote: 'Frame.io link here', link: 'https://frame.io/', bullets: [] },
                { id: 'h8', projectId: '', projectName: 'ALSOC', statusNote: 'Edit 01 for client review in an hour; planned to go live Friday at 5pm', link: '', bullets: [] },
                { id: 'h9', projectId: '', projectName: 'WUTHERING HEIGHTS', statusNote: 'shooting this and next saturday', link: '', bullets: [] },
                { id: 'h10', projectId: '', projectName: 'TESCO WHOOSH', statusNote: 'Waiting for client approval', link: '', bullets: [] },
                { id: 'h11', projectId: '', projectName: 'TRADING 2-1-2', statusNote: 'to be shoot February, 6 shoots across Feb', link: '', bullets: [] }
            ]
        },
        {
            id: 'media',
            title: 'NEW MEDIA VENTURES',
            items: [
                { id: 'h12', projectId: '', projectName: 'Blue Stripes', statusNote: 'need to send response / updated response', link: '', bullets: [] },
                { id: 'h13', projectId: '', projectName: 'LifeLoop', statusNote: 'WIP', link: '', bullets: [] }
            ]
        },
        {
            id: 'partnerships',
            title: 'PROSPECTIVE & STRATEGIC PARTNERSHIPS',
            items: [
                { id: 'h14', projectId: '', projectName: 'DJI', statusNote: 'proposal to highlight our total reliance on their hardware for both commercial and editorial suites: aiming for a formalised partnership and equipment exchange', link: '', bullets: [] }
            ]
        },
        {
            id: 'internal',
            title: 'INTERNAL / WORKFLOW',
            items: [
                { 
                    id: 'h15', projectId: '', projectName: 'Weekly Commercial Meeting', statusNote: 'Reminder sent to update shared doc ahead of Monday', link: 'https://docs.google.com/document/u/0/', 
                    bullets: [] 
                }
            ]
        },
        {
            id: 'coming_up',
            title: 'COMING UP',
            items: [
                { id: 'h16', projectId: '', projectName: 'Duracell full focus this week', statusNote: '', link: '', bullets: [] },
                { id: 'h17', projectId: '', projectName: 'Superdrug brief turnaround', statusNote: '', link: '', bullets: [] },
                { id: 'h18', projectId: '', projectName: 'New creative to join team this week / next week', statusNote: '', link: '', bullets: [] }
            ]
        }
    ]
};

const App: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [session, setSession] = useState<'Morning' | 'Midday' | 'EOD'>('Morning');
    const [docId, setDocId] = useState<string | null>(null);
    
    const [rundown, setRundown] = useState<RundownData>({
        date: new Date().toISOString().split('T')[0],
        timestamp: null,
        sections: SECTIONS_CONFIG.map(s => ({ ...s, items: [] }))
    });
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await signInAnonymously(auth);
                await loadTodayRundown();
            } catch (e) {
                console.error("Auth/Load failed", e);
            }
            const projs = await fetchActiveProjects();
            setProjects(projs);
        };
        init();
    }, []);

    useEffect(() => {
        if (session === 'EOD') {
            const hasItems = rundown.sections.some(s => s.items.length > 0);
            if (!hasItems && !docId) {
                const populatedSections = HARDCODED_EOD.sections!.map(s => ({
                    ...s,
                    items: s.items.map(i => ({
                        ...i,
                        bullets: [...i.bullets]
                    }))
                }));
                
                setRundown(prev => ({
                    ...prev,
                    sections: populatedSections as any
                }));
                showToast("Pre-populated EOD Template");
            }
        }
    }, [session, docId]);

    const loadTodayRundown = async () => {
        const today = new Date().toISOString().split('T')[0];
        const q = query(
            collection(db, COLLECTION_PATH), 
            where("date", "==", today)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            setDocId(docSnap.id);
            setRundown(docSnap.data() as RundownData);
            if (docSnap.data().session) {
                setSession(docSnap.data().session);
            }
            showToast("Loaded today's existing record");
        }
    };

    const handleCarryOver = async () => {
        if (!confirm("Overwrite current items with the most recent report?")) return;
        
        try {
            const today = new Date().toISOString().split('T')[0];
            const q = query(
                collection(db, COLLECTION_PATH),
                where("date", "<", today),
                orderBy("date", "desc"),
                limit(1)
            );
            
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const prevData = snapshot.docs[0].data() as RundownData;
                const newSections = prevData.sections.map(s => ({
                    ...s,
                    items: s.items.map(i => ({ ...i, id: crypto.randomUUID(), bullets: i.bullets.map(b => ({...b, id: crypto.randomUUID()})) }))
                }));
                
                setRundown(prev => ({
                    ...prev,
                    sections: newSections
                }));
                showToast("Carried over from " + prevData.date);
            } else {
                showToast("No previous records found", 'error');
            }
        } catch (e) {
            console.error(e);
            showToast("Failed to carry over", 'error');
        }
    };

    // --- 🤖 AI LOGIC CONNECTED HERE ---
    const handleAIUpdate = (aiData: any[]) => {
        setRundown(prev => {
            const updatedSections = prev.sections.map(section => {
                const aiMatch = aiData.find((s: any) => s.sectionId === section.id);
                if (aiMatch) {
                    const newItems = aiMatch.items.map((item: any) => ({
                        id: crypto.randomUUID(),
                        projectId: '',
                        projectName: item.projectName || 'Untitled',
                        statusNote: item.statusNote || '',
                        link: item.link || '',
                        bullets: (item.bullets || []).map((b: string) => ({ id: crypto.randomUUID(), text: b }))
                    }));
                    return { ...section, items: [...section.items, ...newItems] };
                }
                return section;
            });
            return { ...prev, sections: updatedSections };
        });
        showToast("Updates added from notes");
    };

    const updateSection = (updatedSection: any) => {
        setRundown(prev => ({
            ...prev,
            sections: prev.sections.map(s => s.id === updatedSection.id ? updatedSection : s)
        }));
    };

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const generateSlackText = () => {
        const date = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        const monday = new Date(d.setDate(diff));
        
        const wcString = `W/C ${monday.getDate()} ${months[monday.getMonth()]}`;
        const todayString = `${days[date.getDay()]} ${date.getDate()}${getOrdinal(date.getDate())} ${months[date.getMonth()]}`;

        // Header
        let text = `*@channel  ${wcString}*\n`;
        text += `*${todayString}*`;
        if (session !== 'Morning') text += ` - *${session} Update*`;
        text += `\n\n`;

        // Content
        rundown.sections.forEach(section => {
            if (section.items.length === 0) return;

            text += `*${section.title}*\n`;
            section.items.forEach(item => {
                const linkPart = item.link ? `: <${item.link}|LINK>` : '';
                const statusPart = item.statusNote ? `: ${item.statusNote}` : '';
                const cleanProject = item.projectName.trim() || 'Untitled';
                
                // Bold the Project Name
                text += `*${cleanProject}*${statusPart}${linkPart}\n`;
                
                item.bullets.forEach(bullet => {
                    if (bullet.text.trim()) {
                        text += ` • ${bullet.text}\n`;
                    }
                });
            });
            text += `\n`; 
        });

        return text;
    };

    const handleCopy = async () => {
        const text = generateSlackText();
        try {
            await navigator.clipboard.writeText(text);
            showToast("Copied to clipboard");
        } catch (err) {
            showToast("Failed to copy", 'error');
        }
    };

    const handleSave = async () => {
        if (rundown.sections.every(s => s.items.length === 0)) {
            showToast("Rundown is empty", 'error');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                ...rundown,
                session,
                timestamp: serverTimestamp(),
                lastModified: new Date().toISOString()
            };

            if (docId) {
                await updateDoc(doc(db, COLLECTION_PATH, docId), payload);
                showToast("Updated today's record");
            } else {
                const ref = await addDoc(collection(db, COLLECTION_PATH), {
                    ...payload,
                    createdAt: new Date().toISOString()
                });
                setDocId(ref.id);
                showToast("Created new record");
            }
        } catch (e) {
            console.error(e);
            showToast("Save failed", 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if(confirm("Clear all items?")) {
            setRundown(prev => ({
                ...prev,
                sections: SECTIONS_CONFIG.map(s => ({ ...s, items: [] }))
            }));
        }
    }

    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return s[(v - 20) % 10] || s[v] || s[0];
    };

    const slackText = generateSlackText();

    return (
        <div className="min-h-screen bg-white text-[#1C1C1C]">
            <nav className="bg-white border-b border-[#E5E7EB] sticky top-0 z-40 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <DotGrid />
                        <span className="text-xs font-black tracking-widest uppercase text-gray-800">
                            Status<span className="text-[#21A0D8]">Report</span>
                        </span>
                        
                        <div className="hidden md:flex items-center bg-blue-50/50 rounded-lg p-1 ml-6 border border-[#21A0D8]/20">
                            {['Morning', 'Midday', 'EOD'].map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSession(s as any)}
                                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wide transition-all ${
                                        session === s 
                                        ? 'bg-[#21A0D8] text-white shadow-sm' 
                                        : 'text-[#21A0D8]/60 hover:text-[#21A0D8]'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                         <button 
                            onClick={handleCarryOver} 
                            className="px-3 py-1.5 text-[10px] font-bold text-[#21A0D8] border border-[#21A0D8]/30 rounded-md hover:bg-blue-50 transition-colors"
                        >
                            ↺ Carry Over
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-[10px] font-bold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            {isSaving ? 'Saving...' : docId ? 'Update Record' : 'Save Record'}
                        </button>
                        <button 
                            onClick={handleCopy}
                            className="px-4 py-1.5 bg-[#21A0D8] text-white rounded-md text-[10px] font-bold hover:bg-[#1C8AB6] transition-all shadow-sm flex items-center gap-2"
                        >
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                            Copy Slack
                        </button>
                    </div>
                </div>
            </nav>

            <div className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-8">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-black text-[#1C1C1C]">Today's Updates</h2>
                        <span className="text-[10px] font-bold text-[#21A0D8] uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-[#21A0D8]/20">
                            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </span>
                    </div>

                    {rundown.sections.map(section => (
                        <SectionEditor 
                            key={section.id} 
                            section={section} 
                            projects={projects}
                            onUpdate={updateSection}
                        />
                    ))}
                </div>

                <div className="lg:col-span-5 sticky top-24">
                    <div className="bg-white border border-[#21A0D8]/20 rounded-xl overflow-hidden shadow-xl shadow-[#21A0D8]/5">
                        <div className="bg-gradient-to-r from-blue-50 to-white border-b border-[#21A0D8]/10 px-4 py-3 flex items-center justify-between">
                            <h3 className="text-xs font-bold text-[#21A0D8] uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#21A0D8]"></span>
                                Live Preview
                            </h3>
                            <div className="flex gap-1.5 opacity-50">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                            </div>
                        </div>
                        <div className="p-0">
                            <SlackPreview text={slackText} />
                        </div>
                    </div>
                </div>

            </div>
            
            {/* 4. MAGIC PEN WIDGET RENDERED HERE */}
            <MagicPenWidget onAnalyze={handleAIUpdate} />

            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full bg-[#1C1C1C] text-white text-xs font-bold shadow-2xl transition-all duration-300 z-50 flex items-center gap-3 ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                 <span className={`w-2 h-2 rounded-full ${toast?.type === 'error' ? 'bg-red-500' : 'bg-[#43B049]'}`}></span>
                 {toast?.msg}
            </div>
        </div>
    );
};

export default App;
