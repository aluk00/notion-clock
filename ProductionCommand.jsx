import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc, getDocs, addDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBrV1NuvPO-_CLtQPyOhR_ERsRvE2dxDlY",
  authDomain: "dmg-command-centre-native.firebaseapp.com",
  projectId: "dmg-command-centre-native",
  storageBucket: "dmg-command-centre-native.firebasestorage.app",
  messagingSenderId: "223535956454",
  appId: "1:223535956454:web:b25e5bc69d8a4a7f209627"
};

const APP_ID = "dmg-command-centre-native";
const NOTION_API_URL = 'https://createnotionproject-223535956454.us-central1.run.app';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ============================================
// STYLES (Tailwind-like inline for portability)
// ============================================
const colors = {
  primary: '#43B049',
  ink: '#1C1C1C',
  inkSub: '#757575',
  border: '#E5E7EB',
  bgSoft: '#F9FAFB',
  surface: '#FFFFFF',
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const toDateKey = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
};

const formatCurrency = (amount) => {
  return `£${(amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ============================================
// COMPONENTS
// ============================================

// Animated Dot Grid
const DotGrid = () => (
  <div className="grid grid-cols-2 gap-1" style={{ width: 14, height: 14 }}>
    {[0, 1, 2, 3].map(i => (
      <span
        key={i}
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: colors.primary,
          animation: `pulse 2.5s infinite ease-in-out ${i * 0.3}s`,
        }}
      />
    ))}
  </div>
);

// Loading Spinner
const Spinner = ({ text = 'SYNCING...' }) => (
  <div className="flex flex-col items-center justify-center py-20">
    <div
      className="w-8 h-8 border-4 border-gray-200 rounded-full mb-4"
      style={{ borderTopColor: colors.primary, animation: 'spin 1s linear infinite' }}
    />
    <span className="text-xs font-black text-gray-300 uppercase tracking-widest">{text}</span>
  </div>
);

// Tab Button
const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wide rounded-xl transition-all ${
      active
        ? 'bg-white text-gray-900 shadow-sm'
        : 'bg-transparent text-gray-400 hover:text-gray-600'
    }`}
  >
    {children}
  </button>
);

// Shoot Pill (Draggable)
const ShootPill = ({ shoot, onDragStart, onClick }) => (
  <div
    draggable
    onDragStart={(e) => onDragStart(e, shoot)}
    onClick={() => onClick(shoot.linkedProjectId)}
    className="text-xs font-bold px-3 py-2 bg-white border border-gray-200 rounded-lg mb-1 cursor-grab active:cursor-grabbing hover:border-green-500 hover:shadow-md transition-all"
    style={{ borderLeftWidth: 3, borderLeftColor: colors.primary }}
  >
    {shoot.projectTitle || 'Production'}
  </div>
);

// Calendar Day Cell
const DayCell = ({ date, isToday, isOtherMonth, shoots, onDrop, onDragOver, onShootClick, onDragStart }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
        onDragOver(e);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        onDrop(e, date);
      }}
      className={`min-h-28 p-3 bg-white border-b border-r border-gray-100 transition-colors ${
        isToday ? 'bg-green-50' : ''
      } ${isOtherMonth ? 'bg-gray-50' : ''} ${isDragOver ? 'bg-green-100' : ''}`}
    >
      <div className={`text-xs font-black mb-2 ${isToday ? 'text-green-600' : isOtherMonth ? 'text-gray-300' : 'text-gray-400'}`}>
        {date.getDate()}
      </div>
      <div className="space-y-1">
        {shoots.map(shoot => (
          <ShootPill
            key={shoot.id}
            shoot={shoot}
            onDragStart={onDragStart}
            onClick={onShootClick}
          />
        ))}
      </div>
    </div>
  );
};

// Week Day Row
const WeekDayRow = ({ date, isToday, shoots, onDrop, onDragOver, onShootClick, onDragStart }) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
        onDragOver(e);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        onDrop(e, date);
      }}
      className={`flex gap-6 p-6 bg-white rounded-3xl border transition-all ${
        isToday ? 'border-green-500 bg-green-50/30' : 'border-gray-100'
      } ${isDragOver ? 'border-green-500 bg-green-100' : ''}`}
    >
      <div className="w-16 text-center shrink-0">
        <div className={`text-xs font-black uppercase tracking-widest ${isToday ? 'text-green-600' : 'text-gray-400'}`}>
          {date.toLocaleDateString('en-GB', { weekday: 'short' })}
        </div>
        <div className={`text-3xl font-black ${isToday ? 'text-green-600' : 'text-gray-900'}`}>
          {date.getDate()}
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {shoots.length > 0 ? (
          shoots.map(shoot => (
            <div
              key={shoot.id}
              draggable
              onDragStart={(e) => onDragStart(e, shoot)}
              onClick={() => onShootClick(shoot.linkedProjectId)}
              className="p-5 bg-gray-50 rounded-2xl cursor-pointer hover:bg-white border-l-4 border-l-green-500 transition-all"
            >
              <div className="font-black text-lg uppercase tracking-tight">{shoot.projectTitle || 'Production'}</div>
              <div className="text-xs text-gray-400 font-bold uppercase mt-1 tracking-widest">{shoot.format || 'Shoot'}</div>
            </div>
          ))
        ) : (
          <div className="text-xs text-gray-300 font-black uppercase tracking-widest py-4">No Activity Logged</div>
        )}
      </div>
    </div>
  );
};

// Budget Card
const BudgetCard = ({ budget, spent, onUpdateBudget }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [newBudget, setNewBudget] = useState(budget);
  const remaining = budget - spent;
  const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  const handleSave = () => {
    onUpdateBudget(parseFloat(newBudget) || 0);
    setIsEditing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 bg-green-500 text-white rounded-md flex items-center justify-center text-xs font-black">1</span>
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Finance Dashboard</span>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs font-black text-green-600 uppercase hover:underline"
        >
          {isEditing ? 'Cancel' : 'Modify Budget'}
        </button>
      </div>

      {isEditing ? (
        <div className="flex gap-3 mb-6">
          <input
            type="number"
            value={newBudget}
            onChange={(e) => setNewBudget(e.target.value)}
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold"
            placeholder="Enter budget..."
          />
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-5xl font-black font-mono">{formatCurrency(budget)}</span>
          <span className="text-xs font-black text-gray-300 uppercase tracking-widest">Allocated</span>
        </div>
      )}

      <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-green-500 transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 bg-gray-50 rounded-2xl">
          <div className="text-xs font-black text-red-500 uppercase mb-1 tracking-widest">Spent</div>
          <div className="text-2xl font-black font-mono">{formatCurrency(spent)}</div>
        </div>
        <div className="p-5 bg-gray-50 rounded-2xl">
          <div className="text-xs font-black text-gray-400 uppercase mb-1 tracking-widest">Balance</div>
          <div className="text-2xl font-black font-mono">{formatCurrency(remaining)}</div>
        </div>
      </div>
    </div>
  );
};

// Receipt Form
const ReceiptForm = ({ onAddReceipt }) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      setFileName(f.name);
      const reader = new FileReader();
      reader.onload = (ev) => setFile(ev.target.result);
      reader.readAsDataURL(f);
    }
  };

  const handleSubmit = () => {
    if (!title || !amount) return;
    onAddReceipt({
      title,
      amt: parseFloat(amount),
      data: file,
      date: new Date().toISOString(),
    });
    setTitle('');
    setAmount('');
    setFile(null);
    setFileName('');
  };

  return (
    <div className="p-5 bg-gray-50 rounded-2xl space-y-3">
      <div className="flex gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Item Name"
          className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold"
        />
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="£"
          className="w-28 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold"
        />
      </div>
      <div className="flex gap-3 items-center">
        <label className="flex-1 cursor-pointer">
          <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileChange} />
          <div className={`text-xs font-black uppercase tracking-widest pb-1 border-b border-dashed ${fileName ? 'text-green-600 border-green-300' : 'text-gray-400 border-gray-300'}`}>
            {fileName ? `📄 ${fileName}` : '📎 Attach PDF / IMAGE'}
          </div>
        </label>
        <button
          onClick={handleSubmit}
          className="px-5 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase"
        >
          Log Entry
        </button>
      </div>
    </div>
  );
};

// Receipt List
const ReceiptList = ({ receipts }) => (
  <div className="space-y-2 max-h-52 overflow-y-auto">
    {receipts?.length > 0 ? (
      receipts.map((r, i) => (
        <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-xs font-black uppercase flex items-center gap-2">
            {r.title}
            {r.data && <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded">ATTACHMENT</span>}
          </span>
          <span className="text-sm font-black font-mono">{formatCurrency(r.amt)}</span>
        </div>
      ))
    ) : (
      <div className="text-center py-4 text-xs text-gray-300 font-bold italic">No expenses logged</div>
    )}
  </div>
);

// Crew List
const CrewList = ({ crew }) => (
  <div className="space-y-3 max-h-80 overflow-y-auto">
    {crew?.length > 0 ? (
      crew.map((c, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100">
          <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-sm font-black text-green-600">
            {(c.name || '?')[0]}
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-tight">{c.name}</div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{c.role}</div>
          </div>
        </div>
      ))
    ) : (
      <div className="text-center py-6 text-xs text-gray-300 font-black uppercase tracking-widest">No Crew Assigned</div>
    )}
  </div>
);

// Crew Assignment Form
const CrewForm = ({ staff, onAssign }) => {
  const [isFreelance, setIsFreelance] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [freelanceName, setFreelanceName] = useState('');
  const [role, setRole] = useState('Lead Producer');

  const roles = ['Lead Producer', 'Director', 'Camera Op / DP', 'Video Editor', 'Graphic Design', 'Audio Op', 'Creative Lead'];

  const handleAssign = () => {
    const name = isFreelance ? freelanceName : staff.find(s => s.id === selectedStaff)?.firstName + ' ' + staff.find(s => s.id === selectedStaff)?.lastName;
    if (!name?.trim()) return;
    onAssign({ name: name.trim(), role, isFreelance });
    setFreelanceName('');
  };

  return (
    <div className="space-y-3 pt-5 border-t border-gray-100">
      <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
        <input
          type="checkbox"
          checked={isFreelance}
          onChange={(e) => setIsFreelance(e.target.checked)}
          className="w-4 h-4 accent-green-500"
        />
        <span className="text-xs font-black text-gray-500 uppercase tracking-widest">External Freelancer</span>
      </label>

      {isFreelance ? (
        <input
          type="text"
          value={freelanceName}
          onChange={(e) => setFreelanceName(e.target.value)}
          placeholder="Enter Full Name..."
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold"
        />
      ) : (
        <select
          value={selectedStaff}
          onChange={(e) => setSelectedStaff(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold appearance-none"
        >
          <option value="">Select Staff...</option>
          {staff.map(s => (
            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
          ))}
        </select>
      )}

      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold appearance-none"
      >
        {roles.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <button
        onClick={handleAssign}
        className="w-full py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase"
      >
        Assign Role
      </button>
    </div>
  );
};

// Schedule Shoot Form
const ScheduleForm = ({ onSchedule }) => {
  const [date, setDate] = useState('');
  const [format, setFormat] = useState('Standard Shoot');

  const formats = ['Standard Shoot', 'Recce / Scout', 'Travel Day', 'Live Stream'];

  const handleSubmit = () => {
    if (!date) return;
    onSchedule({ date, format });
    setDate('');
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold"
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold appearance-none"
        >
          {formats.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <button
        onClick={handleSubmit}
        className="w-full py-3 bg-green-500 text-white rounded-xl text-xs font-black uppercase"
      >
        Add to Programme
      </button>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export default function ProductionCommand() {
  // State
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // Data
  const [projects, setProjects] = useState([]);
  const [shoots, setShoots] = useState([]);
  const [staff, setStaff] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  
  // Selected project
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [productionRecord, setProductionRecord] = useState(null);
  
  // Drag state
  const [draggedShoot, setDraggedShoot] = useState(null);
  
  // Modal
  const [showInitModal, setShowInitModal] = useState(false);

  // Selected project data
  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const projectShoots = useMemo(() =>
    shoots.filter(s => s.linkedProjectId === selectedProjectId),
    [shoots, selectedProjectId]
  );

  const projectDeliverables = useMemo(() =>
    deliverables.filter(d => d.projectId === selectedProjectId),
    [deliverables, selectedProjectId]
  );

  // Auth & Data Loading
  useEffect(() => {
    signInAnonymously(auth);
    
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      setUser(u);
      
      try {
        // Load projects from Notion API
        const projRes = await fetch(`${NOTION_API_URL}/projects`);
        const projData = await projRes.json();
        setProjects(projData?.projects || []);
        
        // Load deliverables
        const delRes = await fetch(`${NOTION_API_URL}/deliverables`);
        const delData = await delRes.json();
        setDeliverables(delData?.deliverables || []);
        
        // Load staff from Firebase
        const staffSnap = await getDocs(collection(db, "artifacts", APP_ID, "public", "data", "staff_directory"));
        const staffList = staffSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        staffList.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
        setStaff(staffList);
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setLoading(false);
      }
    });

    return () => unsubAuth();
  }, []);

  // Listen to shoots
  useEffect(() => {
    if (!user) return;
    
    const unsubShoots = onSnapshot(
      collection(db, "artifacts", APP_ID, "public", "data", "shoot_calendar_events"),
      (snap) => {
        setShoots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    return () => unsubShoots();
  }, [user]);

  // Listen to production record when project selected
  useEffect(() => {
    if (!selectedProjectId || !user) return;
    
    const unsubRecord = onSnapshot(
      doc(db, "artifacts", APP_ID, "public", "data", "production_records", selectedProjectId),
      (snap) => {
        if (snap.exists()) {
          setProductionRecord(snap.data());
        } else {
          setProductionRecord({ totalBudget: 0, totalSpent: 0, receipts: [], crew: [] });
        }
      }
    );

    return () => unsubRecord();
  }, [selectedProjectId, user]);

  // Handlers
  const handleDragStart = (e, shoot) => {
    setDraggedShoot(shoot);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, newDate) => {
    e.preventDefault();
    if (!draggedShoot) return;
    
    const newDateKey = toDateKey(newDate);
    
    // Update in Firebase
    await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "shoot_calendar_events", draggedShoot.id), {
      date: newDateKey,
      startDateTime: newDateKey,
    });
    
    setDraggedShoot(null);
  };

  const handleShootClick = (projectId) => {
    if (projectId) {
      setSelectedProjectId(projectId);
      setView('project');
    }
  };

  const handleScheduleShoot = async ({ date, format }) => {
    if (!selectedProjectId) return;
    
    await addDoc(collection(db, "artifacts", APP_ID, "public", "data", "shoot_calendar_events"), {
      date,
      startDateTime: date,
      format,
      projectTitle: selectedProject?.title || 'Production',
      linkedProjectId: selectedProjectId,
      createdAt: new Date().toISOString(),
    });
  };

  const handleUpdateBudget = async (newBudget) => {
    if (!selectedProjectId) return;
    await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "production_records", selectedProjectId), {
      totalBudget: newBudget,
    });
  };

  const handleAddReceipt = async (receipt) => {
    if (!selectedProjectId) return;
    const newReceipts = [...(productionRecord?.receipts || []), receipt];
    await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "production_records", selectedProjectId), {
      receipts: newReceipts,
      totalSpent: newReceipts.reduce((sum, r) => sum + r.amt, 0),
    });
  };

  const handleAssignCrew = async (crewMember) => {
    if (!selectedProjectId) return;
    const newCrew = [...(productionRecord?.crew || []), crewMember];
    await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "production_records", selectedProjectId), {
      crew: newCrew,
    });
  };

  const handleInitProduction = async (projectId, budget) => {
    await setDoc(doc(db, "artifacts", APP_ID, "public", "data", "production_records", projectId), {
      totalBudget: budget,
      totalSpent: 0,
      receipts: [],
      crew: [],
    });
    setSelectedProjectId(projectId);
    setView('project');
    setShowInitModal(false);
  };

  // Calendar generation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    
    const days = [];
    const today = toDateKey(new Date());
    
    // Previous month days
    const prevMonth = new Date(year, month, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonth.getDate() - i);
      days.push({ date: d, isOtherMonth: true, isToday: false });
    }
    
    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        isOtherMonth: false,
        isToday: toDateKey(date) === today,
      });
    }
    
    // Next month days
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isOtherMonth: true, isToday: false });
    }
    
    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const today = toDateKey(new Date());
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({
        date,
        isToday: toDateKey(date) === today,
      });
    }
    
    return days;
  }, [currentDate]);

  const getShootsForDate = useCallback((date) => {
    const dateKey = toDateKey(date);
    return shoots.filter(s => {
      const shootDate = s.date || s.startDateTime;
      return toDateKey(shootDate) === dateKey;
    });
  }, [shoots]);

  // Navigation
  const navMonth = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const navWeek = (delta) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta);
    setCurrentDate(newDate);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-200 shadow-lg min-h-[600px] flex items-center justify-center">
        <Spinner text="SYNCING WITH NOTION..." />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <DotGrid />
        <button
          onClick={() => setShowInitModal(true)}
          className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-wide hover:bg-gray-50 transition-colors"
        >
          + Initialise Project
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex gap-2 p-2 bg-gray-50 border-b border-gray-100">
        <TabButton active={view === 'month'} onClick={() => setView('month')}>Calendar View</TabButton>
        <TabButton active={view === 'week'} onClick={() => setView('week')}>Weekly Workflow</TabButton>
        <TabButton active={view === 'project'} onClick={() => setView('project')}>Project Desk</TabButton>
      </nav>

      {/* Month View */}
      {view === 'month' && (
        <div>
          <div className="flex items-center justify-between px-6 py-4 bg-white">
            <button onClick={() => navMonth(-1)} className="text-xs font-black text-gray-300 hover:text-gray-900 transition-colors">
              ← PREVIOUS
            </button>
            <h2 className="text-sm font-black uppercase tracking-widest text-green-600">
              {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={() => navMonth(1)} className="text-xs font-black text-gray-300 hover:text-gray-900 transition-colors">
              NEXT →
            </button>
          </div>
          
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {d}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => (
              <DayCell
                key={i}
                date={day.date}
                isToday={day.isToday}
                isOtherMonth={day.isOtherMonth}
                shoots={getShootsForDate(day.date)}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onShootClick={handleShootClick}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="p-8 bg-gray-50 min-h-[500px]">
          <div className="flex items-center justify-between mb-6 max-w-4xl mx-auto">
            <button onClick={() => navWeek(-7)} className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase">
              ← Prev Week
            </button>
            <h2 className="text-xs font-black uppercase tracking-widest">
              Week Commencing {weekDays[0]?.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </h2>
            <button onClick={() => navWeek(7)} className="px-5 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase">
              Next Week →
            </button>
          </div>
          
          <div className="space-y-4 max-w-4xl mx-auto">
            {weekDays.map((day, i) => (
              <WeekDayRow
                key={i}
                date={day.date}
                isToday={day.isToday}
                shoots={getShootsForDate(day.date)}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onShootClick={handleShootClick}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </div>
      )}

      {/* Project Desk View */}
      {view === 'project' && (
        <div className="flex flex-col h-[700px]">
          {/* Project Header */}
          <div className="px-8 py-6 bg-white border-b border-gray-100 flex items-end justify-between shrink-0">
            <div className="w-96">
              <div className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Active Project Environment</div>
              <select
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold appearance-none"
              >
                <option value="">Select Project Entry...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.client || 'DMG'} – {p.title || 'Untitled'}</option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-green-600 uppercase tracking-widest mb-1">
                {selectedProject?.client || '-'}
              </div>
              <div className="text-3xl font-black uppercase tracking-tight">
                {selectedProject?.title || 'Select Project'}
              </div>
            </div>
          </div>

          {/* Project Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            {selectedProjectId ? (
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-6">
                  <BudgetCard
                    budget={productionRecord?.totalBudget || 0}
                    spent={productionRecord?.totalSpent || 0}
                    onUpdateBudget={handleUpdateBudget}
                  />
                  
                  <div className="bg-white border border-gray-200 rounded-3xl p-6">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Expenditure Records</div>
                    <ReceiptList receipts={productionRecord?.receipts} />
                    <div className="mt-4">
                      <ReceiptForm onAddReceipt={handleAddReceipt} />
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-green-500 text-white rounded-md flex items-center justify-center text-xs font-black">2</span>
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Asset Deliverables</span>
                    </div>
                    <div className="space-y-2">
                      {projectDeliverables.length > 0 ? (
                        projectDeliverables.map((d, i) => (
                          <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                            <span className="text-sm font-black uppercase tracking-tight">{d.name || d.title || 'Untitled'}</span>
                            <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{d.status || 'Active'}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-gray-300 font-bold italic text-center py-4">No linked assets in Notion.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div className="bg-green-50/50 border border-green-200 rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-green-500 text-white rounded-md flex items-center justify-center text-xs font-black">3</span>
                      <span className="text-xs font-black text-green-600 uppercase tracking-widest">Production Schedule</span>
                    </div>
                    <ScheduleForm onSchedule={handleScheduleShoot} />
                    <div className="mt-4 space-y-2">
                      {projectShoots.map(s => (
                        <div key={s.id} className="flex justify-between text-xs font-black text-green-600 bg-white p-3 rounded-xl border border-green-100">
                          <span>{new Date(s.date || s.startDateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                          <span className="uppercase tracking-widest">{s.format || 'Shoot'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-3xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-6 h-6 bg-green-500 text-white rounded-md flex items-center justify-center text-xs font-black">4</span>
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Assigned Crew</span>
                    </div>
                    <CrewList crew={productionRecord?.crew} />
                    <CrewForm staff={staff} onAssign={handleAssignCrew} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-6xl mb-4">📋</div>
                  <div className="text-sm font-black text-gray-400 uppercase tracking-widest">Select a project to view details</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Init Modal */}
      {showInitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-10 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-black uppercase mb-2 tracking-tight">Initialise Production</h3>
            <p className="text-xs text-gray-400 font-bold mb-8 uppercase tracking-widest">Connect Notion Ledger to Environment</p>
            
            <InitForm
              projects={projects}
              onSubmit={handleInitProduction}
              onCancel={() => setShowInitModal(false)}
            />
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Init Form Component
function InitForm({ projects, onSubmit, onCancel }) {
  const [projectId, setProjectId] = useState('');
  const [budget, setBudget] = useState('');

  return (
    <div className="space-y-4">
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold appearance-none"
      >
        <option value="">Choose Ledger Entry...</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.client || 'DMG'} – {p.title || 'Untitled'}</option>
        ))}
      </select>
      
      <input
        type="number"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        placeholder="Programme Budget (£)"
        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold"
      />
      
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase"
        >
          Cancel
        </button>
        <button
          onClick={() => projectId && onSubmit(projectId, parseFloat(budget) || 0)}
          className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
