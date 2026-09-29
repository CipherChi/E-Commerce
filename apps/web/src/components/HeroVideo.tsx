'use client';

import { useEffect, useRef, useState } from 'react';

export function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [connectionAllowsVideo, setConnectionAllowsVideo] = useState(true);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionAllowed(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    setConnectionAllowsVideo(!connection?.saveData && connection?.effectiveType !== 'slow-2g' && connection?.effectiveType !== '2g');
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.hidden) video.pause();
      else if (motionAllowed && connectionAllowsVideo) void video.play().catch(() => {});
      else video.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [motionAllowed, connectionAllowsVideo]);

  return (
    <div className="hero-media" aria-hidden="true">
      <video ref={videoRef} className="hero-video" autoPlay muted loop playsInline preload="auto" poster="/images/global-video-poster.jpg" aria-hidden="true">
        {motionAllowed && connectionAllowsVideo && <>
          <source src="/videos/global-hotel-background.mp4" type="video/mp4" />
          <source src="/videos/global-hotel-background.webm" type="video/webm" />
        </>}
      </video>
      <div className="hero-scrim" />
    </div>
  );
}
