import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';

interface Props {
    projects: Project[];
    value: string;
    onChange: (name: string, id?: string) => void;
}

export const ProjectSelector: React.FC<Props> = ({ projects, value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Filter projects based on input
    const filtered = query === ''
        ? projects
        : projects.filter((p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.client?.toLowerCase().includes(query.toLowerCase())
        );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (project: Project) => {
        onChange(project.name, project.id);
        setQuery('');
        setIsOpen(false);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <input
                type="text"
                className="w-full text-sm font-bold text-[#1C1C1C] border border-gray-200 rounded-lg px-3 py-2 focus:border-[#21A0D8] focus:ring-1 focus:ring-[#21A0D8] outline-none transition-all placeholder:text-gray-400"
                placeholder="Project Name..."
                value={isOpen ? query : value}
                onChange={(e) => {
                    setQuery(e.target.value);
                    onChange(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => {
                    setQuery(value);
                    setIsOpen(true);
                }}
            />
            
            {isOpen && filtered.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto scroller">
                    {filtered.map((p) => (
                        <div
                            key={p.id}
                            className="px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors flex justify-between items-center group"
                            onMouseDown={() => handleSelect(p)}
                        >
                            <span className="text-xs font-bold text-gray-800">{p.name}</span>
                            {p.client && (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full group-hover:bg-white transition-colors">
                                    {p.client}
                                </span>
                            )}
                        </div>
                    ))}
                    <div 
                         className="px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors border-t border-gray-100"
                         onMouseDown={() => { onChange(query); setIsOpen(false); }}
                    >
                        <span className="text-xs italic text-gray-500">Use "{query}"</span>
                    </div>
                </div>
            )}
        </div>
    );
};