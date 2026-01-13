import React, { useState, useRef, useEffect } from 'react';

interface SelectOption {
  value: string;
  label: string;
  color?: string;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const Select: React.FC<SelectProps> = ({ label, value, options, onChange, placeholder = "Select...", className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <label className="block text-[10px] font-bold uppercase text-ink-sub mb-1.5 tracking-wide">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left text-xs font-semibold border rounded-lg px-3 py-2.5 flex items-center justify-between transition-all duration-200 
          ${isOpen ? 'border-editorial ring-1 ring-editorial/20 shadow-sm' : 'border-gray-200 hover:border-gray-300'}
          bg-white`}
      >
        <span className={!selectedOption ? "text-gray-400" : "text-ink"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-gray-400 text-[10px]">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 flex items-center justify-between group
                  ${option.value === value ? 'bg-editorial/5 text-editorial' : 'text-ink'}`}
              >
                <span>{option.label}</span>
                {option.value === value && <span className="text-editorial">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Select;
