// Runs fn as soon as the map's style can accept addSource/addLayer calls.
//
// Gotcha this exists for: isStyleLoaded() is transiently false while sprites/
// tiles load — even though 'style.load' already fired and will never fire
// again for the current style. Waiting on once('style.load') therefore hangs
// forever; instead poll the flag on 'styledata' and 'idle', which keep firing
// until the map settles. Returns a disposer for unmount.
export function whenStyleReady(map: mapboxgl.Map, fn: () => void): () => void {
  if (map.isStyleLoaded()) {
    fn();
    return () => {};
  }

  const handler = () => {
    if (!map.isStyleLoaded()) return;
    cleanup();
    fn();
  };
  const cleanup = () => {
    map.off('styledata', handler);
    map.off('idle', handler);
  };

  map.on('styledata', handler);
  map.on('idle', handler);
  return cleanup;
}
