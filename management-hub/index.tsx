// Fix: Add a global interface to declare custom properties on the Window object.
declare global {
    interface Window {
        changeWeek: (offset: number) => void;
        selectDay: (idx: number) => void;
        jumpToToday: () => void;
        showStatusList: (statusType: string) => void;
        openApprovalWorkspace: (mgrId: string) => void;
        openStaffProfile: (staffId: string) => void;
        openPatternEditor: (name: string, weekCommencing: string, mountId?: string) => void;
        saveOverride: (buttonEl: HTMLButtonElement, name: string, weekCommencing: string) => Promise<void>;
        handleAction: (buttonEl: HTMLButtonElement, name: string, status: string, staffId: string) => Promise<void>;
        postNote: (buttonEl: HTMLButtonElement, target: string, team: string) => Promise<void>;
        closeModal: () => void;
        switchView: (v: string, btn: HTMLElement) => void;
    }
}
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getFirestore, collection, onSnapshot, doc, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
    import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

    // CANONICAL: Use Admin Control Centre's Firebase project config.
    const firebaseConfig = {
      apiKey: "AIzaSyBrV1NuvPO-_CLtQPyOhR_ERsRvE2dxDlY",
      authDomain: "dmg-command-centre-native.firebaseapp.com",
      projectId: "dmg-command-centre-native",
      storageBucket: "dmg-command-centre-native.firebasestorage.app",
      messagingSenderId: "223535956454",
      appId: "1:223535956454:web:b25e5bc69d8a4a7f209627",
      measurementId: "G-5HNGPRJGZY"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    // CANONICAL: Use Admin Control Centre's artifact root ID.
    const appId = "dmg-command-centre-native";

    let staffList: any[] = [];
    let rotaRequests: any[] = [];
    let rotaResponses: any[] = [];
    let staffNotes: any[] = [];

    const teamColors: { [key: string]: string } = { Editorial: '#E94B4B', Creative: '#E6468B', Production: '#43B049', Social: '#F2C316', Operations: '#21a0d8', Executive: '#1C1C1C' };
    const statusColors: { [key: string]: string } = { Office: '#2E7D32', WFH: '#F9A825', Shoot: '#2196F3', PTO: '#F44336', 'Client / Travel': '#6A1B9A', Leave: '#F44336', Weekend: '#9E9E9E', Pending: '#BDBDBD' };
    
    const teamHomepages: { [key: string]: string } = {
        Creative: "https://www.notion.so/WIP_CREATIVE-2c8b73e3901e80658e12fcbaf07a01a7?source=copy_link",
        Operations: "https://www.notion.so/WIP_PEOPLE-2ceb73e3901e80c291f5deb9ca8505a7?source=copy_link",
        Production: "https://www.notion.so/WIP_PRODUCTION-2c8b73e3901e80388954fb6e14c43b73?source=copy_link",
        Social: "https://www.notion.so/WIP_SOCIAL-2c8b73e3901e80bf9c3ce8f15629cfd5?source=copy_link",
        Editorial: "https://www.notion.so/WIP_EDITORIAL-2c8b73e3901e8090a2a0d09615970b79?source=copy_link"
    };

    const statusIcons: { [key: string]: string } = {
        Office: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 16H9v-2h2v2zm0-4H9v-2h2v2zm0-4H9V9h2v2zm0-4H9V5h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm4 8h-2v-2h2v2zm0-4h-2v-2h2v2z"/></svg>`,
        WFH: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"/></svg>`,
        Shoot: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 20v-2h14v2H5zm0-3v-2h2.08l.92-3H6v-2h3.33l.92-3H8V5h8v2h-2.25l-.92 3H16v2h-2.25l-.92 3H15v2H5z"/></svg>`,
        'Client / Travel': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
        PTO: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
        Leave: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
        Weekend: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>`,
        Pending: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg>`
    };

    function getStatusIcon(status: string) {
        const iconSvg = statusIcons[status] || statusIcons['Pending'];
        const color = statusColors[status.replace(/ /g, '')] || statusColors.Pending;
        return `<div class="status-icon" title="${status}" style="background-color: ${color}20; color: ${color};">${iconSvg}</div>`;
    }

    const getTodayIndex = () => {
        const day = new Date().getDay(); // 0=sun, 1=mon, ..., 6=sat
        return day === 0 ? 6 : day - 1; // Mon=0, Tue=1, ..., Sun=6
    };

    function getInitialMonday(): Date {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
        
        if (dayOfWeek === 0) { // If today is Sunday, forecast to next Monday
            today.setDate(today.getDate() + 1);
        } else { // Otherwise, go to this week's Monday
            const offset = dayOfWeek - 1; 
            today.setDate(today.getDate() - offset);
        }
        today.setHours(0, 0, 0, 0);
        return today;
    }
    
    let currentMonday = getInitialMonday();
    let selectedDayIdx = new Date().getDay() === 0 ? 0 : getTodayIndex();
    let pin = "";
    let listenersInitialised = false; // Guard to prevent duplicate listeners.

    const clearPin = () => {
        pin = "";
        document.querySelectorAll('.pin-dot').forEach(d => d.classList.remove('filled'));
    };
    
    const press = (n: number) => {
        if (pin.length >= 4) return;
        pin += n;
        (document.getElementById('p'+pin.length) as HTMLElement).classList.add('filled');
        if(pin.length === 4) {
            setTimeout(() => {
                if(pin === "2025") {
                    (document.getElementById('lock-screen') as HTMLElement).style.opacity = '0';
                    setTimeout(() => { 
                        (document.getElementById('lock-screen') as HTMLElement).classList.add('hidden'); 
                        (document.getElementById('app-shell') as HTMLElement).classList.remove('hidden'); 
                    }, 500);
                } else { 
                    clearPin();
                }
            }, 200);
        }
    };

    function setupPinPad() {
        document.querySelector('.numpad')?.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            const button = target.closest('.n-btn');
            if (button) {
                const value = (button as HTMLElement).dataset.value;
                if (value === 'clear') {
                    clearPin();
                } else if (value) {
                    press(parseInt(value, 10));
                }
            }
        });

        document.addEventListener('keydown', (event) => {
            const lockScreen = document.getElementById('lock-screen');
            if (lockScreen && !lockScreen.classList.contains('hidden')) {
                const key = event.key;
                let buttonToAnimate: HTMLElement | null = null;
                
                if (key >= '0' && key <= '9') {
                    press(parseInt(key, 10));
                    buttonToAnimate = document.querySelector(`.n-btn[data-value="${key}"]`);
                } else if (key === 'Backspace' || key === 'Delete') {
                    clearPin();
                    buttonToAnimate = document.querySelector('.n-btn[data-value="clear"]');
                }

                if (buttonToAnimate) {
                    event.preventDefault();
                    buttonToAnimate.classList.add('n-btn--active');
                    setTimeout(() => { 
                        buttonToAnimate?.classList.remove('n-btn--active');
                    }, 150);
                }
            }
        });
    }
    setupPinPad();

    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', () => window.jumpToToday());
    }

    onAuthStateChanged(auth, (user) => {
        if (user && !listenersInitialised) {
            console.log("Authenticated. Initialising Firestore listeners...");
            listenersInitialised = true;
            
            onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'staff_directory'), 
                (snap) => { 
                    staffList = []; 
                    snap.forEach(d => staffList.push({id: d.id, ...d.data()})); 
                    updateUI(); 
                },
                (error) => { console.error("Error fetching staff_directory:", error); }
            );

            onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'rota_requests'), 
                (snap) => { 
                    rotaRequests = []; 
                    snap.forEach(d => rotaRequests.push(d.data())); 
                    updateUI(); 
                },
                (error) => { console.error("Error fetching rota_requests:", error); }
            );
            
            onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'rota_responses'), 
                (snap) => { 
                    rotaResponses = []; 
                    snap.forEach(d => rotaResponses.push({id: d.id, ...d.data()})); 
                    updateUI(); 
                },
                (error) => { console.error("Error fetching rota_responses:", error); }
            );

            onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'staff_notes'), 
                (snap) => { 
                    staffNotes = []; 
                    snap.forEach(d => staffNotes.push({id: d.id, ...d.data()})); 
                    updateUI(); 
                },
                (error) => { console.error("Error fetching staff_notes:", error); }
            );
        } else if (!user) {
            console.log("User not signed in. Waiting for authentication.");
            listenersInitialised = false;
        }
    });
    
    signInAnonymously(auth).catch((error) => console.error("Anonymous sign-in failed:", error));

    function updateUI() {
        currentMonday.setHours(0,0,0,0);
        
        const weekEndDate = new Date(currentMonday);
        weekEndDate.setDate(weekEndDate.getDate() + 6);
        const startDateFormatted = currentMonday.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
        const endDateFormatted = weekEndDate.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
        
        (document.getElementById('wc-label') as HTMLElement).innerHTML = `<span class="wc-prefix">W/C</span> ${startDateFormatted} - ${endDateFormatted}`;
        
        renderDayScroller();
        renderOutlook();
        renderTeamsGrid();
        renderApprovals();
    }

    window.changeWeek = (offset: number) => { currentMonday.setDate(currentMonday.getDate() + (offset * 7)); updateUI(); };
    window.selectDay = (idx: number) => { selectedDayIdx = idx; updateUI(); };
    
    window.jumpToToday = () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const mondayOfCurrentWeek = new Date(today);
        mondayOfCurrentWeek.setDate(today.getDate() - offset);
        mondayOfCurrentWeek.setHours(0, 0, 0, 0);
        
        currentMonday = mondayOfCurrentWeek;
        selectedDayIdx = getTodayIndex();
        updateUI();
    };

    function renderDayScroller() {
        const mount = document.getElementById('day-mount') as HTMLElement;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        mount.innerHTML = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d, i) => {
            const date = new Date(currentMonday.getTime());
            date.setDate(date.getDate() + i);
            
            const isToday = date.getTime() === today.getTime();
            const todayClass = isToday ? 'is-today' : '';

            return `<div class="day-pill ${selectedDayIdx === i ? 'active' : ''} ${todayClass}" onclick="selectDay(${i})">${d.substring(0,3)} ${date.getDate()} ${date.toLocaleDateString('en-GB', {month:'short'})}</div>`;
        }).join('');
    }

    function renderOutlook() {
        const mount = document.getElementById('directory-mount') as HTMLElement;
        if (staffList.length === 0) {
            mount.innerHTML = `<tr><td colspan="4" class="table-loader">Loading Directory...</td></tr>`;
            return;
        }

        const wcStr = currentMonday.toISOString().split('T')[0];
        const viewedDate = new Date(currentMonday);
        viewedDate.setDate(viewedDate.getDate() + selectedDayIdx);
        const isViewedDayWeekend = (viewedDate.getDay() === 0 || viewedDate.getDay() === 6);

        const table = (document.getElementById('view-outlook') as HTMLElement).querySelector('.directory-table') as HTMLTableElement;
        if (table) {
            const headerCell = table.rows[0].cells[3];
            if (headerCell) {
                headerCell.innerHTML = `Status for ${viewedDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}`;
            }
        }

        const weekendLockedCards = ['Office', 'WFH', 'Leave'];
        const allCards = ['Office', 'WFH', 'Shoot', 'OffSite', 'Leave'];
        allCards.forEach(id => {
            const card = document.getElementById(`card-${id}`) as HTMLElement;
            if (card) {
                const isLocked = isViewedDayWeekend && weekendLockedCards.includes(id);
                card.classList.toggle('locked', isLocked);
            }
        });

        const counts = { Office: 0, WFH: 0, Shoot: 0, OffSite: 0, Leave: 0 };
        
        mount.innerHTML = staffList.sort((a,b) => a.firstName.localeCompare(b.firstName)).map(s => {
            const fullName = `${s.firstName} ${s.lastName}`;
            const sub = rotaRequests.find(sub => sub.staffName === fullName && sub.weekCommencing === wcStr);
            let rawStatus = 'Office';
            if (sub && sub.schedule && sub.schedule[selectedDayIdx]) {
                rawStatus = sub.schedule[selectedDayIdx].status;
            }

            let status = isViewedDayWeekend ? 'Weekend' : (rawStatus || 'Office');

            if (isViewedDayWeekend) {
                 if (['Shoot', 'Client / Travel'].includes(rawStatus)) {
                     status = rawStatus;
                 }
            }

            let countKey = ['PTO','Leave','Abroad'].includes(status) ? 'Leave' 
                         : status === 'Shoot' ? 'Shoot'
                         : status === 'Client / Travel' ? 'OffSite'
                         : status;
            
            if (counts[countKey as keyof typeof counts] !== undefined) {
                 counts[countKey as keyof typeof counts]++;
            }

            let displayStatus = status;
            
            const color = teamColors[s.team] || '#CCC';
            const dots = `<div class="name-dots">${Array(4).fill(`<span style="background:${color}"></span>`).join('')}</div>`;
            return `<tr>
                        <td class="name-cell" onclick="openStaffProfile('${s.id}')">${dots} <span>${fullName} ${s.isManager ? '<span class="is-mgr-pill">MGR</span>' : ''}</span></td>
                        <td class="role-cell">${s.role}</td>
                        <td class="stream-cell" style="color:${color};">${s.team}</td>
                        <td class="status-cell">${getStatusIcon(displayStatus)}</td>
                    </tr>`;
        }).join('');

        (document.getElementById('count-office') as HTMLElement).innerText = String(isViewedDayWeekend ? 0 : counts.Office);
        (document.getElementById('count-wfh') as HTMLElement).innerText = String(isViewedDayWeekend ? 0 : counts.WFH);
        (document.getElementById('count-shoot') as HTMLElement).innerText = String(counts.Shoot);
        (document.getElementById('count-offsite') as HTMLElement).innerText = String(counts.OffSite);
        (document.getElementById('count-leave') as HTMLElement).innerText = String(isViewedDayWeekend ? 0 : counts.Leave);
    }

    function renderTeamsGrid() {
        const mount = document.getElementById('teams-grid-mount') as HTMLElement;
        if (staffList.length === 0) {
            mount.innerHTML = `<div class="table-loader">Loading Team Schedules...</div>`;
            return;
        }

        const wcStr = currentMonday.toISOString().split('T')[0];
        const dayHeaders = Array.from({ length: 7 }).map((_, i) => {
            const date = new Date(currentMonday);
            date.setDate(date.getDate() + i);
            const dayName = date.toLocaleDateString('en-GB', { weekday: 'short' });
            const dayOfMonth = date.getDate();
            return `<th class="status-cell-grid status-cell-grid-header">${dayName} ${dayOfMonth}</th>`;
        }).join('');

        mount.innerHTML = ['Editorial', 'Production', 'Creative', 'Social', 'Operations', 'Executive'].map(v => {
            const members = staffList.filter(s => s.team === v);
            if(members.length === 0) return "";
            const vCol = teamColors[v];
            const homeLink = teamHomepages[v];
            const homeIcon = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z"/></svg>`;
            const homeButton = homeLink ? `<a href="${homeLink}" target="_blank" class="team-home-btn" style="background-color: ${vCol}">${homeIcon}</a>` : '';

            return `<div class="team-block">
                        <div class="stream-header">
                            <div class="stream-header-title">
                                <div class="stream-dot" style="background:${vCol}"></div>
                                <span>${v} Stream</span>
                            </div>
                            ${homeButton}
                        </div>
                        <table class="directory-table">
                            <thead><tr><th>Name</th>${dayHeaders}</tr></thead>
                            <tbody>${members.sort((a,b)=>a.firstName.localeCompare(b.firstName)).map(m => {
                                const sub = rotaRequests.find(s => s.staffName === `${m.firstName} ${m.lastName}` && s.weekCommencing === wcStr);
                                
                                let weeklySchedule = (sub && sub.schedule) ? [...sub.schedule] : Array(7).fill({ status: 'Pending' });
                                while (weeklySchedule.length < 7) {
                                    weeklySchedule.push({ status: weeklySchedule.length < 5 ? 'Pending' : 'Weekend' });
                                }
                                
                                const color = teamColors[m.team] || '#CCC';
                                const dots = `<div class="name-dots">${Array(4).fill(`<span style="background:${color}"></span>`).join('')}</div>`;
                                const fullName = `${m.firstName} ${m.lastName}`;

                                return `<tr>
                                    <td class="name-cell name-cell-teams" onclick="openStaffProfile('${m.id}')">
                                        ${dots}
                                        <div class="name-role-container">
                                            <span class="name-text">${fullName}</span>
                                            <span class="role-text-inline">${m.role}</span>
                                        </div>
                                    </td>
                                    ${weeklySchedule.map((day: any) => {
                                        return `<td class="status-cell-grid">${getStatusIcon(day.status || 'Pending')}</td>`
                                    }).join('')}
                                </tr>`;
                            }).join('')}</tbody>
                        </table>
                    </div>`;
        }).join('');
    }

    function renderApprovals() {
        const mount = document.getElementById('approvals-mount') as HTMLElement;
        if (staffList.length === 0) {
            mount.innerHTML = `<div class="table-loader">Loading Manager Approvals...</div>`;
            return;
        }

        const wcStr = currentMonday.toISOString().split('T')[0];
        mount.innerHTML = staffList.filter(s => s.isManager).sort((a,b) => a.firstName.localeCompare(b.firstName)).map(m => {
            const name = `${m.firstName} ${m.lastName}`;
            const reports = staffList.filter(s => s.manager === name);
            if(reports.length === 0) return "";
            
            const pendingCount = reports.filter(r => {
                const fName = `${r.firstName} ${r.lastName}`;
                const hasResp = rotaResponses.some(res => res.staffName === fName && res.weekCommencing === wcStr && res.status === 'Approved');
                return !hasResp;
            }).length;

            const accent = teamColors[m.team] || '#1C1C1C';
            let specialClass = '';
            if (name.includes('Ellie')) specialClass = 'manager-card-ellie';
            if (name.includes('Nathan')) specialClass = 'manager-card-nathan';

            return `<div class="manager-card ${specialClass}" style="--accent-color: ${accent}" onclick="openApprovalWorkspace('${m.id}')"><div class="mgr-name">${name}</div><div class="mgr-pending-alert ${pendingCount > 0 ? 'urgent' : 'all-clear'}">${pendingCount > 0 ? `${pendingCount} Pending Action${pendingCount > 1 ? 's' : ''}` : 'All Clear'}</div></div>`;
        }).join('');
    }
    
    window.showStatusList = (statusType: string) => {
        const mount = document.getElementById('modal-mount') as HTMLElement;
        mount.innerHTML = `<div class="modal-loader"><div class="header-dots">${Array(4).fill(`<div class="dot"></div>`).join('')}</div></div>`;
        (document.getElementById('global-modal') as HTMLElement).classList.add('active');

        setTimeout(() => {
            const viewedDate = new Date(currentMonday);
            viewedDate.setDate(viewedDate.getDate() + selectedDayIdx);
            const isViewedDayWeekend = (viewedDate.getDay() === 0 || viewedDate.getDay() === 6);
            
            if (isViewedDayWeekend && !['Shoot', 'OffSite'].includes(statusType)) {
                window.closeModal();
                return;
            }

            const wcStr = currentMonday.toISOString().split('T')[0];
            
            const staffWithStatus = staffList.map(s => {
                const fullName = `${s.firstName} ${s.lastName}`;
                const sub = rotaRequests.find(sub => sub.staffName === fullName && sub.weekCommencing === wcStr);
                const status = (sub && sub.schedule[selectedDayIdx]) ? sub.schedule[selectedDayIdx].status : 'Office';
                return { ...s, currentStatus: status };
            }).filter(s => {
                if (statusType === 'Leave') return ['PTO', 'Leave', 'Abroad'].includes(s.currentStatus);
                if (statusType === 'Shoot') return s.currentStatus === 'Shoot';
                if (statusType === 'OffSite') return s.currentStatus === 'Client / Travel';
                return s.currentStatus === statusType;
            });

            const dotsHTML = `<div class="status-modal-dots">${Array(4).fill(`<span></span>`).join('')}</div>`;

            mount.innerHTML = `
                <div class="close-btn" onclick="closeModal()">×</div>
                <div class="modal-body">
                    <div class="status-modal-header">
                        <span class="status-modal-title-prefix">Status</span>
                        ${dotsHTML}
                        <span class="status-modal-title-main">${statusType}</span>
                    </div>
                    <div style="font-size:10px; font-weight:800; color:#999; text-transform:uppercase; margin-bottom:20px;">For ${viewedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
                    <div>
                        ${staffWithStatus.length > 0 ? staffWithStatus.map(s => {
                            let detail = s.team;
                            let isStreamDetail = true;

                            if (statusType === 'Leave') { detail = "PTO"; isStreamDetail = false; }
                            if (s.currentStatus === 'PTO' && Math.random() > 0.8) { detail = "Sick Day"; isStreamDetail = false; }
                            if (statusType === 'Shoot' || statusType === 'OffSite') { detail = Math.random() > 0.5 ? "Full Day" : "9am - 1pm"; isStreamDetail = false; }
                            
                            const detailStyle = isStreamDetail ? `style="color: ${teamColors[s.team]}; font-weight: 700;"` : '';

                            return `
                            <div class="status-list-item">
                                <span class="status-list-name" onclick="openStaffProfile('${s.id}')">${s.firstName} ${s.lastName}</span>
                                <span class="status-list-detail" ${detailStyle}>${detail}</span>
                            </div>`;
                        }).join('') : `<div style="text-align:center; padding: 20px; color: var(--ink-sub);">No staff members with this status today.</div>`}
                    </div>
                </div>
            `;
        }, 100);
    };

    window.openApprovalWorkspace = (mgrId: string) => {
        const mount = document.getElementById('modal-mount') as HTMLElement;
        const manager = staffList.find(s => s.id === mgrId);
        if (!manager) return;
        
        const accent = teamColors[manager.team] || '#1C1C1C';
        mount.innerHTML = `<div class="modal-loader"><div class="header-dots">${Array(4).fill(`<div class="dot" style="background-color:${accent}"></div>`).join('')}</div></div>`;
        (document.getElementById('global-modal') as HTMLElement).classList.add('active');

        setTimeout(() => {
            const wcStr = currentMonday.toISOString().split('T')[0];
            const mgrName = `${manager.firstName} ${manager.lastName}`;
            const reports = staffList.filter(s => s.manager === mgrName).sort((a,b) => a.firstName.localeCompare(b.firstName));

            mount.innerHTML = `
                <div class="close-btn" onclick="closeModal()">×</div>
                <div class="modal-content-with-accent" style="--modal-accent-color: ${accent};">
                    <div class="modal-body">
                        <div class="modal-header-stacked">
                            <h2 class="modal-mgr-name">${mgrName}</h2>
                            <div class="modal-sub-title" style="color: ${accent};">Team Workspace</div>
                        </div>
                        ${reports.map(r => {
                            const fName = `${r.firstName} ${r.lastName}`;
                            const sub = rotaRequests.find(s => s.staffName === fName && s.weekCommencing === wcStr);
                            const resp = rotaResponses.find(res => res.staffName === fName && res.weekCommencing === wcStr);
                            const statusColor = resp ? (resp.status === 'Approved' ? 'var(--st-office)' : 'var(--team-editorial)') : '#BBB';

                            return `
                            <div class="request-item">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                    <div class="request-name-link" onclick="openStaffProfile('${r.id}')">${fName}</div>
                                    <span style="font-size:9px; font-weight:900; text-transform:uppercase; color:${statusColor}">${resp ? resp.status : 'Awaiting Submission'}</span>
                                </div>
                                ${sub ? `
                                    <div class="week-strip">
                                        ${sub.schedule.slice(0,5).map((d: any, i: number) => {
                                            const statusKey = (d.status || 'Pending').replace(/ /g,'');
                                            const color = statusColors[statusKey] || statusColors.Pending;
                                            return `<div class="day-box" style="background-color:${color}20; color:${color}"><span class="d-label">${['M','T','W','T','F'][i]}</span><span class="d-val">${d.status.charAt(0)}</span></div>`
                                        }).join('')}
                                    </div>
                                    ${!resp ? `
                                        <textarea id="comment-${r.id}" class="comment-box" placeholder="Add feedback..."></textarea>
                                        <div class="action-row">
                                            <button class="btn-action btn-approve" onclick="handleAction(this, '${fName}', 'Approved', '${r.id}')">Accept</button>
                                            <button class="btn-action btn-deny" onclick="handleAction(this, '${fName}', 'Denied', '${r.id}')">Deny</button>
                                        </div>
                                    ` : `<div style="font-size:12px; color:#999; padding: 10px; background: #fafafa; border-radius: 8px;">Logged: ${resp.comment || 'No comment.'}</div>`}
                                ` : `
                                    <div style="font-size:12px; color:var(--team-editorial); margin: 15px 0;">No rota request logged for this week.</div>
                                    <button class="pill-btn pill-suggest" onclick="openPatternEditor('${fName}', '${wcStr}', 'editor-mount-${r.id}')">Suggest Working Pattern</button>
                                `}
                                <div id="editor-mount-${r.id}"></div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }, 100);
    };

    window.openStaffProfile = (staffId: string) => {
        const mount = document.getElementById('modal-mount') as HTMLElement;
        const s = staffList.find(x => x.id === staffId);
        if (!s) return;

        const teamCol = teamColors[s.team];
        mount.innerHTML = `<div class="modal-loader"><div class="header-dots">${Array(4).fill(`<div class="dot" style="background-color:${teamCol}"></div>`).join('')}</div></div>`;
        (document.getElementById('global-modal') as HTMLElement).classList.add('active');

        setTimeout(() => {
            const fullName = `${s.firstName} ${s.lastName}`;
            const wcStr = currentMonday.toISOString().split('T')[0];
            const sub = rotaRequests.find(sub => sub.staffName === fullName && sub.weekCommencing === wcStr);
            const status = sub && sub.schedule[selectedDayIdx] ? sub.schedule[selectedDayIdx].status : 'Pending';
            const statusKey = status.replace(/ /g, '');
            const color = statusColors[statusKey] || statusColors.Pending;
            
            const manager = staffList.find(x => x.fullName === s.manager);
            const managerColor = manager ? teamColors[manager.team] : 'var(--ink)';

            const weeks = [-7, 0, 7].map(offset => { const d = new Date(currentMonday); d.setDate(d.getDate() + offset); return d.toISOString().split('T')[0]; });

            mount.innerHTML = `
                <div class="close-btn" onclick="closeModal()">×</div>
                <div class="modal-body">
                    <div style="display:flex; align-items:center; gap:25px; border-bottom:1.5px solid var(--border); padding-bottom:25px; margin-bottom: 25px;">
                        <div class="p-grid-large">${Array(4).fill(`<span style="background:${teamCol}"></span>`).join('')}</div>
                        <div>
                            <h1 style="margin:0; font-size:32px; font-weight:900; letter-spacing:-0.03em;">${fullName}</h1>
                            <div style="color:#999; font-weight:700; text-transform:uppercase; font-size:11px; letter-spacing:0.05em; margin-top:4px;">${s.role} • <span style="color:${teamCol}">${s.team} Stream</span></div>
                        </div>
                    </div>
                    <div class="p-meta">
                        <div class="p-meta-card"><span class="p-meta-label">Status for this day</span><div class="p-meta-val" style="color:${color}">${status}</div></div>
                        <div class="p-meta-card"><span class="p-meta-label">Direct Manager</span><div class="p-meta-val" style="color:${managerColor};">${s.manager}</div></div>
                        <div class="p-meta-card"><span class="p-meta-label">Employee Tier</span><div class="p-meta-val grey">${s.seniority || 'Staff'}</div></div>
                    </div>
                    <div class="p-section-title">Presence Timeline</div>
                    <table class="presence-table">
                        <thead><tr><th>Week</th><th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th><th>S</th><th>Action</th></tr></thead>
                        <tbody>
                            ${weeks.map((w, index) => {
                                const sW = rotaRequests.find(sub => sub.staffName === fullName && sub.weekCommencing === w);
                                const isPriorWeek = index === 0;
                                const weekDate = new Date(w);
                                const label = index === 0 ? 'Prior' : index === 1 ? 'Current' : 'Next';
                                const dateString = `W/C ${weekDate.toLocaleDateString('en-GB', {day: 'numeric', month: 'short'})}`;
                                
                                const weekLabel = index > 0 
                                    ? `${label} <span style="color: ${teamCol}">${dateString}</span>`
                                    : `${label} ${dateString}`;

                                let scheduleCellsHtml;
                                if (sW && Array.isArray(sW.schedule)) {
                                    let scheduleDays = [...sW.schedule];
                                    while (scheduleDays.length < 7) {
                                        scheduleDays.push({ status: scheduleDays.length < 5 ? 'Pending' : 'Weekend' });
                                    }
                                    
                                    scheduleCellsHtml = scheduleDays.map((d: any) => {
                                        const statusKey = (d.status || 'Pending').replace(/ /g,'');
                                        const color = statusColors[statusKey] || statusColors.Pending;
                                        return `<td style="color:${color}">${d.status.charAt(0)}</td>`;
                                    }).join('');
                                } else {
                                    scheduleCellsHtml = `<td colspan="7" style="color:#BBB">Pending</td>`;
                                }

                                return `<tr class="${isPriorWeek ? 'prior-week' : ''}">
                                            <td style="text-align:left"><b>${weekLabel}</b></td>
                                            ${scheduleCellsHtml}
                                            <td>
                                                ${!isPriorWeek ? `<button class="pill-btn ${sW?'pill-update':'pill-suggest'}" onclick="openPatternEditor('${fullName}','${w}','pattern-editor-mount')">${sW?'Update':'Suggest'}</button>` : ''}
                                            </td>
                                        </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                    <div id="pattern-editor-mount" style="margin-top: -1px;"></div>
                    <div class="p-section-title">Manager Notes</div>
                    <div style="display:flex; gap:10px; margin-bottom:20px;">
                        <input type="text" id="new-note-txt" placeholder="Log a reminder or note..." class="comment-box" style="margin:0; border-radius:12px;">
                        <button class="btn-action btn-post" onclick="postNote(this, '${fullName}', '${s.team}')" style="flex-shrink:0; border-radius:12px;">Post</button>
                    </div>
                    <div class="notes-list" id="profile-notes-mount"></div>
                </div>
            `;
            renderProfileNotes(fullName);
        }, 100);
    };

    window.openPatternEditor = (name: string, weekCommencing: string, mountId = 'pattern-editor-mount') => {
        const mount = document.getElementById(mountId) as HTMLElement;
        if (mount.querySelector('.pattern-editor')) {
            mount.innerHTML = '';
            return;
        }
        mount.innerHTML = ''; // Clear previous editors
        const sub = rotaRequests.find(s => s.staffName === name && s.weekCommencing === weekCommencing);
        const weekdayLocs = ['Office', 'WFH', 'Shoot', 'Client / Travel', 'PTO'];
        const weekendLocs = ['Weekend', 'Shoot', 'Client / Travel'];
        const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        mount.innerHTML = `
            <div class="pattern-editor">
                <div style="font-size:10px; font-weight:900; margin-bottom:12px; color:var(--team-people); text-transform:uppercase;">Set Working Pattern: ${new Date(weekCommencing).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div class="editor-grid">
                    ${dayLabels.map((day, i) => {
                        const isWeekend = i >= 5;
                        const locs = isWeekend ? weekendLocs : weekdayLocs;
                        const defaultStatus = isWeekend ? 'Weekend' : 'Office';
                        const cur = sub && sub.schedule && sub.schedule[i] ? sub.schedule[i].status : defaultStatus;
                        
                        return `<div>
                                    <div class="editor-day-label">${day}</div>
                                    <select class="editor-select" id="edit-day-${i}">${locs.map(l => `<option value="${l}" ${cur === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
                                </div>`;
                    }).join('')}
                </div>
                <button class="btn-action btn-sync" style="width:100%;" onclick="window.saveOverride(this, '${name}', '${weekCommencing}')">Sync to Cloud</button>
            </div>
        `;
    };

    window.saveOverride = async (buttonEl: HTMLButtonElement, name: string, weekCommencing: string) => {
        const originalContent = buttonEl.innerHTML;
        const loaderHTML = `<div class="sync-loader"><span></span><span></span><span></span></div>`;
        const successHTML = `<svg class="sync-tick" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

        buttonEl.disabled = true;
        buttonEl.innerHTML = loaderHTML;

        try {
            const schedule = [];
            for(let i=0; i<7; i++) {
                schedule.push({ status: (document.getElementById(`edit-day-${i}`) as HTMLSelectElement).value, fullDay: true });
            }
            const submissionId = `${weekCommencing}_${name.replace(/\s+/g, '_')}`;
            
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rota_requests', submissionId), { 
                staffName: name, 
                weekCommencing, 
                schedule, 
                managerName: staffList.find(s => `${s.firstName} ${s.lastName}` === name)?.manager || 'Unknown', 
                timestamp: new Date().toISOString() 
            });

            buttonEl.classList.remove('btn-sync');
            buttonEl.classList.add('btn-success');
            buttonEl.innerHTML = successHTML;
            showToast("Cloud Synced");

            setTimeout(() => {
                window.closeModal();
            }, 1500);

        } catch (error) {
            console.error("Failed to save override:", error);
            buttonEl.innerHTML = originalContent;
            buttonEl.disabled = false;
            showToast("Sync Failed!");
        }
    };

    window.handleAction = async (buttonEl: HTMLButtonElement, name: string, status: string, staffId: string) => {
        buttonEl.disabled = true;
        const otherButton = buttonEl.parentElement?.querySelector('.btn-action') as HTMLButtonElement | null;
        if(otherButton) otherButton.disabled = true;

        buttonEl.innerHTML = `<div class="sync-loader"><span></span><span></span><span></span></div>`;

        const wcStr = currentMonday.toISOString().split('T')[0];
        const comment = (document.getElementById(`comment-${staffId}`) as HTMLTextAreaElement).value;
        const respId = `${wcStr}_${name.replace(/\s+/g, '_')}`;
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rota_responses', respId), { 
            staffName: name, 
            weekCommencing: wcStr, 
            status, 
            comment, 
            timestamp: new Date().toISOString() 
        });
        showToast("Response Recorded");
        setTimeout(window.closeModal, 500);
    };

    function renderProfileNotes(name: string) {
        const mount = document.getElementById('profile-notes-mount') as HTMLElement;
        const userNotes = staffNotes.filter(n => n.target === name).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        mount.innerHTML = userNotes.map(n => `<div class="note-item" style="border-left-color: ${teamColors[n.team] || 'var(--team-people)'}">${n.text}<span class="note-meta">${new Date(n.date).toLocaleDateString()}</span></div>`).join('') || '<div style="font-size:12px; color:#CCC; text-align:center; padding:20px;">No manager notes.</div>';
    }

    window.postNote = async (buttonEl: HTMLButtonElement, target: string, team: string) => {
        const textInput = document.getElementById('new-note-txt') as HTMLInputElement;
        const text = textInput.value;
        if(!text.trim()) return;
        
        buttonEl.disabled = true;
        const originalContent = buttonEl.innerHTML;
        buttonEl.innerHTML = `<div class="sync-loader"><span></span><span></span><span></span></div>`;

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'staff_notes'), { target, text, date: new Date().toISOString(), team });
        
        textInput.value = "";
        showToast("Note Recorded");
        
        buttonEl.disabled = false;
        buttonEl.innerHTML = originalContent;
    };

    window.closeModal = () => {
        const modal = document.getElementById('global-modal') as HTMLElement;
        modal.classList.remove('active');
        // Clear content after transition to prevent stale data
        setTimeout(() => {
            (document.getElementById('modal-mount') as HTMLElement).innerHTML = '';
        }, 300);
    };

    window.switchView = (v: string, btn: HTMLElement) => {
        document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
        (document.getElementById('view-'+v) as HTMLElement).classList.add('active');
        btn.classList.add('active');

        const weekPicker = document.getElementById('week-picker-control') as HTMLElement;
        if (v === 'approvals') {
            weekPicker.classList.add('hidden');
        } else {
            weekPicker.classList.remove('hidden');
        }
    };
    function showToast(m: string) { const t = document.getElementById('toast') as HTMLElement; t.innerText = m; t.classList.add('active'); setTimeout(() => t.classList.remove('active'), 2500); }