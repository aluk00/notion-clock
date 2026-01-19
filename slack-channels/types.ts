export interface SlackChannel {
  id: string;
  name: string;           // Channel name (e.g., "#creative-briefs")
  description: string;    // What this channel is for
  slackUrl: string;       // Deep link to the channel
  categoryId: string;     // Reference to parent category
  order: number;          // Display order within category
  isActive: boolean;      // Whether to show this channel
}

export interface ChannelCategory {
  id: string;
  name: string;           // Category name (e.g., "Creative & Briefs")
  icon: string;           // Icon identifier
  color: string;          // Category accent color
  order: number;          // Display order
  sectionUrl?: string;    // Slack channel section URL (optional)
}

export interface ChannelCategoryWithChannels extends ChannelCategory {
  channels: SlackChannel[];
}
