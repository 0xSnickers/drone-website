import { ChevronRight, Play, Scale, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
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

export function AcademyToolkitSection() {
  const { t } = useTranslation();
  const [activeTool, setActiveTool] = useState<'preflight' | 'airspace' | null>(null);

  return (
    <section className="flex flex-col gap-4 px-5 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
            {t('community.academy.eyebrow')}
          </span>
          <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            {t('community.academy.title')}
          </h2>
        </div>
        <Link to="/academy" className="text-xs font-semibold text-primary hover:underline">
          {t('community.academy.allCourses')}
        </Link>
      </div>

      {/* Academy Course Spotlight Card */}
      <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-md">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-lg">
          <img
            src="/images/aeroapex/camera-exploded.jpg"
            alt={t('community.academy.courseTitle')}
            className="size-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-media-scrim/35">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Play className="ml-0.5 size-4 fill-current" />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-[10px] font-semibold text-primary">
            {t('community.academy.courseEp')}
          </span>
          <h3 className="truncate font-display text-base font-semibold text-foreground sm:text-lg">
            {t('community.academy.courseTitle')}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {t('community.academy.courseDesc')}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              {t('community.academy.courseDuration')}
            </span>
            <span className="font-mono text-[10px] font-semibold text-primary">
              {t('community.academy.courseCert')}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Utilities Bento Grid */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setActiveTool('preflight')}
          className="group flex flex-col justify-between rounded-xl border border-border/50 bg-card p-4 text-left shadow-md transition-colors hover:bg-surface-high"
        >
          <div className="mb-2 flex w-full items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded bg-primary/15 text-primary">
              <ShieldAlert className="size-5" />
            </div>
            <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-base font-semibold text-foreground">
              {t('community.academy.preFlightTitle')}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {t('community.academy.preFlightDesc')}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTool('airspace')}
          className="group flex flex-col justify-between rounded-xl border border-border/50 bg-card p-4 text-left shadow-md transition-colors hover:bg-surface-high"
        >
          <div className="mb-2 flex w-full items-center justify-between">
            <div className="flex size-10 items-center justify-center rounded bg-secondary/15 text-secondary">
              <Scale className="size-5" />
            </div>
            <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-secondary" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-base font-semibold text-foreground">
              {t('community.academy.noFlyTitle')}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {t('community.academy.noFlyDesc')}
            </span>
          </div>
        </button>
      </div>

      {/* Diagnostic / Airspace Dialog */}
      <Dialog open={activeTool !== null} onOpenChange={(open) => !open && setActiveTool(null)}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {activeTool === 'airspace'
                ? t('community.academy.noFlyModalTitle')
                : t('community.academy.preFlightModalTitle')}
            </DialogTitle>
            <DialogDescription>
              {activeTool === 'airspace'
                ? t('community.academy.noFlyModalDesc')
                : t('community.academy.preFlightModalDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">{t('common.confirm')}</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
