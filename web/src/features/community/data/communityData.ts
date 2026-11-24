export type CommunityTagId = 'all' | 'cinema8k' | 'cityFpv' | 'snowPeak' | 'starTrail' | 'lowDive';

export interface FeedWorkItem {
  id: string;
  tag: Exclude<CommunityTagId, 'all'>;
  image: string;
  badgeKey: string;
  badgeTone: 'primary' | 'secondary' | 'solidSecondary';
  specKey: string;
  specIcon: 'gauge' | 'takeoff' | 'sun' | 'bolt';
  titleKey: string;
  author: string;
  likes: number;
  likesDisplay: string;
  createdOrder: number;
}

export const communityHashtags: { id: CommunityTagId; labelKey: string }[] = [
  { id: 'all', labelKey: 'community.feed.tags.all' },
  { id: 'cinema8k', labelKey: 'community.feed.tags.cinema8k' },
  { id: 'cityFpv', labelKey: 'community.feed.tags.cityFpv' },
  { id: 'snowPeak', labelKey: 'community.feed.tags.snowPeak' },
  { id: 'starTrail', labelKey: 'community.feed.tags.starTrail' },
  { id: 'lowDive', labelKey: 'community.feed.tags.lowDive' },
];

export const communityFeedItems: FeedWorkItem[] = [
  {
    id: 'tianmen-road',
    tag: 'cinema8k',
    image: '/images/aeroapex/aerial-winding-road.jpg',
    badgeKey: 'community.feed.cards.tianmenBadge',
    badgeTone: 'primary',
    specKey: 'community.feed.cards.tianmenSpec',
    specIcon: 'gauge',
    titleKey: 'community.feed.cards.tianmenTitle',
    author: 'Linna_Aero',
    likes: 12000,
    likesDisplay: '1.2w',
    createdOrder: 1,
  },
  {
    id: 'shenzhen-night',
    tag: 'starTrail',
    image: '/images/aeroapex/aerial-cybercity.jpg',
    badgeKey: 'community.feed.cards.shenzhenBadge',
    badgeTone: 'secondary',
    specKey: 'community.feed.cards.shenzhenSpec',
    specIcon: 'takeoff',
    titleKey: 'community.feed.cards.shenzhenTitle',
    author: 'NeonDrifter',
    likes: 8900,
    likesDisplay: '8.9k',
    createdOrder: 2,
  },
  {
    id: 'sanya-coral',
    tag: 'cinema8k',
    image: '/images/aeroapex/aerial-coral-sea.jpg',
    badgeKey: 'community.feed.cards.sanyaBadge',
    badgeTone: 'primary',
    specKey: 'community.feed.cards.sanyaSpec',
    specIcon: 'sun',
    titleKey: 'community.feed.cards.sanyaTitle',
    author: 'CoralWing',
    likes: 5400,
    likesDisplay: '5.4k',
    createdOrder: 3,
  },
  {
    id: 'forest-fpv',
    tag: 'lowDive',
    image: '/images/aeroapex/aerial-winding-road.jpg',
    badgeKey: 'community.feed.cards.forestBadge',
    badgeTone: 'solidSecondary',
    specKey: 'community.feed.cards.forestSpec',
    specIcon: 'bolt',
    titleKey: 'community.feed.cards.forestTitle',
    author: 'GhostFPV',
    likes: 15000,
    likesDisplay: '1.5w',
    createdOrder: 4,
  },
  {
    id: 'iceland-coast',
    tag: 'cityFpv',
    image: '/images/aeroapex/aerial-lofoten.jpg',
    badgeKey: 'community.feed.cards.icelandBadge',
    badgeTone: 'primary',
    specKey: 'community.feed.cards.icelandSpec',
    specIcon: 'gauge',
    titleKey: 'community.feed.cards.icelandTitle',
    author: 'NordicWing',
    likes: 9600,
    likesDisplay: '9.6k',
    createdOrder: 5,
  },
  {
    id: 'dolomites-peak',
    tag: 'snowPeak',
    image: '/images/aeroapex/aerial-lofoten.jpg',
    badgeKey: 'community.feed.cards.dolomitesBadge',
    badgeTone: 'primary',
    specKey: 'community.feed.cards.dolomitesSpec',
    specIcon: 'takeoff',
    titleKey: 'community.feed.cards.dolomitesTitle',
    author: 'AlpinePulse',
    likes: 18400,
    likesDisplay: '1.8w',
    createdOrder: 6,
  },
];
