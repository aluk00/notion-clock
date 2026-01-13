import React from 'react';
import { SectionData, UpdateItem, Project } from '../types';
import { ProjectSelector } from './ProjectSelector';
import { v4 as uuidv4 } from 'uuid';

interface Props {
    section: SectionData;
    projects: Project[];
    onUpdate: (updatedSection: SectionData) => void;
}

export const SectionEditor: React.FC<Props> = ({ section, projects, onUpdate }) => {

    const addItem = () => {
        const newItem: UpdateItem = {
            id: uuidv4(),
            projectId: '',
            projectName: '',
            statusNote: '',
            link: '',
            bullets: []
        };
        onUpdate({ ...section, items: [...section.items, newItem] });
    };

    const removeItem = (itemId: string) => {
        onUpdate({ ...section, items: section.items.filter(i => i.id !== itemId) });
    };

    // Helper to update multiple fields at once to avoid race conditions
    const updateItemFields = (itemId: string, fields: Partial<UpdateItem>) => {
        onUpdate({
            ...section,
            items: section.items.map(i => i.id === itemId ? { ...i, ...fields } : i)
        });
    };

    const updateItem = (itemId: string, field: keyof UpdateItem, value: any) => {
        updateItemFields(itemId, { [field]: value });
    };

    const addBullet = (itemId: string) => {
        const item = section.items.find(i => i.id === itemId);
        if (item) {
            const newBullet = { id: uuidv4(), text: '' };
            updateItem(itemId, 'bullets', [...item.bullets, newBullet]);
        }
    };

    const updateBullet = (itemId: string, bulletId: string, text: string) => {
        const item = section.items.find(i => i.id === itemId);
        if (item) {
            const newBullets = item.bullets.map(b => b.id === bulletId ? { ...b, text } : b);
            updateItem(itemId, 'bullets', newBullets);
        }
    };
    
    const removeBullet = (itemId: string, bulletId: string) => {
        const item = section.items.find(i => i.id === itemId);
        if (item) {
            updateItem(itemId, 'bullets', item.bullets.filter(b => b.id !== bulletId));
        }
    };

    return (
        <div className="bg-white border border-[#21A0D8]/20 rounded-xl p-6 shadow-sm transition-all hover:shadow-md hover:border-[#21A0D8]/40 hover:shadow-[#21A0D8]/5">
            <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#21A0D8]/10">
                <h3 className="text-[11px] font-bold text-[#1C1C1C] uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#21A0D8]"></span>
                    {section.title}
                </h3>
                {section.items.length > 0 && (
                     <span className="bg-blue-50 text-[#21A0D8] text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#21A0D8]/10">
                        {section.items.length}
                    </span>
                )}
            </div>

            <div className="space-y-4">
                {section.items.map((item) => (
                    <div key={item.id} className="relative group bg-white rounded-lg border border-[#21A0D8]/10 p-4 hover:border-[#21A0D8]/40 transition-colors shadow-sm">
                        <button 
                            onClick={() => removeItem(item.id)}
                            className="absolute right-3 top-3 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Item"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                            <div className="col-span-1">
                                <ProjectSelector 
                                    projects={projects}
                                    value={item.projectName}
                                    onChange={(name, id) => {
                                        // Update both name and ID simultaneously to prevent state race condition
                                        updateItemFields(item.id, {
                                            projectName: name,
                                            projectId: id || '' 
                                        });
                                    }}
                                />
                            </div>
                            <div className="col-span-1">
                                <input 
                                    type="text" 
                                    className="w-full text-xs font-medium text-gray-700 bg-transparent border-b border-gray-200 py-2 focus:border-[#21A0D8] outline-none placeholder:text-gray-400"
                                    placeholder="Status (e.g. Brief Coming Soon)"
                                    value={item.statusNote}
                                    onChange={(e) => updateItem(item.id, 'statusNote', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="mb-3 relative group/link">
                            <input 
                                type="text" 
                                className="w-full text-[10px] text-[#21A0D8] bg-blue-50/30 rounded px-2 py-1.5 border border-transparent focus:border-[#21A0D8]/30 focus:bg-white outline-none placeholder:text-gray-300 pr-7"
                                placeholder="Paste link here..."
                                value={item.link}
                                onChange={(e) => updateItem(item.id, 'link', e.target.value)}
                            />
                            {item.link && (
                                <button
                                    onClick={() => updateItem(item.id, 'link', '')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Clear Link"
                                >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            )}
                        </div>

                        <div className="space-y-2 pl-3 border-l-2 border-[#21A0D8]/10">
                            {item.bullets.map((bullet) => (
                                <div key={bullet.id} className="flex items-start gap-2 group/bullet">
                                    <span className="text-[#21A0D8] text-[10px] mt-1.5 font-bold">•</span>
                                    <input 
                                        type="text"
                                        className="flex-1 text-[11px] text-gray-600 bg-transparent border-none focus:ring-0 p-1 placeholder:text-gray-300 leading-tight"
                                        placeholder="Add detail point..."
                                        value={bullet.text}
                                        onChange={(e) => updateBullet(item.id, bullet.id, e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && bullet.text) {
                                                e.preventDefault();
                                                addBullet(item.id);
                                            }
                                            if (e.key === 'Backspace' && !bullet.text) {
                                                e.preventDefault();
                                                removeBullet(item.id, bullet.id);
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={() => removeBullet(item.id, bullet.id)}
                                        className="text-gray-300 hover:text-red-500 text-[10px] pt-1 px-2"
                                        title="Delete Point"
                                    >×</button>
                                </div>
                            ))}
                            <button 
                                onClick={() => addBullet(item.id)}
                                className="text-[10px] font-bold text-[#21A0D8]/60 hover:text-[#21A0D8] uppercase tracking-wider flex items-center gap-1 mt-2 pl-1 transition-colors"
                            >
                                + Point
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button 
                onClick={addItem}
                className="mt-5 w-full py-2 border border-dashed border-[#21A0D8]/30 rounded-lg text-[10px] font-bold text-[#21A0D8] hover:border-[#21A0D8] hover:bg-blue-50/30 transition-all uppercase tracking-wider"
            >
                + Add Project
            </button>
        </div>
    );
};