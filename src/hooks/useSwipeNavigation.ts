import { useCallback, useMemo, useRef, type TouchEventHandler } from "react";

export type UseSwipeNavigationOptions = {
  routes: string[];
  currentPath: string;
  onNavigate: (path: string) => void;
  threshold?: number;
};

export type SwipeNavigationHandlers = {
  onTouchStart: TouchEventHandler<HTMLDivElement>;
  onTouchMove: TouchEventHandler<HTMLDivElement>;
  onTouchEnd: TouchEventHandler<HTMLDivElement>;
  onTouchCancel: TouchEventHandler<HTMLDivElement>;
};

const DEFAULT_THRESHOLD = 60;
const LOCK_SELECTOR = "[data-swipe-lock='true']";
const VERTICAL_BIAS = 1.2;
const VERTICAL_CANCEL_DISTANCE = 24;

export const useSwipeNavigation = ({
  routes,
  currentPath,
  onNavigate,
  threshold = DEFAULT_THRESHOLD,
}: UseSwipeNavigationOptions): SwipeNavigationHandlers => {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);

  const isSwipeableRoute = useMemo(() => routes.includes(currentPath), [routes, currentPath]);

  const reset = useCallback(() => {
    startXRef.current = null;
    startYRef.current = null;
    isTrackingRef.current = false;
  }, []);

  const navigateByOffset = useCallback(
    (offset: number) => {
      const currentIndex = routes.indexOf(currentPath);
      if (currentIndex === -1) return;

      const targetIndex = currentIndex + offset;
      if (targetIndex < 0 || targetIndex >= routes.length) return;

      onNavigate(routes[targetIndex]);
    },
    [currentPath, onNavigate, routes],
  );

  const onTouchStart: TouchEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (!isSwipeableRoute || event.touches.length !== 1) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest(LOCK_SELECTOR)) return;

      const touch = event.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      isTrackingRef.current = true;
    },
    [isSwipeableRoute],
  );

  const onTouchMove: TouchEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (!isTrackingRef.current || event.touches.length !== 1) return;
      if (startXRef.current === null || startYRef.current === null) return;

      const touch = event.touches[0];
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      const isHorizontalDominant = absDeltaX > absDeltaY * VERTICAL_BIAS;
      if (!isHorizontalDominant) {
        if (absDeltaY > VERTICAL_CANCEL_DISTANCE) {
          reset();
        }
        return;
      }

      if (absDeltaX >= threshold) {
        event.preventDefault();
        navigateByOffset(deltaX < 0 ? 1 : -1);
        reset();
      }
    },
    [navigateByOffset, reset, threshold],
  );

  const onTouchEnd: TouchEventHandler<HTMLDivElement> = useCallback(() => {
    reset();
  }, [reset]);

  const onTouchCancel = onTouchEnd;

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  };
};
