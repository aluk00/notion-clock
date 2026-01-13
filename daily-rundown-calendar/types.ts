export interface RundownItem {
  id: string;
  title: string;
  section: 'FILMING' | 'INTERNAL' | 'EXTERNAL' | 'GOING LIVE';
  vertical: 'SPORT' | 'UK' | 'RESPAWN' | 'MAIN' | 'MONEY' | 'SPOTLIGHT';
  creator?: string;
  creatorId?: string;
  editor?: string;
  editorId?: string;
  designer?: string;
  designerId?: string;
  status: 'done' | 'pending' | 'blocked' | '';
  dateKey: string;
  plannedLiveDate?: string;
  liveLink?: string;
  thumbnailStatus?: 'needed' | 'done' | 'n/a';
  notes?: string;
  pdfUrl?: string;
  pdfName?: string;
  createdAt?: any;
}

export interface DayData {
  date: Date;
  dateKey: string;
  items: RundownItem[];
}

export interface StaffMember {
  id: string;
  name: string; // Composite for display
  firstName?: string;
  lastName?: string;
  role?: string;
  team?: string;
}

export type VerticalType = RundownItem['vertical'];
export type StatusType = RundownItem['status'];
export type SectionType = RundownItem['section'];
