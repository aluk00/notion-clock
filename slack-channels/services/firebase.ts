import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { SlackChannel, ChannelCategory, ChannelCategoryWithChannels } from "../types";

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
const auth = getAuth(app);
const APP_ID = "dmg-command-centre-native";
const CATEGORIES_PATH = `artifacts/${APP_ID}/public/data/slack_categories`;
const CHANNELS_PATH = `artifacts/${APP_ID}/public/data/slack_channels`;

export const authenticate = async () => {
  return signInAnonymously(auth);
};

// --- Categories ---

export const fetchCategories = async (): Promise<ChannelCategory[]> => {
  try {
    const q = query(collection(db, CATEGORIES_PATH), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ChannelCategory));
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

export const subscribeToCategories = (callback: (categories: ChannelCategory[]) => void) => {
  const q = query(collection(db, CATEGORIES_PATH), orderBy("order", "asc"));
  return onSnapshot(q, (snapshot) => {
    const categories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as ChannelCategory));
    callback(categories);
  });
};

export const saveCategory = async (category: Omit<ChannelCategory, 'id'> & { id?: string }) => {
  try {
    const id = category.id || `cat_${Date.now()}`;
    const docRef = doc(db, CATEGORIES_PATH, id);
    await setDoc(docRef, {
      ...category,
      updatedAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving category:", error);
    throw error;
  }
};

export const deleteCategory = async (id: string) => {
  try {
    await deleteDoc(doc(db, CATEGORIES_PATH, id));
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
};

// --- Channels ---

export const fetchChannels = async (): Promise<SlackChannel[]> => {
  try {
    const q = query(collection(db, CHANNELS_PATH), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SlackChannel));
  } catch (error) {
    console.error("Error fetching channels:", error);
    return [];
  }
};

export const subscribeToChannels = (callback: (channels: SlackChannel[]) => void) => {
  const q = query(collection(db, CHANNELS_PATH), orderBy("order", "asc"));
  return onSnapshot(q, (snapshot) => {
    const channels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SlackChannel));
    callback(channels);
  });
};

export const saveChannel = async (channel: Omit<SlackChannel, 'id'> & { id?: string }) => {
  try {
    const id = channel.id || `ch_${Date.now()}`;
    const docRef = doc(db, CHANNELS_PATH, id);
    await setDoc(docRef, {
      ...channel,
      updatedAt: serverTimestamp()
    });
    return id;
  } catch (error) {
    console.error("Error saving channel:", error);
    throw error;
  }
};

export const deleteChannel = async (id: string) => {
  try {
    await deleteDoc(doc(db, CHANNELS_PATH, id));
  } catch (error) {
    console.error("Error deleting channel:", error);
    throw error;
  }
};

// --- Combined fetch ---

export const fetchCategoriesWithChannels = async (): Promise<ChannelCategoryWithChannels[]> => {
  const [categories, channels] = await Promise.all([
    fetchCategories(),
    fetchChannels()
  ]);

  return categories.map(category => ({
    ...category,
    channels: channels
      .filter(ch => ch.categoryId === category.id && ch.isActive)
      .sort((a, b) => a.order - b.order)
  }));
};

// --- Seed initial data ---

export const seedInitialData = async () => {
  const categories = await fetchCategories();
  if (categories.length > 0) {
    console.log("Data already exists, skipping seed");
    return;
  }

  console.log("Seeding initial Slack channel data...");

  const initialCategories: Omit<ChannelCategory, 'id'>[] = [
    { name: "Creative & Briefs", icon: "palette", color: "#E6468B", order: 0, sectionUrl: "https://dmgmedia.slack.com/channel-section/Csl0A9GV082ES" },
    { name: "Production", icon: "video", color: "#43B049", order: 1, sectionUrl: "https://dmgmedia.slack.com/channel-section/Csl0A9CKDHDC3" },
    { name: "Editorial", icon: "newspaper", color: "#E94B4B", order: 2, sectionUrl: "https://dmgmedia.slack.com/channel-section/Csl0A93H26B9D" },
    { name: "Social", icon: "share", color: "#F2C316", order: 3, sectionUrl: "https://dmgmedia.slack.com/channel-section/Csl0A9NJD68UC" },
    { name: "Client & Sales", icon: "briefcase", color: "#21a0d8", order: 4, sectionUrl: "https://dmgmedia.slack.com/channel-section/Csl0AADA7GKU0" },
    { name: "Operations", icon: "settings", color: "#6B7280", order: 5, sectionUrl: "https://dmgmedia.slack.com/channel-section/Csl0A9K11BY1G" },
  ];

  const categoryIds: string[] = [];
  for (const cat of initialCategories) {
    const id = await saveCategory(cat);
    categoryIds.push(id);
  }

  const initialChannels: Omit<SlackChannel, 'id'>[] = [
    // Creative & Briefs
    { name: "#creative-briefs", description: "Brief submissions, feedback rounds, sign-offs", slackUrl: "slack://channel?team=T0123456&id=C0123456", categoryId: categoryIds[0], order: 0, isActive: true },
    { name: "#creative-chat", description: "General creative team discussion, inspiration sharing", slackUrl: "slack://channel?team=T0123456&id=C0123457", categoryId: categoryIds[0], order: 1, isActive: true },
    { name: "#design-requests", description: "Thumbnail and asset design requests", slackUrl: "slack://channel?team=T0123456&id=C0123458", categoryId: categoryIds[0], order: 2, isActive: true },

    // Production
    { name: "#production-scheduling", description: "Shoot dates, studio bookings, crew availability", slackUrl: "slack://channel?team=T0123456&id=C0123459", categoryId: categoryIds[1], order: 0, isActive: true },
    { name: "#post-production", description: "Edit handoffs, graphics requests, delivery tracking", slackUrl: "slack://channel?team=T0123456&id=C0123460", categoryId: categoryIds[1], order: 1, isActive: true },
    { name: "#shoots-today", description: "Real-time updates on active shoots", slackUrl: "slack://channel?team=T0123456&id=C0123461", categoryId: categoryIds[1], order: 2, isActive: true },

    // Editorial
    { name: "#editorial-planning", description: "Content planning and ideation", slackUrl: "slack://channel?team=T0123456&id=C0123462", categoryId: categoryIds[2], order: 0, isActive: true },
    { name: "#daily-rundown", description: "Daily editorial priorities and updates", slackUrl: "slack://channel?team=T0123456&id=C0123463", categoryId: categoryIds[2], order: 1, isActive: true },
    { name: "#breaking-news", description: "Urgent editorial alerts and trending topics", slackUrl: "slack://channel?team=T0123456&id=C0123464", categoryId: categoryIds[2], order: 2, isActive: true },

    // Social
    { name: "#social-planning", description: "Social content calendar and scheduling", slackUrl: "slack://channel?team=T0123456&id=C0123465", categoryId: categoryIds[3], order: 0, isActive: true },
    { name: "#trending-now", description: "Real-time trending topics and viral content", slackUrl: "slack://channel?team=T0123456&id=C0123466", categoryId: categoryIds[3], order: 1, isActive: true },
    { name: "#platform-updates", description: "Algorithm changes and platform news", slackUrl: "slack://channel?team=T0123456&id=C0123467", categoryId: categoryIds[3], order: 2, isActive: true },

    // Client & Sales
    { name: "#client-comms", description: "External-facing updates, approval tracking", slackUrl: "slack://channel?team=T0123456&id=C0123468", categoryId: categoryIds[4], order: 0, isActive: true },
    { name: "#sales-pipeline", description: "New leads, pitch prep, proposal discussions", slackUrl: "slack://channel?team=T0123456&id=C0123469", categoryId: categoryIds[4], order: 1, isActive: true },
    { name: "#commercial-shoots", description: "Branded content production coordination", slackUrl: "slack://channel?team=T0123456&id=C0123470", categoryId: categoryIds[4], order: 2, isActive: true },

    // Operations
    { name: "#general", description: "Company-wide announcements and updates", slackUrl: "slack://channel?team=T0123456&id=C0123471", categoryId: categoryIds[5], order: 0, isActive: true },
    { name: "#it-support", description: "Tech support and equipment requests", slackUrl: "slack://channel?team=T0123456&id=C0123472", categoryId: categoryIds[5], order: 1, isActive: true },
    { name: "#facilities", description: "Office and studio related queries", slackUrl: "slack://channel?team=T0123456&id=C0123473", categoryId: categoryIds[5], order: 2, isActive: true },
  ];

  for (const ch of initialChannels) {
    await saveChannel(ch);
  }

  console.log("Seed data created successfully");
};
