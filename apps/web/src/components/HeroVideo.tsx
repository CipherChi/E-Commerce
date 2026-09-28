'use client';

import { useEffect, useRef, useState } from 'react';

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionAllowed(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else void video.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [motionAllowed]);

  return (
    <div className="hero-media" aria-hidden="true">
      {motionAllowed && (
        <video ref={videoRef} className="hero-video" autoPlay muted loop playsInline poster="/images/forest-fallback.jpg">
          <source src="/videos/hero-ambient.mp4" type="video/mp4" />
        </video>
      )}
      <div className="hero-scrim" />
    </div>
  );
}
