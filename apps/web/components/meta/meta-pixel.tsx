'use client';

import { useEffect } from 'react';

const META_PIXEL_ID = '3968375216817052';

export function MetaPixel() {
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Check if already loaded
    if ((window as any).fbq) return;

    // Initialize fbq
    (window as any).fbq = function() {
      (window as any).fbq.queue = (window as any).fbq.queue || [];
      (window as any).fbq.queue.push(arguments);
    };
    (window as any).fbq.q = [];
    (window as any).fbq.p = 0;
    (window as any).fbq.l = Date.now();

    // Load fbevents.js
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.async = true;
    script.onload = function() {
      (window as any).fbq('init', META_PIXEL_ID);
      (window as any).fbq('track', 'PageView');
    };
    document.head.appendChild(script);
  }, []);

  return null;
}
