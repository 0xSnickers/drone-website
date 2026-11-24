import { AlertTriangle, Home, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  onRetry?: () => void;
}

export function ErrorFallback({ onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation();

  return (
    <main
      role="alert"
      className="flex min-h-[calc(100vh-8rem)] w-full items-center justify-center px-5 py-10"
    >
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-border/70 bg-card/90 p-8 text-center shadow-xl backdrop-blur-md">
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <span className="font-mono text-[10px] font-semibold tracking-widest text-destructive uppercase">
          ERR // RUNTIME_EXCEPTION
        </span>
        <h1 className="mt-2 font-display text-2xl font-bold text-foreground">{t('error.title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t('error.description')}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button
            type="button"
            onClick={onRetry ?? (() => window.location.reload())}
            className="gap-1.5 glow-primary-sm"
          >
            <RotateCw className="size-4" />
            <span>{t('common.retry')}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.assign('/');
            }}
            className="gap-1.5"
          >
            <Home className="size-4" />
            <span>{t('common.backHome')}</span>
          </Button>
        </div>
      </div>
    </main>
  );
}
