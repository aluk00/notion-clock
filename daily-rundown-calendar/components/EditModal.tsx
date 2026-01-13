import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RundownItem, StaffMember } from '../types';
import { fetchStaff, uploadRundownAttachment } from '../services/firebase';
import Select from './Select';

interface EditModalProps {
  item: RundownItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: Partial<RundownItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const SECTIONS = [
  { value: 'FILMING', label: 'FILMING' },
  { value: 'INTERNAL', label: 'INTERNAL' },
  { value: 'EXTERNAL', label: 'EXTERNAL' },
  { value: 'GOING LIVE', label: 'GOING LIVE' }
];

const VERTICALS = [
  { value: 'SPORT', label: 'SPORT' },
  { value: 'UK', label: 'UK' },
  { value: 'RESPAWN', label: 'RESPAWN' },
  { value: 'MAIN', label: 'MAIN' },
  { value: 'MONEY', label: 'MONEY' },
  { value: 'SPOTLIGHT', label: 'SPOTLIGHT' }
];

const STATUSES = [
  { value: '', label: 'No Status' },
  { value: 'pending', label: 'Pending (In Progress)' },
  { value: 'done', label: 'Done (Approved)' },
  { value: 'blocked', label: 'Blocked (Needs Attention)' }
];

const THUMBNAIL_STATUSES = [
  { value: 'n/a', label: 'Not Required' },
  { value: 'needed', label: 'Thumbnail Needed' },
  { value: 'done', label: 'Thumbnail Ready' }
];

const EditModal: React.FC<EditModalProps> = ({ item, isOpen, onClose, onSave, onDelete }) => {
  const [formData, setFormData] = useState<Partial<RundownItem>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadStaff = async () => {
      const data = await fetchStaff();
      setStaff(data);
    };
    loadStaff();
  }, []);

  // Filter staff into specific roles for cleaner dropdowns
  const { editors, designers, creators } = useMemo(() => {
    const editors: any[] = [{ value: '', label: 'Unassigned' }];
    const designers: any[] = [{ value: '', label: 'Unassigned' }];
    const creators: any[] = [{ value: '', label: 'Unassigned' }];

    staff.forEach(s => {
      const role = (s.role || '').toLowerCase();
      const team = (s.team || '').toLowerCase();
      const name = s.name;
      const firstName = (s.firstName || '').toLowerCase();

      // Logic matching ecosystem widgets
      const isEditor = (team === 'editorial' || role.includes('editor')) && !['alex', 'megan'].includes(firstName);
      const isDesigner = team === 'creative' || team === 'design' || role.includes('design') || role.includes('graphic');
      
      // Store ID in value, Name in label, but for RundownItem compatibility we often store Name directly
      // However, to sync with Designer Queue we need IDs.
      // Strategy: Select returns ID. We look up Name.
      
      const option = { value: s.id, label: name };

      if (isEditor) editors.push(option);
      if (isDesigner) designers.push(option);
      creators.push(option); // Anyone can be a creator
    });

    return { editors, designers, creators };
  }, [staff]);

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title,
        section: item.section,
        vertical: item.vertical,
        creator: item.creator || '',
        creatorId: item.creatorId || '',
        editor: item.editor || '',
        editorId: item.editorId || '',
        designer: item.designer || '',
        designerId: item.designerId || '',
        status: item.status || '',
        dateKey: item.dateKey,
        plannedLiveDate: item.plannedLiveDate || '',
        liveLink: item.liveLink || '',
        thumbnailStatus: item.thumbnailStatus || 'n/a',
        notes: item.notes || '',
        pdfUrl: item.pdfUrl || '',
        pdfName: item.pdfName || ''
      });
    }
  }, [item]);

  if (!isOpen) return null;

  const handleChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStaffChange = (role: 'creator' | 'editor' | 'designer', id: string) => {
    const member = staff.find(s => s.id === id);
    const name = member ? member.name : '';
    setFormData(prev => ({
      ...prev,
      [role]: name,
      [`${role}Id`]: id
    }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadRundownAttachment(file, item.id);
      setFormData(prev => ({ 
        ...prev, 
        pdfUrl: url,
        pdfName: file.name
      }));
    } catch (error) {
      alert("Failed to upload PDF. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave(item.id, formData);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this item?')) {
      setLoading(true);
      try {
        await onDelete(item.id);
        onClose();
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 transition-all">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-ink">Edit Item</h2>
            <p className="text-[10px] text-ink-sub mt-0.5 font-medium">Update details for ecosystem synchronisation</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="space-y-6">
            
            {/* --- SECTION 1: CORE CONTENT --- */}
            <div className="space-y-4">
               <div>
                <label className="block text-[10px] font-bold uppercase text-ink-sub mb-1.5 tracking-wide">Content Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title || ''}
                  onChange={handleInputChange}
                  className="w-full text-sm font-semibold text-ink border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-editorial/20 focus:border-editorial transition-all placeholder:text-gray-300"
                  placeholder="e.g. Manchester United Match Analysis"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Vertical"
                  value={formData.vertical || ''}
                  options={VERTICALS}
                  onChange={(val) => handleChange('vertical', val)}
                />
                <Select
                  label="Rundown Section"
                  value={formData.section || ''}
                  options={SECTIONS}
                  onChange={(val) => handleChange('section', val)}
                />
              </div>
            </div>

            {/* --- SECTION 2: STAFFING --- */}
            <div className="p-4 bg-bg-soft rounded-lg border border-dashed border-gray-200 space-y-4">
               <div className="flex items-center gap-2 mb-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-editorial"></span>
                 <h3 className="text-[10px] font-bold uppercase text-ink tracking-widest">Team Assignment</h3>
               </div>
               <div className="grid grid-cols-3 gap-3">
                 <Select
                   label="Creator"
                   value={formData.creatorId || ''}
                   options={creators}
                   onChange={(id) => handleStaffChange('creator', id)}
                   placeholder="Assign..."
                 />
                 <Select
                   label="Editor"
                   value={formData.editorId || ''}
                   options={editors}
                   onChange={(id) => handleStaffChange('editor', id)}
                   placeholder="Assign..."
                 />
                 <Select
                   label="Designer"
                   value={formData.designerId || ''}
                   options={designers}
                   onChange={(id) => handleStaffChange('designer', id)}
                   placeholder="Assign..."
                 />
               </div>
            </div>

            {/* --- SECTION 3: LOGISTICS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {/* Statuses */}
               <div className="space-y-3">
                  <Select
                    label="Rundown Status"
                    value={formData.status || ''}
                    options={STATUSES}
                    onChange={(val) => handleChange('status', val)}
                    placeholder="Set status..."
                  />
                  <Select
                    label="Thumbnail Status"
                    value={formData.thumbnailStatus || 'n/a'}
                    options={THUMBNAIL_STATUSES}
                    onChange={(val) => handleChange('thumbnailStatus', val)}
                  />
               </div>
               
               {/* Dates */}
               <div className="space-y-3">
                 <div>
                   <label className="block text-[10px] font-bold uppercase text-ink-sub mb-1.5 tracking-wide">Rundown Date</label>
                   <input
                     type="date"
                     name="dateKey"
                     value={formData.dateKey || ''}
                     onChange={handleInputChange}
                     className="w-full text-xs font-medium text-ink border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-editorial focus:ring-1 focus:ring-editorial/20"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold uppercase text-ink-sub mb-1.5 tracking-wide">Planned Live Date</label>
                   <input
                     type="date"
                     name="plannedLiveDate"
                     value={formData.plannedLiveDate || ''}
                     onChange={handleInputChange}
                     className="w-full text-xs font-medium text-ink border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-editorial focus:ring-1 focus:ring-editorial/20"
                   />
                 </div>
               </div>
            </div>

            {/* --- SECTION 4: ASSETS & INFO --- */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
               <h3 className="text-[10px] font-bold uppercase text-ink tracking-widest">Assets & Notes</h3>
               
               <div>
                  <label className="block text-[10px] font-bold uppercase text-ink-sub mb-1.5 tracking-wide">Live URL</label>
                  <input
                    type="url"
                    name="liveLink"
                    value={formData.liveLink || ''}
                    onChange={handleInputChange}
                    placeholder="https://..."
                    className="w-full text-xs text-blue-600 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-editorial"
                  />
               </div>

               <div>
                 <label className="block text-[10px] font-bold uppercase text-ink-sub mb-1.5 tracking-wide">Production Notes</label>
                 <textarea
                   name="notes"
                   value={formData.notes || ''}
                   onChange={handleInputChange}
                   rows={3}
                   className="w-full text-xs text-ink border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-editorial resize-none"
                   placeholder="Add extra context, updates, or instructions..."
                 />
               </div>

               <div className="flex items-center gap-4">
                 <div className="flex-1">
                   <label className="block text-[10px] font-bold uppercase text-ink-sub mb-1.5 tracking-wide">PDF Brief / Script</label>
                   <div className="flex items-center gap-2">
                     <button
                       type="button"
                       onClick={() => fileInputRef.current?.click()}
                       disabled={uploading}
                       className="bg-gray-100 hover:bg-gray-200 text-ink text-xs font-bold px-4 py-2 rounded-lg transition-colors border border-gray-200"
                     >
                       {uploading ? 'Uploading...' : 'Upload PDF'}
                     </button>
                     <input
                       type="file"
                       ref={fileInputRef}
                       className="hidden"
                       accept="application/pdf"
                       onChange={handleFileUpload}
                     />
                     {formData.pdfName && (
                        <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-2 rounded-lg border border-green-100">
                          <span className="text-[10px]">📎</span>
                          <span className="text-[10px] font-bold truncate max-w-[150px]">{formData.pdfName}</span>
                          <a href={formData.pdfUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-[9px] underline hover:text-green-800">View</a>
                        </div>
                     )}
                   </div>
                 </div>
               </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-t border-gray-100">
          <button 
            onClick={handleDelete}
            disabled={loading}
            className="text-red-500 text-xs font-extrabold uppercase hover:bg-red-50 px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? 'Processing...' : 'Delete Item'}
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              disabled={loading}
              className="text-ink-sub text-xs font-extrabold uppercase hover:bg-white hover:shadow-sm px-5 py-2.5 rounded-lg transition-all border border-transparent hover:border-gray-200"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="bg-ink text-white text-xs font-extrabold uppercase px-6 py-2.5 rounded-lg hover:bg-editorial hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              {loading ? 'Syncing...' : 'Save Updates'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditModal;
