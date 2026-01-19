import React, { useState, useEffect } from 'react';
import { authenticate, subscribeToCategories, subscribeToChannels, seedInitialData } from './services/firebase';
import { SlackChannel, ChannelCategory, ChannelCategoryWithChannels } from './types';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  palette: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  video: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  newspaper: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  ),
  share: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const SlackIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

const DotGrid = () => (
  <div className="grid grid-cols-3 gap-0.5">
    {[...Array(9)].map((_, i) => (
      <div
        key={i}
        className={`w-1 h-1 rounded-full bg-ink ${i % 2 === 0 ? 'dot-pulse' : 'dot-pulse-2'}`}
      />
    ))}
  </div>
);

interface ChannelCardProps {
  channel: SlackChannel;
  categoryColor: string;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, categoryColor }) => {
  const handleClick = () => {
    window.open(channel.slackUrl, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      className="w-full text-left p-3 bg-white rounded-lg border border-border hover:border-gray-300 hover:shadow-sm transition-all duration-200 group"
    >
      <div className="flex items-start gap-2">
        <span
          className="text-xs font-bold mt-0.5"
          style={{ color: categoryColor }}
        >
          #
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-ink group-hover:text-ink/80 truncate">
            {channel.name.replace('#', '')}
          </div>
          <div className="text-[10px] text-ink-sub leading-snug mt-0.5">
            {channel.description}
          </div>
        </div>
        <svg
          className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
    </button>
  );
};

interface CategorySectionProps {
  category: ChannelCategoryWithChannels;
  isExpanded: boolean;
  onToggle: () => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({ category, isExpanded, onToggle }) => {
  const icon = CATEGORY_ICONS[category.icon] || CATEGORY_ICONS.settings;

  const handleSectionClick = () => {
    if (category.sectionUrl) {
      window.open(category.sectionUrl, '_blank');
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      {/* Category Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-bg-soft cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${category.color}15`, color: category.color }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-[12px] font-bold text-ink">{category.name}</h3>
          <span className="text-[10px] text-ink-sub">{category.channels.length} channels</span>
        </div>
        {category.sectionUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSectionClick();
            }}
            className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide rounded-md hover:bg-white transition-colors"
            style={{ color: category.color }}
            title="View all in Slack"
          >
            View All
          </button>
        )}
        <svg
          className={`w-4 h-4 text-ink-sub transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Channels List */}
      {isExpanded && (
        <div className="p-3 grid gap-2">
          {category.channels.length === 0 ? (
            <div className="text-center py-4 text-[10px] text-ink-sub">
              No channels in this category yet
            </div>
          ) : (
            category.channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                categoryColor={category.color}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        await authenticate();
        await seedInitialData();

        const unsubCategories = subscribeToCategories((cats) => {
          setCategories(cats);
          // Expand all categories by default
          setExpandedCategories(new Set(cats.map(c => c.id)));
          setLoading(false);
        });

        const unsubChannels = subscribeToChannels((chs) => {
          setChannels(chs);
        });

        return () => {
          unsubCategories();
          unsubChannels();
        };
      } catch (err) {
        console.error("Failed to initialize:", err);
        setLoading(false);
      }
    };

    init();
  }, []);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categories.map(c => c.id)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  // Combine categories with their channels
  const categoriesWithChannels: ChannelCategoryWithChannels[] = categories.map((category) => ({
    ...category,
    channels: channels
      .filter((ch) => ch.categoryId === category.id && ch.isActive)
      .sort((a, b) => a.order - b.order),
  }));

  // Filter based on search
  const filteredCategories = searchQuery
    ? categoriesWithChannels
        .map((cat) => ({
          ...cat,
          channels: cat.channels.filter(
            (ch) =>
              ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ch.description.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((cat) => cat.channels.length > 0)
    : categoriesWithChannels;

  return (
    <div className="p-4 font-sans text-ink">
      <div className="bg-white rounded-2xl border border-border overflow-hidden max-w-[600px] mx-auto transition-all duration-300 hover:shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-white sticky top-0 z-10">
          <DotGrid />
          <div className="flex-1">
            <h1 className="text-[13px] font-extrabold tracking-tight uppercase text-ink flex items-center gap-2">
              <SlackIcon />
              Channel Directory
            </h1>
          </div>
          <div className="flex gap-1">
            <button
              onClick={expandAll}
              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide bg-bg-soft hover:bg-gray-200 rounded-md transition-colors"
            >
              Expand
            </button>
            <button
              onClick={collapseAll}
              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide bg-bg-soft hover:bg-gray-200 rounded-md transition-colors"
            >
              Collapse
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border bg-bg-soft">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-sub"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-[11px] bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink/20 transition-all"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="min-h-[300px] flex flex-col items-center justify-center gap-4 text-ink-sub">
            <DotGrid />
            <span className="text-[10px] font-bold uppercase tracking-widest">Loading Channels...</span>
          </div>
        ) : (
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-ink-sub">
                <div className="text-[11px] font-bold">No channels found</div>
                <div className="text-[10px] mt-1">Try a different search term</div>
              </div>
            ) : (
              filteredCategories.map((category) => (
                <CategorySection
                  key={category.id}
                  category={category}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                />
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-bg-soft">
          <p className="text-[9px] text-ink-sub text-center">
            Can't find a channel?{' '}
            <a
              href="slack://open"
              className="font-bold text-ink hover:underline"
            >
              Open Slack
            </a>
            {' '}to browse all channels
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
