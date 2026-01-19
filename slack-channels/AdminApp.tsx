import React, { useState, useEffect } from 'react';
import {
  authenticate,
  subscribeToCategories,
  subscribeToChannels,
  saveCategory,
  deleteCategory,
  saveChannel,
  deleteChannel,
} from './services/firebase';
import { SlackChannel, ChannelCategory } from './types';

const ICON_OPTIONS = [
  { value: 'palette', label: 'Palette (Creative)' },
  { value: 'video', label: 'Video (Production)' },
  { value: 'newspaper', label: 'Newspaper (Editorial)' },
  { value: 'share', label: 'Share (Social)' },
  { value: 'briefcase', label: 'Briefcase (Sales)' },
  { value: 'settings', label: 'Settings (Operations)' },
];

const COLOR_OPTIONS = [
  { value: '#E6468B', label: 'Creative Pink' },
  { value: '#43B049', label: 'Production Green' },
  { value: '#E94B4B', label: 'Editorial Red' },
  { value: '#F2C316', label: 'Social Yellow' },
  { value: '#21a0d8', label: 'Sales Blue' },
  { value: '#6B7280', label: 'Operations Gray' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#F97316', label: 'Orange' },
];

interface CategoryFormData {
  id?: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  sectionUrl: string;
}

interface ChannelFormData {
  id?: string;
  name: string;
  description: string;
  slackUrl: string;
  categoryId: string;
  order: number;
  isActive: boolean;
}

const AdminApp: React.FC = () => {
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'categories' | 'channels'>('categories');

  // Category form state
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>({
    name: '',
    icon: 'settings',
    color: '#6B7280',
    order: 0,
    sectionUrl: '',
  });

  // Channel form state
  const [showChannelForm, setShowChannelForm] = useState(false);
  const [channelForm, setChannelForm] = useState<ChannelFormData>({
    name: '',
    description: '',
    slackUrl: '',
    categoryId: '',
    order: 0,
    isActive: true,
  });

  useEffect(() => {
    const init = async () => {
      try {
        await authenticate();

        const unsubCategories = subscribeToCategories((cats) => {
          setCategories(cats);
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
        console.error('Failed to initialize:', err);
        setLoading(false);
      }
    };

    init();
  }, []);

  // Category handlers
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveCategory(categoryForm);
      setShowCategoryForm(false);
      setCategoryForm({
        name: '',
        icon: 'settings',
        color: '#6B7280',
        order: categories.length,
        sectionUrl: '',
      });
    } catch (err) {
      console.error('Error saving category:', err);
    }
  };

  const handleEditCategory = (category: ChannelCategory) => {
    setCategoryForm({
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
      order: category.order,
      sectionUrl: category.sectionUrl || '',
    });
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Delete this category? Channels in this category will become orphaned.')) {
      await deleteCategory(id);
    }
  };

  // Channel handlers
  const handleChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveChannel(channelForm);
      setShowChannelForm(false);
      setChannelForm({
        name: '',
        description: '',
        slackUrl: '',
        categoryId: categories[0]?.id || '',
        order: channels.filter((c) => c.categoryId === channelForm.categoryId).length,
        isActive: true,
      });
    } catch (err) {
      console.error('Error saving channel:', err);
    }
  };

  const handleEditChannel = (channel: SlackChannel) => {
    setChannelForm({
      id: channel.id,
      name: channel.name,
      description: channel.description,
      slackUrl: channel.slackUrl,
      categoryId: channel.categoryId,
      order: channel.order,
      isActive: channel.isActive,
    });
    setShowChannelForm(true);
  };

  const handleDeleteChannel = async (id: string) => {
    if (confirm('Delete this channel?')) {
      await deleteChannel(id);
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find((c) => c.id === categoryId)?.name || 'Unknown';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-soft">
        <div className="text-ink-sub text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-soft p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-border p-6 mb-6">
          <h1 className="text-xl font-bold text-ink mb-2">Slack Channel Admin</h1>
          <p className="text-sm text-ink-sub">
            Manage channel categories and channels. Changes are reflected immediately in the widget.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
              activeTab === 'categories'
                ? 'bg-ink text-white'
                : 'bg-white text-ink border border-border hover:bg-bg-soft'
            }`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => setActiveTab('channels')}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
              activeTab === 'channels'
                ? 'bg-ink text-white'
                : 'bg-white text-ink border border-border hover:bg-bg-soft'
            }`}
          >
            Channels ({channels.length})
          </button>
        </div>

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-ink">Categories</h2>
              <button
                onClick={() => {
                  setCategoryForm({
                    name: '',
                    icon: 'settings',
                    color: '#6B7280',
                    order: categories.length,
                    sectionUrl: '',
                  });
                  setShowCategoryForm(true);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors"
              >
                + Add Category
              </button>
            </div>

            {/* Category Form */}
            {showCategoryForm && (
              <form onSubmit={handleCategorySubmit} className="p-4 border-b border-border bg-bg-soft">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Name</label>
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Icon</label>
                    <select
                      value={categoryForm.icon}
                      onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                    >
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Color</label>
                    <select
                      value={categoryForm.color}
                      onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                    >
                      {COLOR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Order</label>
                    <input
                      type="number"
                      value={categoryForm.order}
                      onChange={(e) => setCategoryForm({ ...categoryForm, order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                      min="0"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink mb-1">Slack Section URL (optional)</label>
                    <input
                      type="url"
                      value={categoryForm.sectionUrl}
                      onChange={(e) => setCategoryForm({ ...categoryForm, sectionUrl: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                      placeholder="https://dmgmedia.slack.com/channel-section/..."
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors"
                  >
                    {categoryForm.id ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCategoryForm(false)}
                    className="px-4 py-2 text-xs font-bold bg-bg-soft text-ink rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Category List */}
            <div className="divide-y divide-border">
              {categories.map((category) => (
                <div key={category.id} className="p-4 flex items-center gap-4 hover:bg-bg-soft transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.order}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-ink">{category.name}</div>
                    <div className="text-xs text-ink-sub">
                      {channels.filter((c) => c.categoryId === category.id).length} channels
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditCategory(category)}
                      className="px-2 py-1 text-xs font-bold text-ink-sub hover:text-ink transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      className="px-2 py-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="p-8 text-center text-ink-sub text-sm">
                  No categories yet. Add one to get started.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Channels Tab */}
        {activeTab === 'channels' && (
          <div className="bg-white rounded-2xl border border-border overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-bold text-ink">Channels</h2>
              <button
                onClick={() => {
                  setChannelForm({
                    name: '',
                    description: '',
                    slackUrl: '',
                    categoryId: categories[0]?.id || '',
                    order: 0,
                    isActive: true,
                  });
                  setShowChannelForm(true);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors"
                disabled={categories.length === 0}
              >
                + Add Channel
              </button>
            </div>

            {/* Channel Form */}
            {showChannelForm && (
              <form onSubmit={handleChannelSubmit} className="p-4 border-b border-border bg-bg-soft">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Channel Name</label>
                    <input
                      type="text"
                      value={channelForm.name}
                      onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                      placeholder="#channel-name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Category</label>
                    <select
                      value={channelForm.categoryId}
                      onChange={(e) => setChannelForm({ ...channelForm, categoryId: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                      required
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink mb-1">Description</label>
                    <input
                      type="text"
                      value={channelForm.description}
                      onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                      placeholder="What this channel is used for"
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-ink mb-1">Slack URL</label>
                    <input
                      type="text"
                      value={channelForm.slackUrl}
                      onChange={(e) => setChannelForm({ ...channelForm, slackUrl: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                      placeholder="slack://channel?team=T0123456&id=C0123456 or https://dmgmedia.slack.com/..."
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-ink mb-1">Order</label>
                    <input
                      type="number"
                      value={channelForm.order}
                      onChange={(e) => setChannelForm({ ...channelForm, order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ink/10"
                      min="0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={channelForm.isActive}
                      onChange={(e) => setChannelForm({ ...channelForm, isActive: e.target.checked })}
                      className="w-4 h-4 rounded border-border"
                    />
                    <label htmlFor="isActive" className="text-xs font-bold text-ink">
                      Active (visible in widget)
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold bg-ink text-white rounded-lg hover:bg-ink/90 transition-colors"
                  >
                    {channelForm.id ? 'Update' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowChannelForm(false)}
                    className="px-4 py-2 text-xs font-bold bg-bg-soft text-ink rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Channel List */}
            <div className="divide-y divide-border">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`p-4 flex items-center gap-4 hover:bg-bg-soft transition-colors ${
                    !channel.isActive ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-bold text-sm text-ink">
                      {channel.name}
                      {!channel.isActive && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-gray-200 rounded text-ink-sub">
                          Hidden
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-ink-sub">{channel.description}</div>
                    <div className="text-[10px] text-ink-sub mt-1">
                      Category: <span className="font-medium">{getCategoryName(channel.categoryId)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditChannel(channel)}
                      className="px-2 py-1 text-xs font-bold text-ink-sub hover:text-ink transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteChannel(channel.id)}
                      className="px-2 py-1 text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {channels.length === 0 && (
                <div className="p-8 text-center text-ink-sub text-sm">
                  No channels yet. Add one to get started.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminApp;
