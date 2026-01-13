import React from 'react';

const DotGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-2 gap-[2px] w-[12px]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[5px] h-[5px] rounded-full bg-editorial animate-pulse"
          style={{ animationDelay: `${i * 0.3}s` }}
        />
      ))}
    </div>
  );
};

export default DotGrid;