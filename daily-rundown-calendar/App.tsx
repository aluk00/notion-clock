import React, { useState, useEffect, useCallback } from 'react';
import { authenticate, fetchRundownItems, updateRundownItem, deleteRundownItem } from './services/firebase';
import { RundownItem, DayData } from './types';
import DotGrid from './components/DotGrid';
import RundownCard from './components/RundownCard';
import EditModal from './components/EditModal';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getWeekDates = (start: Date) => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
};

const formatDateKey = (date: Date) => {
  return date.toISOString().split('T')[0];
};

const App: React.FC = () => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [weekData, setWeekData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<RundownItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await authenticate();
      
      const dates = getWeekDates(currentWeekStart);
      const startKey = formatDateKey(dates[0]);
      const endKey = formatDateKey(dates[6]);
      
      const items = await fetchRundownItems(startKey, endKey);
      
      const data: DayData[] = dates.map(date => {
        const key = formatDateKey(date);
        return {
          date,
          dateKey: key,
          items: items.filter(i => i.dateKey === key)
        };
      });
      
      setWeekData(data);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  }, [currentWeekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };

  const handleToday = () => {
    setCurrentWeekStart(getWeekStart(new Date()));
  };

  const formatWeekLabel = () => {
    const dates = getWeekDates(currentWeekStart);
    const start = dates[0];
    const end = dates[6];
    const startMonth = start.toLocaleDateString('en-GB', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-GB', { month: 'short' });
    
    if (startMonth === endMonth) {
      return `${start.getDate()} - ${end.getDate()} ${startMonth}`;
    }
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth}`;
  };

  const isToday = (date: Date) => {
    return formatDateKey(date) === formatDateKey(new Date());
  };

  const handleCardClick = (item: RundownItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSave = async (id: string, data: Partial<RundownItem>) => {
    await updateRundownItem(id, data);
    loadData(); // Refresh data
  };

  const handleDelete = async (id: string) => {
    await deleteRundownItem(id);
    loadData(); // Refresh data
  };

  return (
    <div className="p-4 font-sans text-ink">
      <div className="bg-white rounded-2xl border border-border overflow-hidden max-w-[1400px] mx-auto transition-all duration-300 hover:shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-4 bg-white sticky top-0 z-10">
          <DotGrid />
          <h1 className="flex-1 text-[13px] font-extrabold tracking-tight uppercase text-ink">
            Editorial Production Calendar <span className="text-editorial mx-2">•</span> {formatWeekLabel()}
          </h1>
          
          <div className="flex gap-1">
            <button 
              onClick={handlePrevWeek}
              className="px-2.5 py-1.5 text-[10px] font-bold bg-bg-soft hover:bg-editorial hover:text-white rounded-md transition-colors"
            >
              ←
            </button>
            <button 
              onClick={handleToday}
              className="px-3 py-1.5 text-[10px] font-bold bg-bg-soft hover:bg-editorial hover:text-white rounded-md transition-colors"
            >
              Today
            </button>
            <button 
              onClick={handleNextWeek}
              className="px-2.5 py-1.5 text-[10px] font-bold bg-bg-soft hover:bg-editorial hover:text-white rounded-md transition-colors"
            >
              →
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-ink-sub">
             <DotGrid />
             <span className="text-[10px] font-bold uppercase tracking-widest">Syncing Ecosystem...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {weekData.map((day, i) => (
              <div key={day.dateKey} className="min-h-[200px] md:min-h-[600px] flex flex-col">
                {/* Day Header */}
                <div className={`p-3 text-center border-b border-gray-50 transition-colors ${isToday(day.date) ? 'bg-editorial/5' : 'bg-bg-soft'}`}>
                  <div className="text-[9px] font-bold uppercase text-ink-sub tracking-widest mb-0.5">
                    {WEEKDAYS[i]}
                  </div>
                  <div className={`text-lg font-black ${isToday(day.date) ? 'text-editorial' : 'text-ink'}`}>
                    {day.date.getDate()}
                  </div>
                </div>

                {/* Day Items */}
                <div className="flex-1 p-2 bg-white flex flex-col gap-2">
                  {day.items.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-start pt-8 opacity-20 hover:opacity-40 transition-opacity">
                      <div className="w-1 h-8 bg-gray-300 rounded-full mb-2"></div>
                      <span className="text-[8px] font-bold uppercase">No Items</span>
                    </div>
                  ) : (
                    day.items.map((item) => (
                      <RundownCard 
                        key={item.id} 
                        item={item} 
                        onClick={handleCardClick}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <EditModal 
          item={selectedItem}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

export default App;
