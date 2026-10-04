/**
 * setInterval for the panel's periodic checks (announcement, bell): it skips its ticks while
 * the tab is hidden and runs once as soon as the tab shows again. Most open tabs are in the
 * background, and each one used to keep asking the server every 15-20 s.
 * Returns the function that stops it.
 */
export function onVisibleInterval(fn: () => void, ms: number): () => void {
  const tick = () => {
    if (document.visibilityState === 'visible') fn();
  };
  const id = setInterval(tick, ms);
  document.addEventListener('visibilitychange', tick);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', tick);
  };
}
