'use client';

import { useEffect, useState } from 'react';

/**
 * The current time for "x minutes ago" texts, refreshed every `everyMs`. Reading
 * Date.now() during render gives a different value on every render (and on the
 * server and in the browser), which React flags as impure.
 */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
