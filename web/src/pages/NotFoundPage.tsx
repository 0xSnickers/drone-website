import { Compass, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <section className="flex min-h-[calc(100vh-9rem)] w-full items-center justify-center px-5 py-10">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-border/70 bg-card/90 p-8 text-center shadow-xl backdrop-blur-md">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary glow-primary-sm">
          <Compass className="size-7" />
        </div>
        <p className="font-mono text-xs font-semibold tracking-widest text-primary uppercase">
          ERR 404 // ROUTE_NOT_FOUND
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">
          {t('common.notFound')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t('common.notFoundDescription')}
        </p>
        <Button asChild className="mt-6 gap-1.5 glow-primary-sm">
          <Link to="/">
            <Home className="size-4" />
            <span>{t('common.backHome')}</span>
          </Link>
        </Button>
      </div>
    </section>
  );
}
