import React from 'react';

/**
 * Hide a floating bar while the customer is reading further down a list, and
 * bring it back the moment they scroll back up - the way the cart bar behaves
 * in Swiggy and Zomato.
 *
 * Deliberately not a simple "is scrolling" flag: that flickers on every small
 * movement. It only reacts once the finger has actually travelled THRESHOLD
 * pixels in one direction, and the bar is always shown near the top of the
 * list, where there is nothing to read underneath it anyway.
 */
const THRESHOLD = 12;
const ALWAYS_VISIBLE_ABOVE = 80;

export const useHideOnScroll = () => {
  const [hidden, setHidden] = React.useState(false);
  const lastOffset = React.useRef(0);
  // Tracked in a ref as well so the comparison never reads a stale render.
  const hiddenRef = React.useRef(false);

  const setHiddenState = React.useCallback((next: boolean) => {
    if (hiddenRef.current === next) return;
    hiddenRef.current = next;
    setHidden(next);
  }, []);

  const onScroll = React.useCallback(
    (offsetY: number) => {
      const previous = lastOffset.current;
      const delta = offsetY - previous;

      if (offsetY <= ALWAYS_VISIBLE_ABOVE) {
        lastOffset.current = offsetY;
        setHiddenState(false);
        return;
      }

      if (Math.abs(delta) < THRESHOLD) return;

      // Scrolling further down the list hides it; coming back up reveals it.
      setHiddenState(delta > 0);
      lastOffset.current = offsetY;
    },
    [setHiddenState],
  );

  /** Call when the list content is replaced, so the bar cannot stay stuck away. */
  const reset = React.useCallback(() => {
    lastOffset.current = 0;
    setHiddenState(false);
  }, [setHiddenState]);

  return { hidden, onScroll, reset };
};
