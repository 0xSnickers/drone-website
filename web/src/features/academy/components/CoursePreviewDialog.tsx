import {
  CheckCircle2,
  Loader2,
  LockOpen,
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/core/utils/cn';
import { useCartStore } from '@/features/store';
import type { PreviewCoursePayload } from '../types';

interface CoursePreviewDialogProps {
  course: PreviewCoursePayload | null;
  onClose: () => void;
}

const playbackRates = ['1.0X', '1.25X', '1.5X', '2.0X'] as const;

export function CoursePreviewDialog({ course, onClose }: CoursePreviewDialogProps) {
  const { t } = useTranslation();
  const showToast = useCartStore((state) => state.showToast);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [rateIndex, setRateIndex] = useState(0);
  const [unlockState, setUnlockState] = useState<'idle' | 'loading' | 'unlocked'>('idle');

  const handleTogglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    showToast(next ? t('feedback.playbackPlaying') : t('feedback.playbackPaused'));
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    showToast(next ? t('feedback.playbackMuted') : t('feedback.playbackUnmuted'));
  };

  const handleCycleRate = () => {
    const nextIdx = (rateIndex + 1) % playbackRates.length;
    setRateIndex(nextIdx);
    const rate = playbackRates[nextIdx] ?? '1.0X';
    showToast(t('feedback.playbackRate', { rate }));
  };

  const handleUnlock = () => {
    if (unlockState !== 'idle') return;
    setUnlockState('loading');
    window.setTimeout(() => {
      setUnlockState('unlocked');
      showToast(t('academy.modal.unlocked'));
    }, 500);
  };

  return (
    <Dialog open={course !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 overflow-hidden border-primary/30 bg-surface-lowest p-0 shadow-2xl sm:max-w-lg glow-primary-sm">
        {/* Avionics Top HUD Status Bar */}
        <div className="flex items-center justify-between border-b border-border/60 bg-surface-low px-4 py-2.5 pr-11">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-primary glow-primary-sm" />
            <span className="truncate font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
              {t('academy.modal.hudLabel')}
            </span>
          </div>
          <span className="shrink-0 rounded border border-secondary/30 bg-surface-highest px-1.5 py-0.5 font-mono text-[9px] font-semibold text-secondary">
            {t('academy.modal.specBadge')}
          </span>
        </div>

        {/* Simulated HUD Video Player */}
        <div className="group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-media-scrim select-none">
          {course ? (
            <img
              src={course.coverImage}
              alt={course.title}
              className={cn(
                'size-full object-cover transition-transform duration-700',
                isPlaying ? 'scale-105' : 'scale-100',
              )}
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-media-scrim/90 via-transparent to-media-scrim/60" />

          {/* Cockpit Crosshair & Horizon Graticule */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-35">
            <div className="h-px w-32 bg-primary" />
            <div className="absolute h-32 w-px bg-primary" />
            <div className="absolute size-16 rounded-full border border-dashed border-primary/80" />
          </div>

          {/* Telemetry Watermarks */}
          <div className="pointer-events-none absolute top-2.5 left-3 flex flex-col font-mono text-[10px] text-primary/90">
            <span>ALT: 218M</span>
            <span>SPD: 18.2M/S</span>
            <span>ISO: 100 1/120</span>
          </div>
          <div className="pointer-events-none absolute top-2.5 right-3 rounded bg-media-scrim/60 px-1.5 py-0.5 font-mono text-[10px] text-media-foreground/90 backdrop-blur-sm">
            D-LOG M // 10-BIT
          </div>

          {/* Center Play / Pause Button */}
          <button
            type="button"
            aria-label={t('academy.modal.playPauseAria')}
            onClick={handleTogglePlay}
            className="relative z-10 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 glow-primary"
          >
            {isPlaying ? (
              <span className="pointer-events-none absolute inset-0 animate-ping rounded-full border-2 border-primary/60 opacity-50" />
            ) : null}
            {isPlaying ? (
              <Pause className="size-6 fill-current" />
            ) : (
              <Play className="ml-0.5 size-6 fill-current" />
            )}
          </button>

          {/* Bottom Player Control Bar */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 bg-gradient-to-t from-media-scrim via-media-scrim/80 to-transparent p-2.5">
            <div className="relative flex h-2 w-full items-center py-1">
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-surface-highest/80">
                <div className="absolute inset-y-0 left-0 w-[62%] bg-muted-foreground/40" />
                <div className="absolute inset-y-0 left-0 w-[31%] bg-primary glow-primary-sm" />
              </div>
              <div className="pointer-events-none absolute left-[31%] size-3 -translate-x-1/2 rounded-full border border-primary bg-media-foreground glow-primary-sm" />
            </div>

            <div className="flex items-center justify-between font-mono text-[10px] text-media-foreground">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-primary">01:24</span>
                <span className="text-media-foreground/60">/</span>
                <span className="text-media-foreground/75">04:30</span>
                <span className="ml-1 rounded bg-surface-high/90 px-1.5 py-0.5 text-[9px] text-secondary">
                  {t('academy.modal.freePreviewTag')}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-media-foreground/80">
                <button
                  type="button"
                  aria-label="Volume"
                  onClick={handleToggleMute}
                  className="transition-colors hover:text-primary"
                >
                  {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCycleRate}
                  className="rounded bg-surface-high/80 px-1.5 py-0.5 font-bold transition-colors hover:text-primary"
                >
                  {playbackRates[rateIndex]}
                </button>
                <button
                  type="button"
                  aria-label="Fullscreen"
                  onClick={() => showToast(t('feedback.fullscreenHint'))}
                  className="transition-colors hover:text-primary"
                >
                  <Maximize2 className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Details & Unlock CTA */}
        <div className="flex flex-col gap-3 border-t border-border/60 bg-surface-low p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-semibold text-secondary uppercase">
                {t('academy.modal.episodeLabel')}
              </span>
              <span className="size-1 rounded-full bg-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {t('academy.modal.instructorNote')}
              </span>
            </div>
            <DialogTitle className="font-display text-base leading-snug font-semibold text-foreground">
              {course?.title ?? ''}
            </DialogTitle>
            <DialogDescription className="line-clamp-2 text-xs text-muted-foreground">
              {course?.summary ?? ''}
            </DialogDescription>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-bold text-secondary">¥0</span>
                <span className="text-xs text-muted-foreground line-through">¥399</span>
              </div>
              <span className="font-mono text-[10px] text-secondary">
                {t('academy.modal.perkNote')}
              </span>
            </div>

            <button
              type="button"
              onClick={handleUnlock}
              className={cn(
                'flex h-10 max-w-52 flex-1 items-center justify-center gap-1.5 rounded-md px-3.5 font-display text-sm font-bold transition-all active:scale-95',
                unlockState === 'unlocked'
                  ? 'bg-secondary text-secondary-foreground glow-secondary-sm'
                  : 'bg-primary text-primary-foreground glow-primary',
              )}
            >
              {unlockState === 'loading' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t('academy.modal.unlocking')}</span>
                </>
              ) : unlockState === 'unlocked' ? (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>{t('academy.modal.unlocked')}</span>
                </>
              ) : (
                <>
                  <LockOpen className="size-4" />
                  <span>{t('academy.modal.unlockIdle')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
