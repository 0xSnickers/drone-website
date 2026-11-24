import {
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardCheck,
  Film,
  Loader2,
  MapPin,
  Palette,
  Plane,
  Play,
  PlaySquare,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { useCartStore } from '@/features/store';
import type { AcademyCategoryId, PreviewCoursePayload } from '../types';
import { AcademyHeroSection } from './AcademyHeroSection';
import { CoursePreviewDialog } from './CoursePreviewDialog';

const categoryTabs: { id: AcademyCategoryId; labelKey: string }[] = [
  { id: 'all', labelKey: 'academy.categories.all' },
  { id: 'beginner', labelKey: 'academy.categories.beginner' },
  { id: 'practice', labelKey: 'academy.categories.practice' },
  { id: 'grading', labelKey: 'academy.categories.grading' },
  { id: 'license', labelKey: 'academy.categories.license' },
];

export function AcademyView() {
  const { t } = useTranslation();
  const showToast = useCartStore((state) => state.showToast);
  const [activeCategory, setActiveCategory] = useState<AcademyCategoryId>('all');
  const [previewCourse, setPreviewCourse] = useState<PreviewCoursePayload | null>(null);
  const [locatingCenters, setLocatingCenters] = useState(false);
  const [sichuanBooking, setSichuanBooking] = useState<'idle' | 'loading' | 'booked'>('idle');

  const handleSelectCategory = (id: AcademyCategoryId, label: string) => {
    setActiveCategory(id);
    showToast(t('feedback.categoryFiltered', { category: label }));
  };

  const handleLocateCenters = () => {
    if (locatingCenters) return;
    setLocatingCenters(true);
    window.setTimeout(() => {
      setLocatingCenters(false);
      showToast(t('academy.certification.centersToast'));
    }, 450);
  };

  const handleBookSichuan = () => {
    if (sichuanBooking !== 'idle') return;
    setSichuanBooking('loading');
    window.setTimeout(() => {
      setSichuanBooking('booked');
      showToast(t('academy.workshops.sichuanBookedToast'));
    }, 450);
  };

  const matches = (category: Exclude<AcademyCategoryId, 'all'>) =>
    activeCategory === 'all' || activeCategory === category;

  const trackCards = [
    {
      id: 'cinema',
      category: 'practice' as const,
      tag: t('academy.tracks.cinemaTag'),
      tagTone: 'primary' as const,
      rightMeta: t('academy.tracks.cinemaRating'),
      rightStar: true,
      title: t('academy.tracks.cinemaTitle'),
      desc: t('academy.tracks.cinemaDesc'),
      meta: t('academy.tracks.cinemaMeta'),
      cta: t('academy.tracks.cinemaCta'),
      icon: PlaySquare,
      coverImage: '/images/aeroapex/aerial-winding-road.jpg',
    },
    {
      id: 'safety',
      category: 'beginner' as const,
      tag: t('academy.tracks.safetyTag'),
      tagTone: 'secondary' as const,
      rightMeta: t('academy.tracks.safetyPrice'),
      rightStar: false,
      title: t('academy.tracks.safetyTitle'),
      desc: t('academy.tracks.safetyDesc'),
      meta: t('academy.tracks.safetyMeta'),
      cta: t('academy.tracks.safetyCta'),
      icon: ShieldCheck,
      coverImage: '/images/aeroapex/drone-v8-pro.jpg',
    },
    {
      id: 'color',
      category: 'grading' as const,
      tag: t('academy.tracks.colorTag'),
      tagTone: 'primary' as const,
      rightMeta: t('academy.tracks.colorTools'),
      rightStar: false,
      title: t('academy.tracks.colorTitle'),
      desc: t('academy.tracks.colorDesc'),
      meta: t('academy.tracks.colorMeta'),
      cta: t('academy.tracks.colorCta'),
      icon: Film,
      coverImage: '/images/aeroapex/aerial-cybercity.jpg',
    },
  ];

  const visibleTracks = trackCards.filter((card) => matches(card.category));

  const openFeaturedPreview = () => {
    setPreviewCourse({
      title: t('academy.featured.title'),
      summary: t('academy.modal.defaultSummary'),
      coverImage: '/images/aeroapex/aerial-lofoten.jpg',
    });
  };

  return (
    <div className="flex flex-col gap-6 px-5 pt-4 pb-8">
      {/* Section 1: Academy Hero HUD Banner */}
      <AcademyHeroSection />

      {/* Section 2: Category Pill Selector */}
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-0.5">
        {categoryTabs.map((tab) => {
          const active = activeCategory === tab.id;
          const label = t(tab.labelKey);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectCategory(tab.id, label)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all',
                active
                  ? 'bg-primary text-primary-foreground glow-primary-sm'
                  : 'bg-surface-high text-foreground hover:bg-surface-highest',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Section 3: Featured Masterclass Card */}
      {matches('practice') ? (
        <article className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-surface-low shadow-xl">
          <div
            role="button"
            tabIndex={0}
            onClick={openFeaturedPreview}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') openFeaturedPreview();
            }}
            className="group relative h-48 w-full cursor-pointer overflow-hidden bg-surface-high sm:h-60"
          >
            <img
              src="/images/aeroapex/aerial-lofoten.jpg"
              alt={t('academy.featured.title')}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-low via-media-scrim/35 to-transparent" />

            <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded bg-surface-lowest/85 px-2.5 py-1 backdrop-blur-md">
              <Star className="size-3.5 fill-secondary text-secondary" />
              <span className="font-mono text-[10px] font-semibold text-foreground">
                {t('academy.featured.badge')}
              </span>
            </div>

            <div className="absolute top-3 right-3 rounded border border-primary/40 bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary backdrop-blur-md">
              {t('academy.featured.categoryTag')}
            </div>

            <div className="absolute right-3 bottom-3 rounded bg-surface-lowest/85 px-2 py-0.5 font-mono text-[10px] tracking-widest text-primary uppercase">
              {t('academy.featured.viewpointBadge')}
            </div>

            {/* Center Radar Pulse Preview Button */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative flex items-center justify-center">
                <div className="animate-radar absolute size-14 rounded-full bg-primary/25" />
                <div className="relative flex items-center gap-2 rounded-full border border-primary/45 bg-surface-lowest/90 px-3.5 py-2 backdrop-blur-md transition-transform group-hover:scale-105 glow-primary">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Play className="ml-0.5 size-3.5 fill-current" />
                  </span>
                  <span className="font-mono text-[11px] font-bold tracking-wider text-primary">
                    {t('academy.featured.previewBtn')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-high font-display text-xs font-bold text-primary ring-1 ring-primary/35">
                MC
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-display text-base font-semibold text-foreground">
                  {t('academy.featured.instructor')}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {t('academy.featured.instructorTitle')}
                </span>
              </div>
            </div>

            <p className="text-sm leading-snug font-medium text-foreground">
              {t('academy.featured.title')}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-4 text-primary" />
                {t('academy.featured.duration')}
              </span>
              <span className="inline-flex items-center gap-1">
                <Palette className="size-4 text-primary" />
                {t('academy.featured.bonus')}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between rounded-lg bg-card p-3">
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-secondary">¥0</span>
                  <span className="text-xs text-muted-foreground line-through">¥399</span>
                </div>
                <span className="font-mono text-[10px] font-semibold text-secondary">
                  {t('academy.featured.perkNote')}
                </span>
              </div>
              <button
                type="button"
                onClick={openFeaturedPreview}
                className="flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 font-display text-sm font-bold text-primary-foreground transition-transform active:scale-95 glow-primary-sm"
              >
                <Play className="size-4 fill-current" />
                <span>{t('academy.featured.cta')}</span>
              </button>
            </div>
          </div>
        </article>
      ) : null}

      {/* Section 4: Official Course Tracks Matrix */}
      {visibleTracks.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <span className="h-4 w-1 rounded-full bg-primary" />
              {t('academy.tracks.title')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
            >
              <span>{t('academy.tracks.viewAll')}</span>
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {visibleTracks.map((track) => {
              const Icon = track.icon;
              return (
                <article
                  key={track.id}
                  className="flex flex-col justify-between gap-2.5 rounded-xl border border-border/50 bg-surface-low p-4 shadow-md"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase',
                          track.tagTone === 'secondary'
                            ? 'bg-secondary/20 text-secondary'
                            : 'bg-card text-primary',
                        )}
                      >
                        {track.tag}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 font-mono text-[10px] font-semibold',
                          track.rightStar ? 'text-secondary' : 'text-muted-foreground',
                        )}
                      >
                        {track.rightStar ? <Star className="size-3.5 fill-current" /> : null}
                        {track.rightMeta}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-semibold text-foreground">
                      {track.title}
                    </h3>
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {track.desc}
                    </p>
                  </div>

                  <div className="mt-1 flex items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="size-4 shrink-0 text-primary" />
                      <span>{track.meta}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewCourse({
                          title: track.title,
                          summary: track.desc,
                          coverImage: track.coverImage,
                        })
                      }
                      className="shrink-0 rounded bg-surface-high px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-surface-highest"
                    >
                      {track.cta}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Section 5: Official Flight Certification Direct Pass */}
      {matches('license') ? (
        <section className="relative flex flex-col gap-3 overflow-hidden rounded-xl border border-primary/20 bg-surface-low p-4 shadow-xl">
          <div className="pointer-events-none absolute -right-8 -bottom-8 size-32 rounded-full bg-primary/10 blur-2xl" />

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Award className="size-6 shrink-0 text-secondary" />
              <div className="flex flex-col">
                <span className="font-mono text-[10px] font-semibold tracking-widest text-secondary uppercase">
                  {t('academy.certification.eyebrow')}
                </span>
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {t('academy.certification.title')}
                </h2>
              </div>
            </div>
            <span className="shrink-0 rounded bg-card px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
              {t('academy.certification.tag')}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('academy.certification.desc')}
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <div className="flex items-center gap-2.5 rounded-lg bg-card p-3">
              <ClipboardCheck className="size-5 shrink-0 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">
                  {t('academy.certification.theoryTitle')}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t('academy.certification.theorySub')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg bg-card p-3">
              <Plane className="size-5 shrink-0 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">
                  {t('academy.certification.baseTitle')}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t('academy.certification.baseSub')}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={locatingCenters}
            onClick={handleLocateCenters}
            className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-surface-high font-display text-sm font-semibold text-primary transition-colors hover:bg-surface-highest disabled:opacity-70"
          >
            {locatingCenters ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t('feedback.locatingCenters')}</span>
              </>
            ) : (
              <>
                <MapPin className="size-4" />
                <span>{t('academy.certification.cta')}</span>
              </>
            )}
          </button>
        </section>
      ) : null}

      {/* Section 6: Offline Flight Workshops */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
              <span className="h-4 w-1 rounded-full bg-secondary" />
              {t('academy.workshops.title')}
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {t('academy.workshops.subtitle')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => showToast(t('academy.workshops.sanyaToast'))}
            className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>{t('academy.workshops.recap')}</span>
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Workshop 1: Western Sichuan */}
          <article className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-surface-low shadow-md">
            <div className="relative h-36 w-full overflow-hidden bg-card">
              <img
                src="/images/aeroapex/aerial-winding-road.jpg"
                alt={t('academy.workshops.sichuanTitle')}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-low via-media-scrim/35 to-transparent" />
              <div className="absolute top-2.5 left-2.5 rounded bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-secondary-foreground uppercase">
                {t('academy.workshops.sichuanBadge')}
              </div>
              <div className="absolute bottom-2.5 left-3 font-display text-base font-semibold text-media-foreground">
                {t('academy.workshops.sichuanTitle')}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  <span>{t('academy.workshops.sichuanDate')}</span>
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground">
                  {t('academy.workshops.sichuanMeta')}
                </span>
              </div>
              <button
                type="button"
                disabled={sichuanBooking !== 'idle'}
                onClick={handleBookSichuan}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-md px-3.5 py-2 text-xs font-bold transition-transform active:scale-95',
                  sichuanBooking === 'booked'
                    ? 'bg-secondary text-secondary-foreground glow-secondary-sm'
                    : 'bg-primary text-primary-foreground glow-primary-sm',
                )}
              >
                {sichuanBooking === 'loading' ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>{t('feedback.bookingWorkshop')}</span>
                  </>
                ) : sichuanBooking === 'booked' ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    <span>{t('feedback.booked')}</span>
                  </>
                ) : (
                  t('academy.workshops.sichuanCta')
                )}
              </button>
            </div>
          </article>

          {/* Workshop 2: Sanya Coast */}
          <article className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-surface-low shadow-md">
            <div className="relative h-36 w-full overflow-hidden bg-card">
              <img
                src="/images/aeroapex/aerial-coral-sea.jpg"
                alt={t('academy.workshops.sanyaTitle')}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-low via-media-scrim/35 to-transparent" />
              <div className="absolute top-2.5 left-2.5 rounded bg-surface-highest px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-primary uppercase">
                {t('academy.workshops.sanyaBadge')}
              </div>
              <div className="absolute bottom-2.5 left-3 font-display text-base font-semibold text-media-foreground">
                {t('academy.workshops.sanyaTitle')}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  <span>{t('academy.workshops.sanyaDate')}</span>
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground">
                  {t('academy.workshops.sanyaMeta')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => showToast(t('academy.workshops.sanyaToast'))}
                className="shrink-0 rounded-md bg-surface-high px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-surface-highest"
              >
                {t('academy.workshops.sanyaCta')}
              </button>
            </div>
          </article>
        </div>
      </section>

      {/* Immersive HUD Video Preview Modal */}
      <CoursePreviewDialog
        key={previewCourse?.title ?? 'closed'}
        course={previewCourse}
        onClose={() => setPreviewCourse(null)}
      />
    </div>
  );
}
