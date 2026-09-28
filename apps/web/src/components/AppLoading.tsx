'use client';
import { useEffect, useState } from 'react';
export function AppLoading(){const[ready,setReady]=useState(false);useEffect(()=>{setReady(true)},[]);return ready?null:<div className="hero-fallback fixed inset-0 z-[60] grid place-items-center"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-white/20 border-t-white"/><p className="mt-3 text-sm font-semibold text-white">Staywise</p></div></div>}
