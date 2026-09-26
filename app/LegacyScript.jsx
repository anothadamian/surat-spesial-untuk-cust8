'use client';

import { useEffect } from 'react';

export default function LegacyScript() {
  useEffect(() => {
    if (window.__dlynnBirthdayLegacyState) return;

    window.__dlynnBirthdayLegacyState = 'loading';
    const script = document.createElement('script');
    script.src = '/legacy.js?v=1';
    script.async = true;
    script.dataset.dlynnBirthdayLegacy = 'true';
    script.onload = () => {
      window.__dlynnBirthdayLegacyState = 'loaded';
    };
    script.onerror = () => {
      delete window.__dlynnBirthdayLegacyState;
    };
    document.body.appendChild(script);
  }, []);

  return <span data-legacy-loader hidden aria-hidden="true" />;
}
