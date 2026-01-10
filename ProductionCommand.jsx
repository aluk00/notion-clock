<!DOCTYPE html>
<html lang="en-GB">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Production Command | DMG</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root { --brand: #43B049; --ink: #1C1C1C; --border: #EAECEF; --ink-sub: #757575; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #FFFFFF; }
        body { font-family: 'Inter', sans-serif; background: #FFFFFF; padding: 12px; -webkit-font-smoothing: antialiased; }
        @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .mono { font-family: 'JetBrains Mono', monospace; letter-spacing: -0.04em; }
        .shoot-pill { cursor: pointer; transition: all 0.2s ease; }
        .shoot-pill:hover { transform: translateY(-2px); border-color: #43B049 !important; box-shadow: 0 4px 12px rgba(67,176,73,0.15); }
        .modal-overlay { animation: fadeIn 0.2s ease; }
        .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
        .status-green { background: #DCFCE7; color: #166534; }
        .status-yellow { background: #FEF9C3; color: #854D0E; }
        .status-blue { background: #DBEAFE; color: #1E40AF; }
        .status-red { background: #FEE2E2; color: #991B1B; }
        .status-gray { background: #F3F4F6; color: #374151; }
    </style>
</head>
<body>
    <div id="root"></div>

    <script type="text/babel">
        const { useState, useEffect, useMemo, useCallback, useRef } = React;

        const firebaseConfig = {
            apiKey: "AIzaSyBrV1NuvPO-_CLtQPyOhR_ERsRvE2dxDlY",
            authDomain: "dmg-command-centre-native.firebaseapp.com",
            projectId: "dmg-command-centre-native",
            storageBucket: "dmg-command-centre-native.firebasestorage.app",
            messagingSenderId: "223535956454",
            appId: "1:223535956454:web:b25e5bc69d8a4a7f209627"
        };

        const APP_ID = "dmg-command-centre-native";
        const NOTION_API = 'https://us-central1-dmg-command-centre-native.cloudfunctions.net/api';

        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        const db = firebase.firestore();
        const auth = firebase.auth();

        const toDateKey = (d) => d ? new Date(d).toISOString().split('T')[0] : null;
        const formatCurrency = (n) => `£${(n||0).toLocaleString('en-GB', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

        const getStatusColor = (status) => {
            if (!status) return 'gray';
            const s = status.toLowerCase();
            if (s.includes('complete') || s.includes('done') || s.includes('live') || s.includes('won')) return 'green';
            if (s.includes('progress') || s.includes('active') || s.includes('review')) return 'blue';
            if (s.includes('pending') || s.includes('wait') || s.includes('hold')) return 'yellow';
            if (s.includes('cancel') || s.includes('lost') || s.includes('block')) return 'red';
            return 'gray';
        };

        const DotGrid = () => (
            <div style={{display:'grid', gridTemplateColumns:'repeat(2, 6px)', gap:3, width:14, height:14}}>
                {[0,1,2,3].map(i => (
                    <span key={i} style={{
                        width:6, height:6, borderRadius:'50%', backgroundColor:'#43B049',
                        animation: `pulse 2.5s infinite ease-in-out ${i * 0.3}s`
                    }}/>
                ))}
            </div>
        );

        const Spinner = ({ text = 'SYNCING...' }) => (
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px'}}>
                <div style={{ width:32, height:32, border:'4px solid #E5E7EB', borderTopColor:'#43B049', borderRadius:'50%', animation:'spin 1s linear infinite', marginBottom:16 }}/>
                <span style={{fontSize:11, fontWeight:900, color:'#CCC', textTransform:'uppercase', letterSpacing:'0.1em'}}>{text}</span>
            </div>
        );

        const CustomDropdown = ({ value, onChange, options, placeholder, label }) => {
            const [isOpen, setIsOpen] = useState(false);
            const ref = useRef(null);
            
            useEffect(() => {
                const handleClickOutside = (e) => {
                    if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
                };
                document.addEventListener('mousedown', handleClickOutside);
                return () => document.removeEventListener('mousedown', handleClickOutside);
            }, []);

            const selectedOption = options.find(o => o.value === value);

            return (
                <div ref={ref} style={{position:'relative', width:'100%'}}>
                    {label && <div style={{fontSize:9, fontWeight:800, textTransform:'uppercase', color:'#757575', marginBottom:6, letterSpacing:'0.1em'}}>{label}</div>}
                    <div 
                        onClick={() => setIsOpen(!isOpen)}
                        style={{
                            padding:'12px 16px', background:'white', border:'1px solid #EAECEF', borderRadius:12,
                            cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center',
                            transition:'all 0.2s', borderColor: isOpen ? '#43B049' : '#EAECEF'
                        }}
                    >
                        <span style={{fontSize:12, fontWeight:700, color: selectedOption ? '#1C1C1C' : '#9CA3AF'}}>
                            {selectedOption?.label || placeholder || 'Select...'}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition:'transform 0.2s'}}>
                            <path d="M3 4.5L6 7.5L9 4.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    {isOpen && (
                        <div style={{
                            position:'absolute', top:'100%', left:0, right:0, marginTop:4, background:'white',
                            border:'1px solid #EAECEF', borderRadius:12, boxShadow:'0 10px 40px rgba(0,0,0,0.1)',
                            zIndex:100, maxHeight:240, overflowY:'auto'
                        }}>
                            {options.map((opt, i) => (
                                <div key={i}
                                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                    style={{
                                        padding:'12px 16px', cursor:'pointer', fontSize:12, fontWeight:600,
                                        background: opt.value === value ? '#F0FDF4' : 'transparent',
                                        color: opt.value === value ? '#43B049' : '#1C1C1C',
                                        borderBottom: i < options.length - 1 ? '1px solid #F3F4F6' : 'none'
                                    }}
                                >
                                    {opt.label}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            );
        };

        const TabButton = ({ active, onClick, children }) => (
            <button onClick={onClick} style={{
                flex:1, padding:'12px 16px', fontSize:11, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.08em',
                borderRadius:12, border:'none', cursor:'pointer', transition:'all 0.2s',
                background: active ? 'white' : 'transparent',
                color: active ? '#1C1C1C' : '#757575',
                boxShadow: active ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
            }}>
                {children}
            </button>
        );

        // Shoot Detail Modal - works with just shoot data OR full project data
        const ShootDetailModal = ({ shoot, project, allShoots, onClose, onOpenDesk }) => {
            if (!shoot) return null;

            // Use project data if available, otherwise fall back to shoot data
            const title = project?.title || shoot.projectTitle || shoot.title || 'Untitled';
            const client = project?.client || '';
            const projectShoots = project ? allShoots.filter(s => s.linkedProjectId === project.id) : [shoot];

            return (
                <div className="modal-overlay" onClick={onClose} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200}}>
                    <div onClick={e => e.stopPropagation()} style={{background:'white', borderRadius:24, width:'100%', maxWidth:600, maxHeight:'90vh', overflow:'hidden', boxShadow:'0 25px 50px rgba(0,0,0,0.25)'}}>
                        {/* Header */}
                        <div style={{padding:'24px 28px', borderBottom:'1px solid #EAECEF', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                            <div>
                                <div style={{fontSize:10, fontWeight:800, color:'#43B049', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4}}>{client || 'DMG'}</div>
                                <h2 style={{fontSize:20, fontWeight:900, textTransform:'uppercase', letterSpacing:'-0.02em'}}>{title}</h2>
                            </div>
                            <button onClick={onClose} style={{background:'#F3F4F6', border:'none', borderRadius:8, width:32, height:32, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"/></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{padding:'24px 28px', maxHeight:'60vh', overflowY:'auto'}}>
                            {/* Status Row */}
                            <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:24}}>
                                {project?.status && <span className={`status-badge status-${getStatusColor(project.status)}`}>{project.status}</span>}
                                {project?.dealStage && <span className={`status-badge status-${getStatusColor(project.dealStage)}`}>{project.dealStage}</span>}
                                {project?.priority && <span className="status-badge status-yellow">{project.priority}</span>}
                                {!project && <span className="status-badge status-green">{shoot.format || 'SHOOT'}</span>}
                            </div>

                            {/* Shoot Info */}
                            <div style={{marginBottom:24, padding:16, background:'#F0FDF4', borderRadius:16, borderLeft:'4px solid #43B049'}}>
                                <div style={{fontSize:10, fontWeight:800, color:'#43B049', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8}}>Scheduled Shoot</div>
                                <div style={{fontSize:16, fontWeight:900}}>
                                    {new Date(shoot.date || shoot.startDateTime).toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}
                                </div>
                                <div style={{fontSize:11, fontWeight:700, color:'#757575', marginTop:4}}>{shoot.format || 'Production Day'}</div>
                            </div>

                            {/* Workflow Statuses - only if we have project data */}
                            {project && (project.creativeWorkflowStatus || project.productionWorkflowStatus || project.socialWorkflowStatus) && (
                                <div style={{marginBottom:24}}>
                                    <div style={{fontSize:10, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12}}>Workflow Status</div>
                                    <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12}}>
                                        <div style={{padding:14, background:'#F9FAFB', borderRadius:12}}>
                                            <div style={{fontSize:8, fontWeight:800, color:'#757575', textTransform:'uppercase', marginBottom:4}}>Creative</div>
                                            <div style={{fontSize:11, fontWeight:800, color: project.creativeWorkflowStatus ? '#1C1C1C' : '#CCC'}}>{project.creativeWorkflowStatus || '—'}</div>
                                        </div>
                                        <div style={{padding:14, background:'#F9FAFB', borderRadius:12}}>
                                            <div style={{fontSize:8, fontWeight:800, color:'#757575', textTransform:'uppercase', marginBottom:4}}>Production</div>
                                            <div style={{fontSize:11, fontWeight:800, color: project.productionWorkflowStatus ? '#1C1C1C' : '#CCC'}}>{project.productionWorkflowStatus || '—'}</div>
                                        </div>
                                        <div style={{padding:14, background:'#F9FAFB', borderRadius:12}}>
                                            <div style={{fontSize:8, fontWeight:800, color:'#757575', textTransform:'uppercase', marginBottom:4}}>Social</div>
                                            <div style={{fontSize:11, fontWeight:800, color: project.socialWorkflowStatus ? '#1C1C1C' : '#CCC'}}>{project.socialWorkflowStatus || '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Team - only if we have project data with leads */}
                            {project && (project.creativeLead || project.productionLead || project.salesLead) && (
                                <div style={{marginBottom:24}}>
                                    <div style={{fontSize:10, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12}}>Team</div>
                                    <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
                                        {project.creativeLead && (
                                            <div style={{display:'flex', alignItems:'center', gap:10, padding:12, background:'#F9FAFB', borderRadius:12}}>
                                                <div style={{width:36, height:36, borderRadius:10, background:'#E6468B', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:900}}>{project.creativeLead[0]}</div>
                                                <div>
                                                    <div style={{fontSize:11, fontWeight:800}}>{project.creativeLead}</div>
                                                    <div style={{fontSize:9, fontWeight:600, color:'#757575', textTransform:'uppercase'}}>Creative Lead</div>
                                                </div>
                                            </div>
                                        )}
                                        {project.productionLead && (
                                            <div style={{display:'flex', alignItems:'center', gap:10, padding:12, background:'#F9FAFB', borderRadius:12}}>
                                                <div style={{width:36, height:36, borderRadius:10, background:'#43B049', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:900}}>{project.productionLead[0]}</div>
                                                <div>
                                                    <div style={{fontSize:11, fontWeight:800}}>{project.productionLead}</div>
                                                    <div style={{fontSize:9, fontWeight:600, color:'#757575', textTransform:'uppercase'}}>Production Lead</div>
                                                </div>
                                            </div>
                                        )}
                                        {project.salesLead && (
                                            <div style={{display:'flex', alignItems:'center', gap:10, padding:12, background:'#F9FAFB', borderRadius:12}}>
                                                <div style={{width:36, height:36, borderRadius:10, background:'#F2C316', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:900}}>{project.salesLead[0]}</div>
                                                <div>
                                                    <div style={{fontSize:11, fontWeight:800}}>{project.salesLead}</div>
                                                    <div style={{fontSize:9, fontWeight:600, color:'#757575', textTransform:'uppercase'}}>Sales Lead</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Links */}
                            {project && (project.creativeResponseUrl || project.responseDeck || project.liveLink) && (
                                <div style={{marginBottom:24}}>
                                    <div style={{fontSize:10, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12}}>Links</div>
                                    <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                                        {project.creativeResponseUrl && (
                                            <a href={project.creativeResponseUrl} target="_blank" rel="noopener noreferrer" style={{
                                                padding:'8px 14px', background:'#F3F4F6', borderRadius:8, textDecoration:'none',
                                                fontSize:10, fontWeight:800, color:'#1C1C1C', textTransform:'uppercase', display:'inline-flex', alignItems:'center', gap:6
                                            }}>
                                                📄 Creative Response
                                            </a>
                                        )}
                                        {project.responseDeck && (
                                            <a href={project.responseDeck} target="_blank" rel="noopener noreferrer" style={{
                                                padding:'8px 14px', background:'#F3F4F6', borderRadius:8, textDecoration:'none',
                                                fontSize:10, fontWeight:800, color:'#1C1C1C', textTransform:'uppercase', display:'inline-flex', alignItems:'center', gap:6
                                            }}>
                                                📊 Response Deck
                                            </a>
                                        )}
                                        {project.liveLink && (
                                            <a href={project.liveLink} target="_blank" rel="noopener noreferrer" style={{
                                                padding:'8px 14px', background:'#DCFCE7', borderRadius:8, textDecoration:'none',
                                                fontSize:10, fontWeight:800, color:'#166534', textTransform:'uppercase', display:'inline-flex', alignItems:'center', gap:6
                                            }}>
                                                🔗 Live Link
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Dates */}
                            {project && (project.dueDate || project.internalDueDate) && (
                                <div style={{marginBottom:24}}>
                                    <div style={{fontSize:10, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12}}>Dates</div>
                                    <div style={{display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:12}}>
                                        <div style={{padding:14, background:'#F9FAFB', borderRadius:12}}>
                                            <div style={{fontSize:8, fontWeight:800, color:'#757575', textTransform:'uppercase', marginBottom:4}}>Client Due</div>
                                            <div style={{fontSize:12, fontWeight:800}}>{project.dueDate ? new Date(project.dueDate).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '—'}</div>
                                        </div>
                                        <div style={{padding:14, background:'#F9FAFB', borderRadius:12}}>
                                            <div style={{fontSize:8, fontWeight:800, color:'#757575', textTransform:'uppercase', marginBottom:4}}>Internal Due</div>
                                            <div style={{fontSize:12, fontWeight:800}}>{project.internalDueDate ? new Date(project.internalDueDate).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Other Scheduled Shoots */}
                            {projectShoots.length > 1 && (
                                <div>
                                    <div style={{fontSize:10, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12}}>All Shoots for this Project</div>
                                    <div style={{display:'flex', flexDirection:'column', gap:8}}>
                                        {projectShoots.map(s => (
                                            <div key={s.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:12, background: s.id === shoot.id ? '#F0FDF4' : '#F9FAFB', borderRadius:10, borderLeft: s.id === shoot.id ? '4px solid #43B049' : '4px solid transparent'}}>
                                                <span style={{fontSize:11, fontWeight:800}}>{new Date(s.date || s.startDateTime).toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'})}</span>
                                                <span style={{fontSize:10, fontWeight:700, color:'#43B049', textTransform:'uppercase'}}>{s.format || 'Shoot'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{padding:'16px 28px', borderTop:'1px solid #EAECEF', display:'flex', gap:12}}>
                            {project?.url && (
                                <a href={project.url} target="_blank" rel="noopener noreferrer" style={{
                                    flex:1, padding:'12px', background:'#F3F4F6', borderRadius:10, textDecoration:'none',
                                    fontSize:10, fontWeight:800, color:'#1C1C1C', textTransform:'uppercase', textAlign:'center'
                                }}>
                                    Open in Notion
                                </a>
                            )}
                            {project && (
                                <button onClick={() => { onClose(); onOpenDesk(project.id); }} style={{
                                    flex:1, padding:'12px', background:'#1C1C1C', borderRadius:10, border:'none',
                                    fontSize:10, fontWeight:800, color:'white', textTransform:'uppercase', cursor:'pointer'
                                }}>
                                    Open Project Desk
                                </button>
                            )}
                            {!project && (
                                <button onClick={onClose} style={{
                                    flex:1, padding:'12px', background:'#1C1C1C', borderRadius:10, border:'none',
                                    fontSize:10, fontWeight:800, color:'white', textTransform:'uppercase', cursor:'pointer'
                                }}>
                                    Close
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        // Shoot Item
        const ShootItem = ({ shoot, onClick, small }) => {
            const displayTitle = shoot.projectTitle || shoot.title || 'Untitled Shoot';
            
            return (
                <div className="shoot-pill" 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        console.log('ShootItem clicked:', shoot); 
                        onClick(shoot); 
                    }}
                    style={{
                        padding: small ? '6px 8px' : '8px 10px',
                        background: 'white', border: '1px solid #EAECEF',
                        borderLeft: '4px solid #43B049', borderRadius: 10, marginBottom: small ? 4 : 6
                    }}
                >
                    <div style={{fontSize: small ? 9 : 10, fontWeight:900, color:'#1C1C1C', textTransform:'uppercase', lineHeight:1.2, marginBottom:2}}>
                        {displayTitle}
                    </div>
                    <div style={{fontSize: small ? 7 : 8, fontWeight:700, color:'#43B049', textTransform:'uppercase', letterSpacing:'0.02em'}}>
                        {shoot.format || 'PRODUCTION'}
                    </div>
                </div>
            );
        };

        // Day Cell
        const DayCell = ({ date, isToday, isOtherMonth, shoots, onShootClick }) => (
            <div style={{
                minHeight: 120, padding: 10, background: isToday ? '#F0FDF4' : 'white',
                borderBottom: '1px solid #EAECEF', borderRight: '1px solid #EAECEF',
                opacity: isOtherMonth ? 0.4 : 1
            }}>
                <div style={{fontSize:11, fontWeight:900, color: isToday ? '#43B049' : '#CCC', marginBottom:6}}>
                    {date.getDate()}
                </div>
                <div>
                    {shoots.map(shoot => (
                        <ShootItem key={shoot.id} shoot={shoot} onClick={onShootClick} small />
                    ))}
                </div>
            </div>
        );

        // Week Row
        const WeekRow = ({ date, isToday, shoots, onShootClick }) => (
            <div style={{
                display:'flex', gap:24, padding:20, background:'white',
                borderRadius:20, border: `1px solid ${isToday ? '#43B049' : '#EAECEF'}`, marginBottom:10
            }}>
                <div style={{width:60, textAlign:'center', flexShrink:0}}>
                    <div style={{fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', color: isToday ? '#43B049' : '#757575'}}>
                        {date.toLocaleDateString('en-GB', { weekday: 'short' })}
                    </div>
                    <div style={{fontSize:28, fontWeight:900, color: isToday ? '#43B049' : '#1C1C1C'}}>
                        {date.getDate()}
                    </div>
                </div>
                <div style={{flex:1}}>
                    {shoots.length > 0 ? shoots.map(shoot => (
                        <div key={shoot.id} className="shoot-pill" 
                            onClick={() => { console.log('Week shoot clicked:', shoot); onShootClick(shoot); }}
                            style={{ padding:16, background:'#F9FAFB', borderRadius:16, marginBottom:8, borderLeft:'4px solid #43B049', cursor:'pointer' }}>
                            <div style={{fontWeight:900, fontSize:14, textTransform:'uppercase', letterSpacing:'-0.02em', color:'#1C1C1C'}}>
                                {shoot.projectTitle || shoot.title || 'Untitled Shoot'}
                            </div>
                            <div style={{fontSize:10, fontWeight:700, color:'#43B049', textTransform:'uppercase', marginTop:4, letterSpacing:'0.05em'}}>
                                {shoot.format || 'PRODUCTION'}
                            </div>
                        </div>
                    )) : (
                        <div style={{fontSize:11, fontWeight:800, color:'#DDD', textTransform:'uppercase', letterSpacing:'0.1em', padding:'16px 0'}}>
                            No Activity Logged
                        </div>
                    )}
                </div>
            </div>
        );

        // Main App
        const ProductionCommand = () => {
            const [view, setView] = useState('month');
            const [currentDate, setCurrentDate] = useState(new Date());
            const [loading, setLoading] = useState(true);
            const [user, setUser] = useState(null);

            const [projects, setProjects] = useState([]);
            const [shoots, setShoots] = useState([]);
            const [staff, setStaff] = useState([]);
            const [deliverables, setDeliverables] = useState([]);

            const [selectedProjectId, setSelectedProjectId] = useState(null);
            const [productionRecord, setProductionRecord] = useState(null);
            
            // For the detail modal
            const [selectedShoot, setSelectedShoot] = useState(null);

            const [showInitModal, setShowInitModal] = useState(false);
            const [editingBudget, setEditingBudget] = useState(false);
            const [newBudget, setNewBudget] = useState('');

            const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);
            const projectShoots = useMemo(() => shoots.filter(s => s.linkedProjectId === selectedProjectId), [shoots, selectedProjectId]);

            // Get project for the selected shoot
            const shootProject = useMemo(() => {
                if (!selectedShoot) return null;
                return projects.find(p => p.id === selectedShoot.linkedProjectId);
            }, [selectedShoot, projects]);

            // Auth & Data
            useEffect(() => {
                auth.signInAnonymously();
                const unsubAuth = auth.onAuthStateChanged(async (u) => {
                    if (!u) return;
                    setUser(u);
                    try {
                        console.log('Fetching from Notion API...');
                        const [projRes, delRes] = await Promise.all([
                            fetch(`${NOTION_API}/projects`).then(r => r.json()),
                            fetch(`${NOTION_API}/deliverables`).then(r => r.json())
                        ]);
                        console.log('Projects loaded:', projRes);
                        console.log('Deliverables loaded:', delRes);
                        setProjects(projRes?.projects || []);
                        setDeliverables(delRes?.deliverables || []);

                        const staffSnap = await db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("staff_directory").get();
                        setStaff(staffSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '')));
                        setLoading(false);
                    } catch (err) {
                        console.error('API Error:', err);
                        setLoading(false);
                    }
                });
                return () => unsubAuth();
            }, []);

            useEffect(() => {
                if (!user) return;
                const unsub = db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("shoot_calendar_events")
                    .onSnapshot(snap => {
                        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                        console.log('Shoots from Firebase:', items);
                        setShoots(items);
                    });
                return () => unsub();
            }, [user]);

            useEffect(() => {
                if (!selectedProjectId || !user) return;
                const unsub = db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("production_records").doc(selectedProjectId)
                    .onSnapshot(snap => setProductionRecord(snap.exists ? snap.data() : { totalBudget: 0, totalSpent: 0, receipts: [], crew: [] }));
                return () => unsub();
            }, [selectedProjectId, user]);

            // Handle shoot click - ALWAYS opens modal with shoot data
            const handleShootClick = useCallback((shoot) => {
                console.log('handleShootClick called with:', shoot);
                setSelectedShoot(shoot);
            }, []);

            const handleOpenDesk = (projectId) => {
                setSelectedProjectId(projectId);
                setView('project');
            };

            const handleScheduleShoot = async () => {
                const date = document.getElementById('shootDate')?.value;
                const format = document.getElementById('shootFormat')?.value || 'Standard Shoot';
                if (!selectedProjectId || !date) return;
                await db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("shoot_calendar_events").add({
                    date, startDateTime: date, format,
                    projectTitle: selectedProject?.client ? `${selectedProject.client} - ${selectedProject.title}` : (selectedProject?.title || 'Production'),
                    linkedProjectId: selectedProjectId,
                    createdAt: new Date().toISOString()
                });
                document.getElementById('shootDate').value = '';
            };

            const handleUpdateBudget = async () => {
                if (!selectedProjectId) return;
                await db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("production_records").doc(selectedProjectId)
                    .set({ ...productionRecord, totalBudget: parseFloat(newBudget) || 0 }, { merge: true });
                setEditingBudget(false);
            };

            const handleAddReceipt = async () => {
                const title = document.getElementById('recTitle')?.value;
                const amt = parseFloat(document.getElementById('recAmt')?.value);
                if (!selectedProjectId || !title || isNaN(amt)) return;
                const newReceipts = [...(productionRecord?.receipts || []), { title, amt, date: new Date().toISOString() }];
                await db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("production_records").doc(selectedProjectId)
                    .set({ ...productionRecord, receipts: newReceipts, totalSpent: newReceipts.reduce((s, r) => s + r.amt, 0) }, { merge: true });
                document.getElementById('recTitle').value = '';
                document.getElementById('recAmt').value = '';
            };

            const handleAssignCrew = async () => {
                const role = document.getElementById('roleSelect')?.value;
                const staffId = document.getElementById('staffSelect')?.value;
                const s = staff.find(x => x.id === staffId);
                if (!selectedProjectId || !s) return;
                const name = `${s.firstName || ''} ${s.lastName || ''}`.trim();
                await db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("production_records").doc(selectedProjectId)
                    .set({ ...productionRecord, crew: [...(productionRecord?.crew || []), { name, role, staffId }] }, { merge: true });
            };

            const handleInitProduction = async () => {
                const id = document.getElementById('modalProjectSelect')?.value;
                const budget = parseFloat(document.getElementById('modalBudget')?.value) || 0;
                if (!id) return;
                await db.collection("artifacts").doc(APP_ID).collection("public").doc("data").collection("production_records").doc(id)
                    .set({ totalBudget: budget, totalSpent: 0, receipts: [], crew: [] });
                setSelectedProjectId(id);
                setView('project');
                setShowInitModal(false);
            };

            // Calendar
            const getShootsForDate = useCallback((date) => {
                const dateStr = date.toISOString().split('T')[0];
                return shoots.filter(s => {
                    const targetDate = s.date || s.shootDate || s.dueDate || (s.startDateTime ? s.startDateTime.split('T')[0] : null);
                    return targetDate === dateStr;
                });
            }, [shoots]);

            const calendarDays = useMemo(() => {
                const year = currentDate.getFullYear(), month = currentDate.getMonth();
                const firstDay = new Date(year, month, 1), lastDay = new Date(year, month + 1, 0);
                const startOffset = (firstDay.getDay() + 6) % 7;
                const days = [], today = toDateKey(new Date());
                const prevMonth = new Date(year, month, 0);
                for (let i = startOffset - 1; i >= 0; i--) {
                    const d = new Date(year, month - 1, prevMonth.getDate() - i);
                    days.push({ date: d, isOtherMonth: true, isToday: false });
                }
                for (let d = 1; d <= lastDay.getDate(); d++) {
                    const date = new Date(year, month, d);
                    days.push({ date, isOtherMonth: false, isToday: toDateKey(date) === today });
                }
                const remaining = (7 - (days.length % 7)) % 7;
                for (let i = 1; i <= remaining; i++) {
                    const d = new Date(year, month + 1, i);
                    days.push({ date: d, isOtherMonth: true, isToday: false });
                }
                return days;
            }, [currentDate]);

            const weekDays = useMemo(() => {
                const start = new Date(currentDate), day = start.getDay();
                start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
                const today = toDateKey(new Date()), days = [];
                for (let i = 0; i < 7; i++) {
                    const date = new Date(start); date.setDate(start.getDate() + i);
                    days.push({ date, isToday: toDateKey(date) === today });
                }
                return days;
            }, [currentDate]);

            const navMonth = (delta) => { const d = new Date(currentDate); d.setMonth(d.getMonth() + delta); setCurrentDate(d); };
            const navWeek = (delta) => { const d = new Date(currentDate); d.setDate(d.getDate() + delta); setCurrentDate(d); };

            const projectOptions = useMemo(() => [
                { value: '', label: 'Select Project...' },
                ...projects.map(p => ({ value: p.id, label: `${p.client || 'DMG'} – ${p.title || 'Untitled'}` }))
            ], [projects]);

            const staffOptions = useMemo(() => staff.map(s => ({ value: s.id, label: `${s.firstName || ''} ${s.lastName || ''}`.trim() })), [staff]);

            const roleOptions = [
                { value: 'Lead Producer', label: 'Lead Producer' },
                { value: 'Director', label: 'Director' },
                { value: 'Camera Op', label: 'Camera Op / DP' },
                { value: 'Editor', label: 'Video Editor' },
                { value: 'Designer', label: 'Graphic Designer' },
                { value: 'Creative Lead', label: 'Creative Lead' },
            ];

            const formatOptions = [
                { value: 'Standard Shoot', label: 'Standard Shoot' },
                { value: 'Recce', label: 'Recce / Scout' },
                { value: 'Travel', label: 'Travel Day' },
                { value: 'Live', label: 'Live Stream' },
            ];

            if (loading) return (
                <div style={{background:'white', borderRadius:20, border:'1px solid #EAECEF', minHeight:500}}>
                    <Spinner text="SYNCING WITH NOTION..." />
                </div>
            );

            const budget = productionRecord?.totalBudget || 0;
            const spent = productionRecord?.totalSpent || 0;

            return (
                <div style={{background:'white', borderRadius:20, border:'1px solid #EAECEF', overflow:'hidden', maxWidth:1200, margin:'0 auto'}}>
                    {/* Header */}
                    <header style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', borderBottom:'1px solid #EAECEF', background:'white'}}>
                        <div style={{display:'flex', alignItems:'center', gap:12}}>
                            <DotGrid />
                            <span style={{fontSize:11, fontWeight:900, letterSpacing:'0.1em', textTransform:'uppercase', color:'#1C1C1C'}}>PRODUCTION COMMAND</span>
                        </div>
                        <button onClick={() => setShowInitModal(true)} style={{
                            padding:'10px 16px', background:'white', border:'1px solid #EAECEF', borderRadius:10,
                            fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', cursor:'pointer'
                        }}>
                            + Initialise Project
                        </button>
                    </header>

                    {/* Tabs */}
                    <nav style={{display:'flex', gap:8, padding:8, background:'#F9FAFB', borderBottom:'1px solid #EAECEF'}}>
                        <TabButton active={view === 'month'} onClick={() => setView('month')}>Calendar View</TabButton>
                        <TabButton active={view === 'week'} onClick={() => setView('week')}>Weekly Workflow</TabButton>
                        <TabButton active={view === 'project'} onClick={() => setView('project')}>Project Desk</TabButton>
                    </nav>

                    {/* Month View */}
                    {view === 'month' && (
                        <div style={{background:'white'}}>
                            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px'}}>
                                <button onClick={() => navMonth(-1)} style={{background:'none', border:'none', fontSize:11, fontWeight:800, color:'#CCC', cursor:'pointer'}}>← PREVIOUS</button>
                                <h2 style={{fontSize:13, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.08em', color:'#43B049'}}>
                                    {currentDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                                </h2>
                                <button onClick={() => navMonth(1)} style={{background:'none', border:'none', fontSize:11, fontWeight:800, color:'#CCC', cursor:'pointer'}}>NEXT →</button>
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', borderBottom:'1px solid #EAECEF', background:'#F9FAFB'}}>
                                {['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => (
                                    <div key={d} style={{padding:'10px 0', textAlign:'center', fontSize:9, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.1em'}}>{d}</div>
                                ))}
                            </div>
                            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)'}}>
                                {calendarDays.map((day, i) => (
                                    <DayCell key={i} date={day.date} isToday={day.isToday} isOtherMonth={day.isOtherMonth}
                                        shoots={getShootsForDate(day.date)} onShootClick={handleShootClick} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Week View */}
                    {view === 'week' && (
                        <div style={{padding:24, background:'white', minHeight:450}}>
                            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, maxWidth:900, margin:'0 auto 20px'}}>
                                <button onClick={() => navWeek(-7)} style={{padding:'10px 16px', background:'white', border:'1px solid #EAECEF', borderRadius:10, fontSize:10, fontWeight:800, textTransform:'uppercase', cursor:'pointer'}}>← Prev Week</button>
                                <h2 style={{fontSize:11, fontWeight:900, textTransform:'uppercase', letterSpacing:'0.08em'}}>
                                    Week Commencing {weekDays[0]?.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </h2>
                                <button onClick={() => navWeek(7)} style={{padding:'10px 16px', background:'white', border:'1px solid #EAECEF', borderRadius:10, fontSize:10, fontWeight:800, textTransform:'uppercase', cursor:'pointer'}}>Next Week →</button>
                            </div>
                            <div style={{maxWidth:900, margin:'0 auto'}}>
                                {weekDays.map((day, i) => (
                                    <WeekRow key={i} date={day.date} isToday={day.isToday} shoots={getShootsForDate(day.date)} onShootClick={handleShootClick} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Project View */}
                    {view === 'project' && (
                        <div style={{display:'flex', flexDirection:'column', height:650, background:'white'}}>
                            <div style={{padding:'20px 24px', borderBottom:'1px solid #EAECEF', display:'flex', alignItems:'flex-end', justifyContent:'space-between'}}>
                                <div style={{width:350}}>
                                    <CustomDropdown 
                                        label="Active Project"
                                        value={selectedProjectId || ''}
                                        onChange={(v) => setSelectedProjectId(v || null)}
                                        options={projectOptions}
                                        placeholder="Select Project..."
                                    />
                                </div>
                                <div style={{textAlign:'right'}}>
                                    <div style={{fontSize:10, fontWeight:800, color:'#43B049', textTransform:'uppercase', letterSpacing:'0.08em'}}>{selectedProject?.client || '-'}</div>
                                    <div style={{fontSize:22, fontWeight:900, textTransform:'uppercase', letterSpacing:'-0.02em'}}>{selectedProject?.title || 'Select Project'}</div>
                                </div>
                            </div>

                            <div style={{flex:1, overflow:'auto', padding:20, background:'white'}}>
                                {selectedProjectId ? (
                                    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
                                        {/* Left Column */}
                                        <div>
                                            {/* Budget Card */}
                                            <div style={{background:'white', border:'1px solid #EAECEF', borderRadius:20, padding:20, marginBottom:16}}>
                                                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
                                                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                                                        <span style={{width:20, height:20, background:'#43B049', color:'white', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900}}>1</span>
                                                        <span style={{fontSize:10, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.08em'}}>Finance</span>
                                                    </div>
                                                    <button onClick={() => { setEditingBudget(!editingBudget); setNewBudget(budget); }}
                                                        style={{background:'none', border:'none', fontSize:10, fontWeight:800, color:'#43B049', textTransform:'uppercase', cursor:'pointer'}}>
                                                        {editingBudget ? 'Cancel' : 'Edit'}
                                                    </button>
                                                </div>
                                                {editingBudget ? (
                                                    <div style={{display:'flex', gap:8, marginBottom:16}}>
                                                        <input type="number" value={newBudget} onChange={(e) => setNewBudget(e.target.value)}
                                                            style={{flex:1, padding:'10px 12px', background:'white', border:'1px solid #EAECEF', borderRadius:10, fontWeight:700}} placeholder="Budget..."/>
                                                        <button onClick={handleUpdateBudget} style={{padding:'10px 16px', background:'#1C1C1C', color:'white', border:'none', borderRadius:10, fontSize:10, fontWeight:800, textTransform:'uppercase', cursor:'pointer'}}>Save</button>
                                                    </div>
                                                ) : (
                                                    <div style={{marginBottom:12}}>
                                                        <span className="mono" style={{fontSize:36, fontWeight:900}}>{formatCurrency(budget)}</span>
                                                        <span style={{fontSize:10, fontWeight:800, color:'#CCC', marginLeft:8, textTransform:'uppercase'}}>Allocated</span>
                                                    </div>
                                                )}
                                                <div style={{height:8, background:'#F3F4F6', borderRadius:4, overflow:'hidden', marginBottom:16}}>
                                                    <div style={{height:'100%', background:'#43B049', width:`${budget > 0 ? Math.min((spent/budget)*100, 100) : 0}%`, transition:'width 0.5s'}}/>
                                                </div>
                                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                                                    <div style={{padding:14, background:'#F9FAFB', borderRadius:12}}>
                                                        <div style={{fontSize:9, fontWeight:800, color:'#EF4444', textTransform:'uppercase', marginBottom:4}}>Spent</div>
                                                        <div className="mono" style={{fontSize:18, fontWeight:900}}>{formatCurrency(spent)}</div>
                                                    </div>
                                                    <div style={{padding:14, background:'#F9FAFB', borderRadius:12}}>
                                                        <div style={{fontSize:9, fontWeight:800, color:'#757575', textTransform:'uppercase', marginBottom:4}}>Balance</div>
                                                        <div className="mono" style={{fontSize:18, fontWeight:900}}>{formatCurrency(budget - spent)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Receipts */}
                                            <div style={{background:'white', border:'1px solid #EAECEF', borderRadius:20, padding:20}}>
                                                <div style={{fontSize:10, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12}}>Expenditure</div>
                                                <div style={{maxHeight:140, overflow:'auto', marginBottom:12}}>
                                                    {productionRecord?.receipts?.length > 0 ? productionRecord.receipts.map((r, i) => (
                                                        <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 10px', background:'#F9FAFB', borderRadius:8, marginBottom:6}}>
                                                            <span style={{fontSize:10, fontWeight:800, textTransform:'uppercase'}}>{r.title}</span>
                                                            <span className="mono" style={{fontSize:11, fontWeight:700}}>{formatCurrency(r.amt)}</span>
                                                        </div>
                                                    )) : <div style={{fontSize:10, color:'#CCC', fontStyle:'italic', textAlign:'center', padding:16}}>No expenses</div>}
                                                </div>
                                                <div style={{display:'flex', gap:8, marginBottom:8}}>
                                                    <input id="recTitle" placeholder="Item" style={{flex:1, padding:'10px 12px', background:'white', border:'1px solid #EAECEF', borderRadius:10, fontSize:11, fontWeight:600}}/>
                                                    <input id="recAmt" type="number" placeholder="£" style={{width:80, padding:'10px 12px', background:'white', border:'1px solid #EAECEF', borderRadius:10, fontSize:11, fontWeight:600}}/>
                                                </div>
                                                <button onClick={handleAddReceipt} style={{width:'100%', padding:'12px', background:'#1C1C1C', color:'white', border:'none', borderRadius:10, fontSize:10, fontWeight:800, textTransform:'uppercase', cursor:'pointer'}}>Add Expense</button>
                                            </div>
                                        </div>
                                        {/* Right Column */}
                                        <div>
                                            {/* Schedule */}
                                            <div style={{background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:20, padding:20, marginBottom:16}}>
                                                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:16}}>
                                                    <span style={{width:20, height:20, background:'#43B049', color:'white', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900}}>2</span>
                                                    <span style={{fontSize:10, fontWeight:800, color:'#43B049', textTransform:'uppercase', letterSpacing:'0.08em'}}>Schedule</span>
                                                </div>
                                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
                                                    <input type="date" id="shootDate" style={{padding:'12px 14px', background:'white', border:'1px solid #EAECEF', borderRadius:10, fontSize:11, fontWeight:600}}/>
                                                    <CustomDropdown value="Standard Shoot" onChange={(v) => document.getElementById('shootFormat').value = v} options={formatOptions} />
                                                    <input type="hidden" id="shootFormat" defaultValue="Standard Shoot" />
                                                </div>
                                                <button onClick={handleScheduleShoot} style={{width:'100%', padding:'12px', background:'#43B049', color:'white', border:'none', borderRadius:10, fontSize:10, fontWeight:800, textTransform:'uppercase', cursor:'pointer'}}>Add Shoot</button>
                                                <div style={{marginTop:12}}>
                                                    {projectShoots.map(s => (
                                                        <div key={s.id} style={{display:'flex', justifyContent:'space-between', fontSize:10, fontWeight:700, color:'#43B049', background:'white', padding:'10px 12px', borderRadius:10, marginTop:6}}>
                                                            <span>{new Date(s.date || s.startDateTime).toLocaleDateString('en-GB', { weekday:'short', day: 'numeric', month: 'short' })}</span>
                                                            <span style={{textTransform:'uppercase'}}>{s.format || 'Shoot'}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* Crew */}
                                            <div style={{background:'white', border:'1px solid #EAECEF', borderRadius:20, padding:20}}>
                                                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:16}}>
                                                    <span style={{width:20, height:20, background:'#43B049', color:'white', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:900}}>3</span>
                                                    <span style={{fontSize:10, fontWeight:800, color:'#757575', textTransform:'uppercase', letterSpacing:'0.08em'}}>Crew</span>
                                                </div>
                                                <div style={{maxHeight:120, overflow:'auto', marginBottom:16}}>
                                                    {productionRecord?.crew?.length > 0 ? productionRecord.crew.map((c, i) => (
                                                        <div key={i} style={{display:'flex', alignItems:'center', gap:10, padding:'10px 12px', background:'#F9FAFB', borderRadius:12, marginBottom:6}}>
                                                            <div style={{width:36, height:36, borderRadius:10, background:'#F0FDF4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900, color:'#43B049'}}>{(c.name||'?')[0]}</div>
                                                            <div>
                                                                <div style={{fontSize:12, fontWeight:800, textTransform:'uppercase'}}>{c.name}</div>
                                                                <div style={{fontSize:9, fontWeight:600, color:'#757575', textTransform:'uppercase'}}>{c.role}</div>
                                                            </div>
                                                        </div>
                                                    )) : <div style={{fontSize:10, color:'#CCC', fontStyle:'italic', textAlign:'center', padding:16}}>No crew assigned</div>}
                                                </div>
                                                <div style={{marginBottom:12}}>
                                                    <CustomDropdown value="" onChange={(v) => document.getElementById('staffSelect').value = v} options={staffOptions} placeholder="Select Team Member..." />
                                                    <input type="hidden" id="staffSelect" />
                                                </div>
                                                <div style={{marginBottom:12}}>
                                                    <CustomDropdown value="Lead Producer" onChange={(v) => document.getElementById('roleSelect').value = v} options={roleOptions} />
                                                    <input type="hidden" id="roleSelect" defaultValue="Lead Producer" />
                                                </div>
                                                <button onClick={handleAssignCrew} style={{width:'100%', padding:'12px', background:'#1C1C1C', color:'white', border:'none', borderRadius:10, fontSize:10, fontWeight:800, textTransform:'uppercase', cursor:'pointer'}}>Assign to Project</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%'}}>
                                        <div style={{textAlign:'center'}}>
                                            <div style={{fontSize:48, marginBottom:12}}>📋</div>
                                            <div style={{fontSize:11, fontWeight:800, color:'#CCC', textTransform:'uppercase', letterSpacing:'0.1em'}}>Select a project to view details</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Shoot Detail Modal */}
                    {selectedShoot && (
                        <ShootDetailModal 
                            shoot={selectedShoot}
                            project={shootProject}
                            allShoots={shoots}
                            onClose={() => setSelectedShoot(null)} 
                            onOpenDesk={handleOpenDesk}
                        />
                    )}

                    {/* Init Modal */}
                    {showInitModal && (
                        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100}}>
                            <div style={{background:'white', borderRadius:20, padding:32, width:'100%', maxWidth:400}}>
                                <h3 style={{fontSize:18, fontWeight:900, textTransform:'uppercase', marginBottom:4}}>Initialise Production</h3>
                                <p style={{fontSize:10, color:'#757575', fontWeight:600, marginBottom:24, textTransform:'uppercase', letterSpacing:'0.08em'}}>Connect project to environment</p>
                                <div style={{marginBottom:16}}>
                                    <CustomDropdown 
                                        label="Project"
                                        value=""
                                        onChange={(v) => document.getElementById('modalProjectSelect').value = v}
                                        options={projectOptions}
                                        placeholder="Select Project..."
                                    />
                                    <input type="hidden" id="modalProjectSelect" />
                                </div>
                                <div style={{marginBottom:24}}>
                                    <div style={{fontSize:9, fontWeight:800, textTransform:'uppercase', color:'#757575', marginBottom:6, letterSpacing:'0.1em'}}>Budget</div>
                                    <input id="modalBudget" type="number" style={{width:'100%', padding:'12px 14px', background:'white', border:'1px solid #EAECEF', borderRadius:12, fontSize:12, fontWeight:600}} placeholder="£0.00"/>
                                </div>
                                <div style={{display:'flex', gap:12}}>
                                    <button onClick={() => setShowInitModal(false)} style={{flex:1, padding:'14px', background:'white', border:'1px solid #EAECEF', borderRadius:12, fontSize:10, fontWeight:800, textTransform:'uppercase', cursor:'pointer'}}>Cancel</button>
                                    <button onClick={handleInitProduction} style={{flex:1, padding:'14px', background:'#1C1C1C', color:'white', border:'none', borderRadius:12, fontSize:10, fontWeight:800, textTransform:'uppercase', cursor:'pointer'}}>Confirm</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(<ProductionCommand />);
    </script>
</body>
</html>