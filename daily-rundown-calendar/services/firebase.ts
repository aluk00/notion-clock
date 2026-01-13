import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";
import { RundownItem, StaffMember } from "../types";

const firebaseConfig = {
  apiKey: "AIzaSyBrV1NuvPO-_CLtQPyOhR_ERsRvE2dxDlY",
  authDomain: "dmg-command-centre-native.firebaseapp.com",
  projectId: "dmg-command-centre-native",
  storageBucket: "dmg-command-centre-native.firebasestorage.app",
  messagingSenderId: "223535956454",
  appId: "1:223535956454:web:b25e5bc69d8a4a7f209627"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const APP_ID = "dmg-command-centre-native";
const COLLECTION_PATH = `artifacts/${APP_ID}/public/data/daily_rundowns`;
const STAFF_PATH = `artifacts/${APP_ID}/public/data/staff_directory`;
const DESIGN_REQ_PATH = `artifacts/${APP_ID}/public/data/design_requests`;
const EDIT_QUEUE_PATH = `artifacts/${APP_ID}/public/data/edit_queue`;

export const authenticate = async () => {
  return signInAnonymously(auth);
};

export const fetchRundownItems = async (startDate: string, endDate: string): Promise<RundownItem[]> => {
  try {
    const q = query(
      collection(db, COLLECTION_PATH),
      where("dateKey", ">=", startDate),
      where("dateKey", "<=", endDate)
    );

    const querySnapshot = await getDocs(q);
    const items: RundownItem[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as RundownItem));
    
    return items.sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeA - timeB;
    });
  } catch (error) {
    console.error("Error fetching rundown items:", error);
    return [];
  }
};

export const fetchStaff = async (): Promise<StaffMember[]> => {
  try {
    const q = query(collection(db, STAFF_PATH));
    const snapshot = await getDocs(q);
    const staff = snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || 'Unknown',
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        team: data.team
      } as StaffMember;
    });
    
    if (staff.length > 0) return staff;
    
    return [
      { id: '1', name: 'Mimi', role: 'Editor', team: 'Editorial' },
      { id: '2', name: 'Dan', role: 'Editor', team: 'Editorial' },
      { id: '3', name: 'Prashan', role: 'Editor', team: 'Editorial' },
      { id: '4', name: 'Henry', role: 'Editor', team: 'Editorial' },
      { id: '5', name: 'Dine', role: 'Designer', team: 'Creative' },
      { id: '6', name: 'Alex', role: 'Producer', team: 'Production' },
      { id: '7', name: 'Kaylee', role: 'Designer', team: 'Creative' },
      { id: '8', name: 'Ellie', role: 'Designer', team: 'Creative' }
    ];
  } catch (error) {
    console.warn("Could not fetch staff directory, using fallback.", error);
    return [];
  }
};

// --- SYNC LOGIC ---
// This ensures that changes here reflect in the Designer Queue and Editor Capacity widgets
const syncToEcosystem = async (id: string, item: Partial<RundownItem>) => {
  try {
    // 1. Sync to Designer Queue if Thumbnail is Needed
    if (item.thumbnailStatus === 'needed') {
      const designRef = doc(db, DESIGN_REQ_PATH, `rundown-${id}`);
      await setDoc(designRef, {
        headline: item.title,
        assetType: 'Thumbnail',
        status: 'Not Started',
        priority: 'Standard',
        deadline: item.dateKey, // Due on rundown date
        liveDate: item.plannedLiveDate || null,
        designerId: item.designerId || null,
        source: 'Rundown',
        createdAt: serverTimestamp()
      }, { merge: true });
    }

    // 2. Sync to Edit Queue if Editor is assigned
    if (item.editor && item.status !== 'done') {
      const editRef = doc(db, EDIT_QUEUE_PATH, `rundown-${id}`);
      await setDoc(editRef, {
        title: item.title,
        editor: item.editor,
        status: item.status === 'pending' ? 'In Progress' : 'To Do',
        priority: 'Medium',
        dueDate: item.dateKey,
        liveDate: item.plannedLiveDate || null,
        source: 'Rundown',
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (err) {
    console.warn("Ecosystem sync warning:", err);
  }
};

export const updateRundownItem = async (id: string, data: Partial<RundownItem>) => {
  try {
    const docRef = doc(db, COLLECTION_PATH, id);
    await updateDoc(docRef, data);
    
    // Trigger ecosystem sync
    await syncToEcosystem(id, data);
  } catch (error) {
    console.error("Error updating item:", error);
    throw error;
  }
};

export const deleteRundownItem = async (id: string) => {
  try {
    const docRef = doc(db, COLLECTION_PATH, id);
    await deleteDoc(docRef);
    
    // Cleanup synced docs (optional, but good practice)
    try {
      await deleteDoc(doc(db, DESIGN_REQ_PATH, `rundown-${id}`));
      await deleteDoc(doc(db, EDIT_QUEUE_PATH, `rundown-${id}`));
    } catch (e) { /* ignore cleanup errors */ }
    
  } catch (error) {
    console.error("Error deleting item:", error);
    throw error;
  }
};

export const uploadRundownAttachment = async (file: File, itemId: string): Promise<string> => {
  try {
    const storageRef = ref(storage, `rundown_attachments/${itemId}/${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return url;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};
