import { RadioTower } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function AcademyHeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative flex w-full flex-col gap-4 overflow-hidden rounded-xl border border-border/50 bg-surface-low p-4 shadow-xl">
      {/* Subtle Avionics Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 text-primary/12">
        <svg aria-hidden="true" className="size-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="academy-telemetry-grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#academy-telemetry-grid)" />
        </svg>
      </div>

      {/* Top Badge / Beacon Bar */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 rounded bg-surface-highest px-2.5 py-1">
          <span className="size-1.5 animate-pulse rounded-full bg-primary glow-primary-sm" />
          <span className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
            {t('academy.hero.badge')}
          </span>
        </div>
        <div className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-muted-foreground">
          <RadioTower className="size-3.5 text-secondary" />
          <span>{t('academy.hero.status')}</span>
        </div>
      </div>

      {/* Hero Typography & Pitch */}
      <div className="relative z-10 flex flex-col gap-1.5">
        <h1 className="font-display text-3xl leading-tight font-bold tracking-tight text-primary sm:text-4xl">
          {t('academy.hero.titleLine1')}
          <br />
          {t('academy.hero.titleLine2')}
        </h1>
        <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {t('academy.hero.subtitle')}
        </p>
      </div>

      {/* Quick Telemetry Stat Trio */}
      <div className="relative z-10 grid grid-cols-3 gap-2 pt-1">
        <div className="flex flex-col rounded-lg bg-card p-2.5">
          <span className="font-display text-2xl leading-none font-bold text-primary">
            {t('academy.hero.statCoursesVal')}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
              {t('academy.hero.statCoursesUnit')}
            </span>
          </span>
          <span className="mt-1.5 text-[11px] text-muted-foreground">
            {t('academy.hero.statCoursesLabel')}
          </span>
        </div>
        <div className="flex flex-col rounded-lg bg-card p-2.5">
          <span className="font-display text-2xl leading-none font-bold text-foreground">
            {t('academy.hero.statMentorsVal')}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
              {t('academy.hero.statMentorsUnit')}
            </span>
          </span>
          <span className="mt-1.5 text-[11px] text-muted-foreground">
            {t('academy.hero.statMentorsLabel')}
          </span>
        </div>
        <div className="flex flex-col rounded-lg bg-card p-2.5">
          <span className="font-display text-2xl leading-none font-bold text-secondary">
            {t('academy.hero.statPassVal')}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
              {t('academy.hero.statPassUnit')}
            </span>
          </span>
          <span className="mt-1.5 text-[11px] text-muted-foreground">
            {t('academy.hero.statPassLabel')}
          </span>
        </div>
      </div>
    </section>
  );
}
