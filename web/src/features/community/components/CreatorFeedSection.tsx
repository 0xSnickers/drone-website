import { Bookmark, Bolt, Gauge, Heart, Loader2, PlaneTakeoff, Radio, Sun } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { useCartStore } from '@/features/store';
import {
  communityFeedItems,
  communityHashtags,
  type CommunityTagId,
  type FeedWorkItem,
} from '../data/communityData';

const specIcons = {
  gauge: Gauge,
  takeoff: PlaneTakeoff,
  sun: Sun,
  bolt: Bolt,
} as const;

export function CreatorFeedSection() {
  const { t } = useTranslation();
  const showToast = useCartStore((state) => state.showToast);
  const [sortBy, setSortBy] = useState<'latest' | 'hot'>('latest');
  const [activeTag, setActiveTag] = useState<CommunityTagId>('all');
  const [expanded, setExpanded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  const filtered = communityFeedItems.filter((item) =>
    activeTag === 'all' ? true : item.tag === activeTag,
  );

  const sorted = [...filtered].sort((a, b) =>
    sortBy === 'hot' ? b.likes - a.likes : a.createdOrder - b.createdOrder,
  );

  const displayedItems: FeedWorkItem[] =
    activeTag === 'all' && !expanded ? sorted.slice(0, 4) : sorted;

  const canLoadMore = activeTag === 'all' && !expanded && sorted.length > 4;

  const handleSortChange = (next: 'latest' | 'hot') => {
    setSortBy(next);
    showToast(
      t('feedback.sortedBy', {
        mode: next === 'latest' ? t('community.feed.sortLatest') : t('community.feed.sortHot'),
      }),
    );
  };

  const handleTagChange = (tagId: CommunityTagId, label: string) => {
    setActiveTag(tagId);
    showToast(t('feedback.tagFiltered', { tag: label }));
  };

  const toggleBookmark = (id: string) => {
    const exists = bookmarkedIds.includes(id);
    setBookmarkedIds((prev) => (exists ? prev.filter((entry) => entry !== id) : [...prev, id]));
    showToast(exists ? t('feedback.unbookmarked') : t('feedback.bookmarked'));
  };

  const handleLoadMore = () => {
    if (!canLoadMore || loadingMore) return;
    setLoadingMore(true);
    window.setTimeout(() => {
      setLoadingMore(false);
      setExpanded(true);
      showToast(t('feedback.loadedMore'));
    }, 350);
  };

  return (
    <section className="flex flex-col gap-4 px-5 pb-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
            {t('community.feed.eyebrow')}
          </span>
          <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            {t('community.feed.title')}
          </h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleSortChange('latest')}
            className={cn(
              'rounded px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors',
              sortBy === 'latest'
                ? 'bg-surface-high text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('community.feed.sortLatest')}
          </button>
          <button
            type="button"
            onClick={() => handleSortChange('hot')}
            className={cn(
              'rounded px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors',
              sortBy === 'hot'
                ? 'bg-surface-high text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t('community.feed.sortHot')}
          </button>
        </div>
      </div>

      {/* Quick Hashtag Pills */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
        {communityHashtags.map((tag) => {
          const active = activeTag === tag.id;
          const label = t(tag.labelKey);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagChange(tag.id, label)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1 font-mono text-[10px] font-semibold transition-colors',
                active
                  ? 'bg-surface-highest text-primary ring-1 ring-primary/40'
                  : 'bg-surface-high text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Feed Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {displayedItems.map((work) => {
          const SpecIcon = specIcons[work.specIcon];
          const isSaved = bookmarkedIds.includes(work.id);
          const title = t(work.titleKey);

          return (
            <article
              key={work.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-md"
            >
              <div className="relative h-44 w-full overflow-hidden">
                <img
                  src={work.image}
                  alt={title}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-media-scrim/85 via-transparent to-transparent" />

                <span
                  className={cn(
                    'absolute top-2 left-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-md',
                    work.badgeTone === 'solidSecondary'
                      ? 'bg-secondary text-secondary-foreground'
                      : work.badgeTone === 'secondary'
                        ? 'bg-surface-lowest/85 text-secondary'
                        : 'bg-surface-lowest/85 text-primary',
                  )}
                >
                  {t(work.badgeKey)}
                </span>

                <button
                  type="button"
                  aria-label="Bookmark"
                  onClick={() => toggleBookmark(work.id)}
                  className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-surface-lowest/65 text-media-foreground backdrop-blur-md transition-colors hover:text-secondary"
                >
                  <Bookmark className={cn('size-3.5', isSaved && 'fill-primary text-primary')} />
                </button>

                <div className="absolute bottom-2 left-2 flex items-center gap-1 font-mono text-[10px] font-semibold text-media-foreground">
                  <SpecIcon className="size-3.5" />
                  <span>{t(work.specKey)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 p-2.5">
                <h3 className="line-clamp-1 font-display text-sm leading-snug font-semibold text-foreground">
                  {title}
                </h3>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-high font-mono text-[9px] font-bold text-primary">
                      {work.author.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">@{work.author}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 font-mono text-[10px] font-semibold text-muted-foreground">
                    <Heart className="size-3.5 fill-secondary text-secondary" />
                    <span>{work.likesDisplay}</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Load More Footer */}
      {activeTag === 'all' ? (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            disabled={!canLoadMore || loadingMore}
            onClick={handleLoadMore}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-surface-high py-3 text-xs font-semibold text-primary transition-colors hover:bg-surface-highest disabled:opacity-60"
          >
            {loadingMore ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Radio className="size-4" />
            )}
            <span>
              {loadingMore
                ? t('feedback.loadingMore')
                : canLoadMore
                  ? t('community.feed.loadMore')
                  : t('community.feed.allLoaded')}
            </span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
