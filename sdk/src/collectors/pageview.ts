import type { CollectorContext, Teardown } from './context';

/** SPA 路由：代理 pushState / replaceState，监听 popstate / hashchange；同一地址不重复上报。 */
export function collectPageviews(ctx: CollectorContext): Teardown {
  let last = '';
  const emit = () => {
    const current = window.location.href;
    if (current === last) return;
    last = current;
    ctx.pageView();
  };

  const { pushState, replaceState } = window.history;
  window.history.pushState = function (...args: Parameters<History['pushState']>) {
    pushState.apply(this, args);
    emit();
  };
  window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
    replaceState.apply(this, args);
    emit();
  };
  window.addEventListener('popstate', emit);
  window.addEventListener('hashchange', emit);
  emit();

  return () => {
    window.history.pushState = pushState;
    window.history.replaceState = replaceState;
    window.removeEventListener('popstate', emit);
    window.removeEventListener('hashchange', emit);
  };
}
