import type { ComponentProps } from 'react';
import { cn } from '@/core/utils/cn';

/**
 * AeroApex 精密几何双翼徽标（纯语义色矢量，适配深浅色与品牌色切换）。
 */
export function AeroLogo({ className, ...props }: ComponentProps<'svg'>) {
  return (
    <svg
      data-slot="aero-logo"
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={cn('size-8 shrink-0', className)}
      {...props}
    >
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="8"
        className="fill-surface-high stroke-primary/30"
        strokeWidth="1.2"
      />
      <path d="M20 8L31 28H25.8L20 17.2L14.2 28H9L20 8Z" className="fill-primary" />
      <path d="M15.5 24.5H24.5L26.2 28H13.8L15.5 24.5Z" className="fill-foreground/85" />
      <circle cx="20" cy="11.5" r="1.8" className="fill-secondary" />
    </svg>
  );
}

type HardwareArtProps = {
  variant: 'battery' | 'controller' | 'hub' | 'filter' | 'case';
  className?: string;
};

/**
 * 原厂配件精密工程矢量图示（免外部失效链接，高对比展示产品形态）。
 */
export function HardwareArt({ variant, className }: HardwareArtProps) {
  return (
    <svg
      data-slot="hardware-art"
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      className={cn('size-full', className)}
    >
      {variant === 'battery' && (
        <>
          <rect
            x="20"
            y="16"
            width="40"
            height="50"
            rx="6"
            className="fill-surface-high stroke-primary/45"
            strokeWidth="1.6"
          />
          <rect x="28" y="11" width="24" height="6" rx="2" className="fill-primary/70" />
          <rect x="27" y="26" width="26" height="5" rx="1.5" className="fill-primary" />
          <rect x="27" y="35" width="26" height="5" rx="1.5" className="fill-primary/80" />
          <rect x="27" y="44" width="26" height="5" rx="1.5" className="fill-primary/55" />
          <circle cx="40" cy="56" r="3.5" className="fill-secondary" />
        </>
      )}
      {variant === 'controller' && (
        <>
          <rect
            x="12"
            y="20"
            width="56"
            height="40"
            rx="8"
            className="fill-surface-high stroke-primary/45"
            strokeWidth="1.6"
          />
          <rect
            x="22"
            y="25"
            width="36"
            height="20"
            rx="3"
            className="fill-primary/20 stroke-primary"
            strokeWidth="1.2"
          />
          <circle cx="22" cy="52" r="4" className="fill-foreground/80" />
          <circle cx="58" cy="52" r="4" className="fill-foreground/80" />
          <path
            d="M28 20L24 12M52 20L56 12"
            className="stroke-primary"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
      {variant === 'hub' && (
        <>
          <rect
            x="14"
            y="26"
            width="52"
            height="32"
            rx="6"
            className="fill-surface-high stroke-border"
            strokeWidth="1.6"
          />
          <rect x="20" y="18" width="10" height="10" rx="2" className="fill-primary/85" />
          <rect x="35" y="18" width="10" height="10" rx="2" className="fill-primary/60" />
          <rect x="50" y="18" width="10" height="10" rx="2" className="fill-primary/35" />
          <path d="M38 36L34 43H40L37 50L45 41H39L42 36H38Z" className="fill-secondary" />
        </>
      )}
      {variant === 'filter' && (
        <>
          <circle
            cx="34"
            cy="36"
            r="16"
            className="fill-surface-high stroke-primary/60"
            strokeWidth="1.8"
          />
          <circle
            cx="48"
            cy="44"
            r="14"
            className="fill-primary/15 stroke-primary"
            strokeWidth="1.6"
          />
          <path
            d="M26 28L42 44"
            className="stroke-primary/50"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}
      {variant === 'case' && (
        <>
          <rect
            x="14"
            y="24"
            width="52"
            height="38"
            rx="7"
            className="fill-surface-high stroke-primary/40"
            strokeWidth="1.6"
          />
          <path
            d="M30 24V19C30 17.3 31.3 16 33 16H47C48.7 16 50 17.3 50 19V24"
            className="stroke-foreground/75"
            strokeWidth="2"
          />
          <line x1="14" y1="41" x2="66" y2="41" className="stroke-primary/45" strokeWidth="1.4" />
          <rect x="35" y="38" width="10" height="6" rx="1.5" className="fill-secondary" />
        </>
      )}
    </svg>
  );
}
