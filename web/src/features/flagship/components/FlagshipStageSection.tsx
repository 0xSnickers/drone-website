import { Box, Minimize2, Plane, Radar, Video } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { useCartStore } from '@/features/store';
import type { EditionId, PerspectiveId } from '../types';

interface FlagshipStageSectionProps {
  edition: EditionId;
  onSelectEdition: (edition: EditionId) => void;
}

export function FlagshipStageSection({ edition, onSelectEdition }: FlagshipStageSectionProps) {
  const { t } = useTranslation();
  const showToast = useCartStore((state) => state.showToast);
  const [perspective, setPerspective] = useState<PerspectiveId>('exterior');

  const perspectives = [
    {
      id: 'exterior' as const,
      icon: Plane,
      shortLabel: t('flagship.stage.views.exteriorShort'),
      fullLabel: t('flagship.stage.views.exteriorFull'),
      image: '/images/aeroapex/drone-v8-pro.jpg',
      imgClass: 'scale-100',
    },
    {
      id: 'gimbal' as const,
      icon: Video,
      shortLabel: t('flagship.stage.views.gimbalShort'),
      fullLabel: t('flagship.stage.views.gimbalFull'),
      image: '/images/aeroapex/camera-exploded.jpg',
      imgClass: 'scale-105',
    },
    {
      id: 'folding' as const,
      icon: Minimize2,
      shortLabel: t('flagship.stage.views.foldingShort'),
      fullLabel: t('flagship.stage.views.foldingFull'),
      image: '/images/aeroapex/drone-v8-pro.jpg',
      imgClass: 'scale-125 object-left',
    },
    {
      id: 'radar' as const,
      icon: Radar,
      shortLabel: t('flagship.stage.views.radarShort'),
      fullLabel: t('flagship.stage.views.radarFull'),
      image: '/images/aeroapex/drone-v8-pro.jpg',
      imgClass: 'scale-115 object-top',
    },
  ] as const;

  const activeView = perspectives.find((item) => item.id === perspective) ?? perspectives[0];

  const handleSwitchPerspective = (next: (typeof perspectives)[number]) => {
    setPerspective(next.id);
    showToast(t('flagship.stage.switchedToast', { label: next.fullLabel }));
  };

  return (
    <section className="relative flex flex-col gap-4 overflow-hidden px-5 pt-4 pb-6">
      {/* Ambient Engineering Blueprint Grid */}
      <div className="pointer-events-none absolute inset-0 text-primary/15">
        <svg aria-hidden="true" className="size-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="aero-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="currentColor"
                strokeDasharray="2 4"
                strokeWidth="0.6"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#aero-grid)" />
        </svg>
      </div>

      {/* Product Telemetry Header Chip */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-surface-high px-2.5 py-0.5 font-mono text-[10px] font-semibold text-primary glow-primary-sm">
            <span className="mr-1.5 size-1.5 animate-pulse rounded-full bg-primary" />
            {t('flagship.stage.sysChip')}
          </span>
          <span className="rounded-full bg-surface-high px-2 py-0.5 font-mono text-[10px] font-semibold text-secondary">
            {t('flagship.stage.dolbyChip')}
          </span>
        </div>
        <div className="text-right">
          <span className="block font-mono text-[10px] font-semibold text-muted-foreground">
            {t('flagship.stage.seriesRef')}
          </span>
          <span className="font-display text-lg font-bold text-primary">
            {t('flagship.stage.modelRef')}
          </span>
        </div>
      </div>

      {/* Main Visual Stage Frame */}
      <div className="relative z-10 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-surface-lowest shadow-2xl sm:aspect-[16/10]">
        <img
          src={activeView.image}
          alt={activeView.fullLabel}
          className={cn('size-full object-cover transition-all duration-300', activeView.imgClass)}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-lowest/75 via-transparent to-surface-lowest/35" />

        {/* Corner HUD Markers */}
        <div className="pointer-events-none absolute top-3 left-3 font-mono text-[10px] font-semibold text-primary/60">
          + 00.12° N
        </div>
        <div className="pointer-events-none absolute top-3 right-3 font-mono text-[10px] font-semibold text-primary/60">
          CAD-LIDAR +
        </div>
        <div className="pointer-events-none absolute bottom-14 left-3 font-mono text-[10px] text-muted-foreground/60">
          [FOV 84° SENSOR]
        </div>
        <div className="pointer-events-none absolute right-3 bottom-14 font-mono text-[10px] text-muted-foreground/60">
          RAW-DNG 14BIT
        </div>

        {/* Dynamic Target Ring */}
        <div className="pointer-events-none absolute size-44 rounded-full border border-primary/20" />

        {/* Active Mode Floating Pill */}
        <div className="absolute inset-x-3 bottom-3 z-20 flex items-center justify-between rounded-lg border border-border/60 bg-surface-high/90 px-3 py-1.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <Box className="size-4 text-primary" />
            <span className="font-mono text-[10px] font-semibold text-primary uppercase">
              {t('flagship.stage.viewPrefix', { label: activeView.fullLabel })}
            </span>
          </div>
          <span className="font-mono text-[10px] font-semibold text-muted-foreground">
            {t('flagship.stage.videoSpec')}
          </span>
        </div>
      </div>

      {/* 4-Tab Perspective Switcher */}
      <div className="relative z-10 grid grid-cols-4 gap-2">
        {perspectives.map((item) => {
          const Icon = item.icon;
          const active = item.id === perspective;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSwitchPerspective(item)}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg p-2.5 transition-all',
                active
                  ? 'border border-primary/40 bg-surface-high text-primary glow-primary-sm'
                  : 'border border-border/40 bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              <span className="mt-1 text-[11px] font-semibold whitespace-nowrap">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Edition Quick Select Box */}
      <div className="relative z-10 mt-1 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold text-muted-foreground">
            {t('flagship.editions.sectionLabel')}
          </span>
          <span className="font-mono text-[10px] font-semibold text-primary">
            {t('flagship.editions.shippingTag')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onSelectEdition('standard')}
            className={cn(
              'flex flex-col justify-between rounded-lg p-3.5 text-left transition-all',
              edition === 'standard'
                ? 'border border-primary bg-surface-high glow-primary-sm'
                : 'border border-border/50 bg-card opacity-80 hover:opacity-100',
            )}
          >
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    'font-display text-base font-semibold',
                    edition === 'standard' ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {t('flagship.editions.standardName')}
                </span>
                <span
                  className={cn(
                    'size-2 rounded-full',
                    edition === 'standard'
                      ? 'bg-primary glow-primary-sm'
                      : 'bg-muted-foreground/40',
                  )}
                />
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {t('flagship.editions.standardDesc')}
              </p>
            </div>
            <div className="mt-3">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">RMB</span>
              <span className="ml-1 font-display text-lg font-bold text-foreground">6,999</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectEdition('combo')}
            className={cn(
              'relative flex flex-col justify-between rounded-lg p-3.5 text-left transition-all',
              edition === 'combo'
                ? 'border border-primary bg-surface-high glow-primary-sm'
                : 'border border-border/50 bg-card opacity-80 hover:opacity-100',
            )}
          >
            <div className="absolute -top-2.5 right-2 rounded bg-secondary px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider text-secondary-foreground uppercase">
              {t('flagship.editions.comboBadge')}
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    'font-display text-base font-semibold',
                    edition === 'combo' ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {t('flagship.editions.comboName')}
                </span>
                <span
                  className={cn(
                    'size-2 rounded-full',
                    edition === 'combo' ? 'bg-primary glow-primary-sm' : 'bg-muted-foreground/40',
                  )}
                />
              </div>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {t('flagship.editions.comboDesc')}
              </p>
            </div>
            <div className="mt-3">
              <span className="font-mono text-[10px] font-semibold text-primary">RMB</span>
              <span className="ml-1 font-display text-xl font-bold text-primary">8,999</span>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
}
