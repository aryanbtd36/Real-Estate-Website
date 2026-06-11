'use client';

import { useEffect, useRef } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

declare global {
  interface Window {
    turnstile?: any;
  }
}

export function Turnstile({ onVerify, onExpire, onError }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const siteKey =
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      '0x4AAAAAADiOhwvRNdQFTEoP';

    const loadScript = () => {
      return new Promise<void>((resolve) => {
        if (window.turnstile) return resolve();

        const existing = document.querySelector(
          'script[src*="turnstile"]'
        ) as HTMLScriptElement | null;

        if (existing) {
          existing.onload = () => resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();

        document.head.appendChild(script);
      });
    };

    const init = async () => {
      await loadScript();

      if (!window.turnstile || !containerRef.current) return;

      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch { }
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        'expired-callback': onExpire,
        'error-callback': onError,
        theme: 'dark',
      });
    };

    init();

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch { }
      }
    };
  }, []); // 🔥 IMPORTANT: EMPTY DEPENDENCY ARRAY

  return <div ref={containerRef} className="my-2" />;
}