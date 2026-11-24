import { Aperture, Crosshair, Sparkles, Wind } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function CoreInnovationsSection() {
  const { t } = useTranslation();

  return (
    <section className="flex w-full flex-col bg-surface-lowest/60 px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="size-2 rounded-xs bg-primary" />
            <span className="font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
              {t('showcase.innovations.eyebrow')}
            </span>
          </div>
          <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
            {t('showcase.innovations.title')}
          </h2>
        </div>
        <span className="rounded bg-surface-high px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground">
          {t('showcase.innovations.genTag')}
        </span>
      </div>

      {/* Bento Spec Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Tech Card 1: Camera Sensor */}
        <article className="flex flex-col justify-between rounded-xl border border-border/50 bg-card/85 p-4 shadow-md">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-surface-highest text-primary">
                <Aperture className="size-5" />
              </div>
              <span className="rounded bg-surface-high px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                {t('showcase.innovations.cameraTag')}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {t('showcase.innovations.cameraTitle')}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('showcase.innovations.cameraDesc')}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-low/70 p-2.5">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                {t('showcase.innovations.sensorAreaLabel')}
              </span>
              <span className="font-display text-2xl font-bold text-primary">
                {t('showcase.innovations.sensorAreaValue')}
              </span>
            </div>
            <div className="h-7 w-px bg-border" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                {t('showcase.innovations.colorDepthLabel')}
              </span>
              <span className="font-display text-xl font-bold text-foreground sm:text-2xl">
                {t('showcase.innovations.colorDepthValue')}
              </span>
            </div>
          </div>
        </article>

        {/* Tech Card 2: Obstacle Avoidance APAS */}
        <article className="flex flex-col justify-between rounded-xl border border-border/50 bg-card/85 p-4 shadow-md">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-surface-highest text-primary">
                <Crosshair className="size-5" />
              </div>
              <span className="rounded bg-surface-high px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                {t('showcase.innovations.apasTag')}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {t('showcase.innovations.apasTitle')}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('showcase.innovations.apasDesc')}
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <div className="flex-1 rounded-md bg-surface-low px-3 py-2 text-center">
              <span className="block font-mono text-[10px] font-semibold text-muted-foreground">
                {t('showcase.innovations.responseLabel')}
              </span>
              <span className="font-display text-2xl font-bold text-primary">
                12<span className="text-xs font-normal">ms</span>
              </span>
            </div>
            <div className="flex-1 rounded-md bg-surface-low px-3 py-2 text-center">
              <span className="block font-mono text-[10px] font-semibold text-muted-foreground">
                {t('showcase.innovations.rangeLabel')}
              </span>
              <span className="font-display text-2xl font-bold text-foreground">
                45<span className="text-xs font-normal">m</span>
              </span>
            </div>
          </div>
        </article>

        {/* Tech Card 3 & 4 Pair */}
        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          <article className="flex flex-col justify-between rounded-xl border border-border/50 bg-card/85 p-4 shadow-md">
            <div>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-surface-highest text-secondary">
                <Wind className="size-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground sm:text-lg">
                {t('showcase.innovations.powerTitle')}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('showcase.innovations.powerDesc')}
              </p>
            </div>
            <div className="mt-3 pt-2 font-mono text-[10px] font-bold tracking-wider text-secondary">
              {t('showcase.innovations.powerSpec')}
            </div>
          </article>

          <article className="flex flex-col justify-between rounded-xl border border-border/50 bg-card/85 p-4 shadow-md">
            <div>
              <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-surface-highest text-primary">
                <Sparkles className="size-5" />
              </div>
              <h3 className="font-display text-base font-semibold text-foreground sm:text-lg">
                {t('showcase.innovations.aiTitle')}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t('showcase.innovations.aiDesc')}
              </p>
            </div>
            <div className="mt-3 pt-2 font-mono text-[10px] font-bold tracking-wider text-primary">
              {t('showcase.innovations.aiSpec')}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
