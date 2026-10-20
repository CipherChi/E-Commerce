'use client';

import { useEffect, useRef, useState } from 'react';

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoAllowed, setVideoAllowed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
        addEventListener?: (type: 'change', listener: () => void) => void;
        removeEventListener?: (type: 'change', listener: () => void) => void;
      };
    }).connection;
    const update = () => {
      const slowConnection =
        connection?.saveData ||
        connection?.effectiveType === 'slow-2g' ||
        connection?.effectiveType === '2g';
      setVideoAllowed(!preference.matches && !slowConnection);
    };
    const onPreferenceChange = () => update();

    update();
    if (typeof preference.addEventListener === 'function') {
      preference.addEventListener('change', onPreferenceChange);
    } else {
      preference.addListener(onPreferenceChange);
    }
    connection?.addEventListener?.('change', update);

    return () => {
      if (typeof preference.removeEventListener === 'function') {
        preference.removeEventListener('change', onPreferenceChange);
      } else {
        preference.removeListener(onPreferenceChange);
      }
      connection?.removeEventListener?.('change', update);
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (videoAllowed) void video.play().catch(() => {});
      else video.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [videoAllowed]);

  return (
    <div className="hero-media" aria-hidden="true">
      <video ref={videoRef} className="hero-video" autoPlay muted loop playsInline preload="none" poster="/images/global-video-poster.jpg" aria-hidden="true">
        {videoAllowed && <>
          <source src="/videos/global-hotel-background.mp4" type="video/mp4" />
          <source src="/videos/global-hotel-background.webm" type="video/webm" />
        </>}
      </video>
      <div className="hero-scrim" />
    </div>
  );
}
