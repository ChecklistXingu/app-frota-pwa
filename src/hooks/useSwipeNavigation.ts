import { useCallback, useMemo, useRef, type PointerEventHandler } from "react";

export type UseSwipeNavigationOptions = {
  routes: string[];
  currentPath: string;
  onNavigate: (path: string) => void;
  threshold?: number;
};

export type SwipeNavigationHandlers = {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
};

const DEFAULT_THRESHOLD = 60;
const LOCK_SELECTOR = "[data-swipe-lock='true']";
const VERTICAL_BIAS = 1.35; // Keeps vertical scroll responsive

export const useSwipeNavigation = ({
  routes,
  currentPath,
  onNavigate,
  threshold = DEFAULT_THRESHOLD,
}: UseSwipeNavigationOptions): SwipeNavigationHandlers => {
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);

  const isSwipeableRoute = useMemo(() => routes.includes(currentPath), [routes, currentPath]);

  const reset = useCallback(() => {
    pointerIdRef.current = null;
    startXRef.current = null;
    startYRef.current = null;
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

  const onPointerDown: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (event.pointerType !== "touch" || !isSwipeableRoute) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest(LOCK_SELECTOR)) return;

      pointerIdRef.current = event.pointerId;
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
    },
    [isSwipeableRoute],
  );

  const onPointerMove: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (event.pointerType !== "touch") return;
      if (pointerIdRef.current !== event.pointerId) return;
      if (startXRef.current === null || startYRef.current === null) return;

      const deltaX = event.clientX - startXRef.current;
      const deltaY = event.clientY - startYRef.current;

      const isHorizontalDominant = Math.abs(deltaX) > Math.abs(deltaY) * VERTICAL_BIAS;
      if (!isHorizontalDominant) {
        // User is scrolling vertically; stop tracking this pointer.
        if (Math.abs(deltaY) > threshold / 4) {
          reset();
        }
        return;
      }

      if (Math.abs(deltaX) >= threshold) {
        navigateByOffset(deltaX < 0 ? 1 : -1);
        reset();
      }
    },
    [navigateByOffset, reset, threshold],
  );

  const onPointerUp: PointerEventHandler<HTMLDivElement> = useCallback(
    (event) => {
      if (event.pointerType !== "touch") return;
      reset();
    },
    [reset],
  );

  const onPointerCancel = onPointerUp;

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
};
