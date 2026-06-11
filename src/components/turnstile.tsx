'use client';

import React, { useEffect, useRef } from 'react';

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

declare global {
  interface Window {
    onloadTurnstileCallback?: () => void;
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function Turnstile({ onVerify, onExpire, onError }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Check if script is already added
    let script = document.querySelector('script[src*="turnstile"]') as HTMLScriptElement;

    const initializeTurnstile = () => {
      if (!window.turnstile || !containerRef.current) return;

      const siteKey =
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAADiOhwvRNdQFTEoP';

      try {
        if (widgetIdRef.current) {
          window.turnstile.remove(widgetIdRef.current);
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: onVerify,
          'expired-callback': onExpire,
          'error-callback': onError,
          theme: 'dark',
        });
      } catch (err) {
        console.error('Turnstile render error:', err);
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      window.onloadTurnstileCallback = () => {
        initializeTurnstile();
      };
    } else {
      if (window.turnstile) {
        initializeTurnstile();
      } else {
        const oldOnload = window.onloadTurnstileCallback;
        window.onloadTurnstileCallback = () => {
          if (oldOnload) oldOnload();
          initializeTurnstile();
        };
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore unmount cleanup errors
        }
      }
    };
  }, [onVerify, onExpire, onError]);

  return <div ref={containerRef} className="my-2" />;
}
