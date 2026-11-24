import { Bolt, ChevronRight, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { cn } from '@/core/utils/cn';

export function GlobalGallerySection() {
  const { t } = useTranslation();

  const shots = [
    {
      id: 'glacier',
      image: '/images/aeroapex/aerial-lofoten.jpg',
      tag: t('showcase.gallery.shots.glacierTag'),
      tagTone: 'primary' as const,
      title: t('showcase.gallery.shots.glacierTitle'),
      location: t('showcase.gallery.shots.glacierLocation'),
      exif: t('showcase.gallery.shots.glacierExif'),
      author: t('showcase.gallery.shots.glacierAuthor'),
    },
    {
      id: 'cyber',
      image: '/images/aeroapex/aerial-cybercity.jpg',
      tag: t('showcase.gallery.shots.cyberTag'),
      tagTone: 'secondary' as const,
      title: t('showcase.gallery.shots.cyberTitle'),
      location: t('showcase.gallery.shots.cyberLocation'),
      exif: t('showcase.gallery.shots.cyberExif'),
      author: t('showcase.gallery.shots.cyberAuthor'),
    },
    {
      id: 'alpine',
      image: '/images/aeroapex/aerial-winding-road.jpg',
      tag: t('showcase.gallery.shots.alpineTag'),
      tagTone: 'primary' as const,
      title: t('showcase.gallery.shots.alpineTitle'),
      location: t('showcase.gallery.shots.alpineLocation'),
      exif: t('showcase.gallery.shots.alpineExif'),
      author: t('showcase.gallery.shots.alpineAuthor'),
    },
  ];

  return (
    <>
      <section className="flex w-full flex-col px-5 py-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-secondary" />
              <span className="font-mono text-[10px] font-semibold tracking-wider text-secondary uppercase">
                {t('showcase.gallery.eyebrow')}
              </span>
            </div>
            <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
              {t('showcase.gallery.title')}
            </h2>
          </div>
          <Link
            to="/community"
            className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>{t('showcase.gallery.exploreCta')}</span>
            <ChevronRight className="size-4" />
          </Link>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">{t('showcase.gallery.subtitle')}</p>

        {/* Horizontal Snap Carousel on Mobile / 3-Col Grid on Desktop */}
        <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
          {shots.map((shot) => (
            <article
              key={shot.id}
              className="flex w-72 shrink-0 snap-center flex-col overflow-hidden rounded-xl border border-border/50 bg-surface-high shadow-lg lg:w-auto"
            >
              <div className="relative h-44 w-full overflow-hidden">
                <img
                  src={shot.image}
                  alt={shot.title}
                  className="size-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <span
                  className={cn(
                    'absolute top-2.5 left-2.5 rounded bg-surface-lowest/85 px-2 py-0.5 font-mono text-[10px] font-semibold backdrop-blur-md',
                    shot.tagTone === 'secondary' ? 'text-secondary' : 'text-primary',
                  )}
                >
                  {shot.tag}
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-between p-3.5">
                <div>
                  <h4 className="font-display text-base font-semibold text-foreground">
                    {shot.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span>{shot.location}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5 font-mono text-[10px] text-muted-foreground">
                  <span>{shot.exif}</span>
                  <span className="font-semibold text-foreground">@{shot.author}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Bottom CTA Promotion Banner */}
      <section className="w-full px-5 pt-2 pb-8">
        <div className="relative flex flex-col items-center overflow-hidden rounded-2xl border border-primary/20 bg-surface-high p-6 text-center shadow-xl">
          <div className="pointer-events-none absolute -right-12 -bottom-12 size-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative z-10 flex w-full max-w-md flex-col items-center">
            <span className="mb-1 font-mono text-[10px] font-semibold tracking-widest text-primary uppercase">
              {t('showcase.bottomCta.eyebrow')}
            </span>
            <h3 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
              {t('showcase.bottomCta.title')}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{t('showcase.bottomCta.subtitle')}</p>
            <Link
              to="/flagship"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5 font-display text-base font-semibold text-primary-foreground transition-transform active:scale-95 glow-primary"
            >
              <Bolt className="size-5" />
              <span>{t('showcase.bottomCta.action')}</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
