import { BatteryCharging, PlayCircle, Radar, RadioTower, ShoppingCart, Video } from 'lucide-react';
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
import { cn } from '@/core/utils/cn';

export function HeroShowcaseSection() {
  const { t } = useTranslation();
  const [filmOpen, setFilmOpen] = useState(false);

  const telemetrySpecs = [
    {
      icon: Video,
      label: t('showcase.telemetry.recordingLabel'),
      value: t('showcase.telemetry.recordingValue'),
      unit: t('showcase.telemetry.recordingUnit'),
      progressClass: 'w-[92%] bg-primary glow-primary-sm',
      tone: 'primary' as const,
    },
    {
      icon: BatteryCharging,
      label: t('showcase.telemetry.enduranceLabel'),
      value: t('showcase.telemetry.enduranceValue'),
      unit: t('showcase.telemetry.enduranceUnit'),
      progressClass: 'w-[88%] bg-primary glow-primary-sm',
      tone: 'primary' as const,
    },
    {
      icon: RadioTower,
      label: t('showcase.telemetry.transmissionLabel'),
      value: t('showcase.telemetry.transmissionValue'),
      unit: t('showcase.telemetry.transmissionUnit'),
      progressClass: 'w-[95%] bg-secondary glow-secondary-sm',
      tone: 'secondary' as const,
    },
    {
      icon: Radar,
      label: t('showcase.telemetry.obstacleLabel'),
      value: t('showcase.telemetry.obstacleValue'),
      unit: t('showcase.telemetry.obstacleUnit'),
      progressClass: 'w-full bg-primary glow-primary-sm',
      tone: 'primary' as const,
    },
  ];

  return (
    <section className="relative w-full overflow-hidden px-5 pt-4 pb-6">
      {/* Atmospheric Radial Glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 size-80 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Engineering Micro-Badge */}
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface-high/80 px-3 py-1 backdrop-blur-md">
          <span className="size-1.5 animate-pulse rounded-full bg-primary glow-primary-sm" />
          <span className="font-mono text-[10px] font-semibold tracking-widest text-primary uppercase">
            {t('showcase.hero.badge')}
          </span>
        </div>

        {/* Flagship Headline */}
        <h1 className="mt-1 font-display text-3xl leading-tight font-bold tracking-tight text-foreground sm:text-4xl">
          <span>{t('showcase.hero.brand')}</span>{' '}
          <span className="text-primary">{t('showcase.hero.model')}</span>
        </h1>
        <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {t('showcase.hero.subtitle')}
        </p>

        {/* Main Drone Display Stage with Radial Reticle HUD */}
        <div className="relative mt-4 flex aspect-[4/3] w-full max-w-lg items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-surface-lowest shadow-xl">
          <img
            src="/images/aeroapex/drone-v8-pro.jpg"
            alt={t('showcase.hero.droneAlt')}
            className="size-full object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-lowest/70 via-transparent to-surface-lowest/30" />

          {/* Reticle HUD SVG Overlay */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full text-primary/25"
            fill="none"
            viewBox="0 0 320 240"
          >
            <circle
              cx="160"
              cy="120"
              r="96"
              stroke="currentColor"
              strokeDasharray="4 6"
              strokeWidth="1"
            />
            <circle
              cx="160"
              cy="120"
              r="58"
              opacity="0.45"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            <line x1="160" x2="160" y1="12" y2="28" stroke="currentColor" strokeWidth="1.5" />
            <line x1="160" x2="160" y1="212" y2="228" stroke="currentColor" strokeWidth="1.5" />
            <line x1="28" x2="46" y1="120" y2="120" stroke="currentColor" strokeWidth="1.5" />
            <line x1="274" x2="292" y1="120" y2="120" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 18 38 L 18 18 L 38 18" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 302 38 L 302 18 L 282 18" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 18 202 L 18 222 L 38 222" stroke="currentColor" strokeWidth="1.5" />
            <path d="M 302 202 L 302 222 L 282 222" stroke="currentColor" strokeWidth="1.5" />
          </svg>

          {/* Live HUD Status Pill */}
          <div className="absolute right-3 bottom-3 z-20 flex items-center gap-1.5 rounded-md border border-border/60 bg-surface-lowest/90 px-2.5 py-1 backdrop-blur-md">
            <RadioTower className="size-3.5 text-secondary" />
            <span className="font-mono text-[10px] font-semibold text-muted-foreground">
              {t('showcase.hero.flightStatus')}{' '}
              <span className="font-bold text-primary">{t('showcase.hero.ready')}</span>
            </span>
          </div>
        </div>

        {/* Telemetry Spec Quick Readout Grid */}
        <div className="mt-4 grid w-full grid-cols-2 gap-2.5 md:grid-cols-4">
          {telemetrySpecs.map((spec) => {
            const Icon = spec.icon;
            return (
              <div
                key={spec.label}
                className="flex flex-col items-start rounded-lg border border-border/50 bg-card/80 p-3 backdrop-blur-md"
              >
                <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                  <Icon
                    className={cn(
                      'size-4',
                      spec.tone === 'secondary' ? 'text-secondary' : 'text-primary',
                    )}
                  />
                  <span className="text-xs">{spec.label}</span>
                </div>
                <div className="flex w-full items-baseline justify-between gap-1">
                  <span className="shrink-0 font-display text-2xl font-bold text-foreground">
                    {spec.value}
                  </span>
                  <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
                    {spec.unit}
                  </span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-highest">
                  <div className={cn('h-full rounded-full', spec.progressClass)} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Primary & Secondary Action Buttons */}
        <div className="mt-6 flex w-full max-w-lg items-center gap-3">
          <Link
            to="/flagship"
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-3.5 font-display text-base font-semibold text-primary-foreground transition-transform active:scale-95 glow-primary"
          >
            <ShoppingCart className="size-5" />
            <span>{t('showcase.hero.preOrder')}</span>
          </Link>
          <button
            type="button"
            onClick={() => setFilmOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-high/90 px-4 py-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-highest"
          >
            <PlayCircle className="size-5 text-primary" />
            <span>{t('showcase.hero.watchFilm')}</span>
          </button>
        </div>
      </div>

      {/* Keynote Film Preview Dialog */}
      <Dialog open={filmOpen} onOpenChange={setFilmOpen}>
        <DialogContent className="border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {t('showcase.hero.filmTitle')}
            </DialogTitle>
            <DialogDescription>{t('showcase.hero.filmDescription')}</DialogDescription>
          </DialogHeader>
          <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-lowest">
            <img
              src="/images/aeroapex/aerial-lofoten.jpg"
              alt={t('showcase.hero.filmTitle')}
              className="size-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-media-scrim/40">
              <span className="rounded-full border border-primary/40 bg-surface-lowest/85 px-3 py-1 font-mono text-xs font-semibold text-primary">
                8K 60FPS · DOLBY VISION HDR
              </span>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button asChild className="w-full">
                <Link to="/flagship">{t('showcase.hero.filmAction')}</Link>
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
