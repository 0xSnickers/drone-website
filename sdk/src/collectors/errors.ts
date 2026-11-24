import type { CollectorContext, Teardown } from './context';

const describeElement = (el: Element) => {
  const src = (el as HTMLImageElement).src || (el as HTMLLinkElement).href || '';
  return { tag: el.tagName.toLowerCase(), src };
};

/** window.onerror（JS 错误 + 资源加载失败，捕获阶段）与 unhandledrejection。 */
export function collectErrors(ctx: CollectorContext): Teardown {
  const onError = (event: Event) => {
    const target = event.target;
    if (target && target !== window && target instanceof Element) {
      const { tag, src } = describeElement(target);
      if (!src) return;
      ctx.reportError('resource', `Failed to load ${tag}: ${src}`, { source: src });
      return;
    }
    const e = event as ErrorEvent;
    const message = e.message || String(e.error ?? 'Unknown error');
    ctx.reportError('js', message, {
      stack: e.error instanceof Error ? e.error.stack : undefined,
      source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : undefined,
    });
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    const reason: unknown = event.reason;
    if (reason instanceof Error) {
      ctx.reportError('promise', `${reason.name}: ${reason.message}`, { stack: reason.stack });
    } else {
      let text: string;
      try {
        text = typeof reason === 'string' ? reason : JSON.stringify(reason);
      } catch {
        text = String(reason);
      }
      ctx.reportError('promise', `Unhandled rejection: ${text}`);
    }
  };

  window.addEventListener('error', onError, true);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError, true);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
