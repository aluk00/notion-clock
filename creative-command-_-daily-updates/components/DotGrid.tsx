import React from 'react';

export const DotGrid: React.FC = () => {
    return (
        <div className="grid grid-cols-2 gap-[3px] w-[15px]">
            <span className="w-[6px] h-[6px] rounded-full bg-[#21A0D8] dot-pulse"></span>
            <span className="w-[6px] h-[6px] rounded-full bg-[#21A0D8] dot-pulse-2"></span>
            <span className="w-[6px] h-[6px] rounded-full bg-[#21A0D8] dot-pulse-3"></span>
            <span className="w-[6px] h-[6px] rounded-full bg-[#21A0D8] dot-pulse-4"></span>
        </div>
    );
};