import {
  BadgeCheck,
  Heart,
  MapPin,
  MessageSquare,
  Play,
  RefreshCw,
  Share2,
  Sparkles,
  Video,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/core/utils/cn';
import { useCartStore } from '@/features/store';

export function SkyAwardSection() {
  const { t } = useTranslation();
  const showToast = useCartStore((state) => state.showToast);
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [reelOpen, setReelOpen] = useState(false);

  const handleSync = () => {
    if (syncing) return;
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      showToast(t('community.ribbon.syncedToast'));
    }, 500);
  };

  const handleToggleFollow = () => {
    const next = !following;
    setFollowing(next);
    const name = t('community.skyAward.pilotName');
    showToast(next ? t('feedback.followed', { name }) : t('feedback.unfollowed', { name }));
  };

  const handleToggleLike = () => {
    const next = !liked;
    setLiked(next);
    showToast(next ? t('feedback.liked') : t('feedback.unliked'));
  };

  return (
    <>
      {/* Top Community Quick Bar / Stat Ribbon */}
      <section className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 animate-pulse rounded-full bg-primary glow-primary-sm" />
          <span className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
            {t('community.ribbon.meshStatus')}
          </span>
        </div>
        <button
          type="button"
          disabled={syncing}
          onClick={handleSync}
          className="flex shrink-0 items-center gap-1 rounded bg-surface-high px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary disabled:opacity-70"
        >
          <RefreshCw className={cn('size-3.5', syncing && 'animate-spin text-primary')} />
          <span>{syncing ? t('feedback.syncing') : t('community.ribbon.syncBtn')}</span>
        </button>
      </section>

      {/* Daily Sky Award Hero Spotlight */}
      <section className="px-5 pb-6">
        <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-surface-low shadow-xl">
          <div className="relative h-80 w-full sm:h-96">
            <img
              src="/images/aeroapex/aerial-lofoten.jpg"
              alt={t('community.skyAward.location')}
              className="size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-media-scrim via-media-scrim/45 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-media-scrim/65 via-transparent to-transparent" />

            {/* Top Badges */}
            <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-surface-lowest/85 px-2.5 py-1 backdrop-blur-md">
                <Sparkles className="size-3.5 text-secondary" />
                <span className="font-mono text-[10px] font-semibold text-primary uppercase">
                  {t('community.skyAward.badge')}
                </span>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded bg-surface-highest/85 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary backdrop-blur-md">
                <Video className="size-3" />
                {t('community.skyAward.spec')}
              </span>
            </div>

            {/* Center Play Button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                aria-label={t('community.skyAward.playAria')}
                onClick={() => setReelOpen(true)}
                className="flex size-14 items-center justify-center rounded-full bg-surface-lowest/75 text-primary backdrop-blur-xl transition-transform hover:scale-105 active:scale-95 glow-primary"
              >
                <Play className="ml-0.5 size-7 fill-current" />
              </button>
            </div>

            {/* Bottom Content Overlay */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-high font-display text-sm font-bold text-primary ring-1 ring-primary/40">
                  AS
                </div>
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-center gap-1">
                    <span className="truncate font-display text-base font-semibold text-media-foreground">
                      {t('community.skyAward.pilotName')}
                    </span>
                    <BadgeCheck className="size-4 shrink-0 text-primary" />
                  </div>
                  <span className="truncate font-mono text-[10px] text-media-foreground/75">
                    {t('community.skyAward.pilotMeta')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  className={cn(
                    'ml-auto shrink-0 rounded px-3 py-1 text-xs font-semibold transition-all',
                    following
                      ? 'border border-primary/40 bg-surface-high text-primary'
                      : 'bg-primary text-primary-foreground glow-primary-sm',
                  )}
                >
                  {following ? t('community.skyAward.following') : t('community.skyAward.follow')}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs text-media-foreground/80">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1 text-primary">
                    <MapPin className="size-3.5" />
                    <span>{t('community.skyAward.location')}</span>
                  </span>
                  <span className="rounded bg-surface-highest/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-media-foreground">
                    {t('community.skyAward.gear')}
                  </span>
                </div>

                <div className="flex items-center gap-4 font-mono text-[10px] font-semibold">
                  <button
                    type="button"
                    onClick={handleToggleLike}
                    className="flex items-center gap-1 transition-colors hover:text-primary"
                  >
                    <Heart
                      className={cn(
                        'size-4',
                        liked ? 'fill-secondary text-secondary' : 'text-media-foreground',
                      )}
                    />
                    <span>{liked ? '3.8w' : '3.7w'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast(t('feedback.commentsOpening'))}
                    className="flex items-center gap-1 transition-colors hover:text-primary"
                  >
                    <MessageSquare className="size-4" />
                    <span>420</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Share"
                    onClick={() => showToast(t('feedback.linkCopied'))}
                    className="flex items-center transition-colors hover:text-primary"
                  >
                    <Share2 className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={reelOpen} onOpenChange={setReelOpen}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {t('community.skyAward.modalTitle')}
            </DialogTitle>
            <DialogDescription>{t('community.skyAward.modalDesc')}</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-lg">
            <img
              src="/images/aeroapex/aerial-lofoten.jpg"
              alt={t('community.skyAward.modalTitle')}
              className="aspect-video w-full object-cover"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">{t('common.confirm')}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
