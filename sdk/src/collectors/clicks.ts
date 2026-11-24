import type { Properties } from '../types';
import type { CollectorContext, Teardown } from './context';

/** `data-track-sku="42"` -> `{ sku: '42' }` */
const datasetProps = (el: HTMLElement): Properties => {
  const props: Properties = {};
  for (const [key, value] of Object.entries(el.dataset)) {
    if (key.startsWith('track') && key !== 'track') {
      const name = key.slice(5);
      props[name.charAt(0).toLowerCase() + name.slice(1)] = value;
    }
  }
  return props;
};

const label = (el: Element) => {
  const text = (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ');
  return `${el.tagName.toLowerCase()}${text ? ` "${text.slice(0, 30)}"` : ''}`;
};

/**
 * 声明式埋点：`<button data-track="buy_click" data-track-sku="42">`。
 * 同时把按钮 / 链接的点击记为操作路径（breadcrumb），出错时能看到用户点了什么。
 */
export function collectClicks(ctx: CollectorContext, autoTrack: boolean): Teardown {
  const onClick = (event: MouseEvent) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const tracked = autoTrack ? target.closest<HTMLElement>('[data-track]') : null;
    if (tracked?.dataset.track) ctx.track(tracked.dataset.track, datasetProps(tracked));
    const clickable = target.closest('button, a, [role="button"], input[type="submit"]');
    if (clickable) ctx.breadcrumb({ type: 'click', message: label(clickable) });
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
