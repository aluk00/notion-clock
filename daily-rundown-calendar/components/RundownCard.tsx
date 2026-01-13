import React from 'react';
import { RundownItem } from '../types';

interface RundownCardProps {
  item: RundownItem;
  onClick: (item: RundownItem) => void;
}

const VERTICAL_STYLES = {
  SPORT: 'bg-green-100 text-green-700',
  UK: 'bg-blue-100 text-blue-600',
  RESPAWN: 'bg-purple-100 text-purple-600',
  MAIN: 'bg-gray-100 text-gray-800',
  MONEY: 'bg-yellow-100 text-yellow-700',
  SPOTLIGHT: 'bg-pink-100 text-pink-600',
};

const STATUS_ICONS = {
  done: '✓',
  pending: '◔',
  blocked: '!',
  '': ''
};

const STATUS_STYLES = {
  done: 'bg-green-500 border-green-500 text-white',
  pending: 'bg-yellow-500 border-yellow-500 text-white',
  blocked: 'bg-red-500 border-red-500 text-white',
  '': 'border-gray-200'
};

const RundownCard: React.FC<RundownCardProps> = ({ item, onClick }) => {
  const verticalClass = VERTICAL_STYLES[item.vertical] || 'bg-gray-100 text-gray-600';
  const statusClass = STATUS_STYLES[item.status || ''] || 'border-gray-200';
  const statusIcon = STATUS_ICONS[item.status || ''] || '';

  const hasThumbnailIssue = item.thumbnailStatus === 'needed';
  const hasPDF = !!item.pdfUrl;
  const hasLink = !!item.liveLink;
  const hasNotes = !!item.notes;

  return (
    <div 
      onClick={() => onClick(item)}
      className="p-2 bg-white rounded-lg border border-border shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] transition-all duration-200 flex gap-2 group cursor-pointer relative"
    >
      <div className={`w-[14px] h-[14px] mt-[2px] rounded-full border-[1.5px] flex items-center justify-center text-[8px] flex-shrink-0 ${statusClass}`}>
        {statusIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap gap-1 mb-1 items-center">
          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded ${verticalClass} tracking-wide`}>
            {item.vertical}
          </span>
          {item.creator && (
            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
              {item.creator}
            </span>
          )}
          {item.editor && (
            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100">
              ED: {item.editor}
            </span>
          )}
          {item.designer && (
            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-pink-50 text-pink-600 border border-pink-100">
              DES: {item.designer}
            </span>
          )}
          {hasThumbnailIssue && (
             <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 border border-orange-200 animate-pulse">
               Thumb Needed
             </span>
          )}
        </div>
        <div className="text-[10px] font-semibold text-ink leading-snug break-words mb-1">
          {item.title}
        </div>
        
        {/* Indicators Row */}
        {(hasPDF || hasLink || hasNotes) && (
          <div className="flex gap-2 pt-1 border-t border-gray-50">
            {hasLink && <span title="Live Link" className="text-[9px] text-blue-500">🔗 Live</span>}
            {hasPDF && <span title="PDF Attached" className="text-[9px] text-red-500">📄 PDF</span>}
            {hasNotes && <span title="Has Notes" className="text-[9px] text-gray-400">📝 Notes</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default RundownCard;