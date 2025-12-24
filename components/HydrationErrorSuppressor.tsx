'use client';

import { useEffect } from 'react';

export function HydrationErrorSuppressor() {
  useEffect(() => {
    // Suppress hydration mismatch errors caused by browser extensions
    const originalError = console.error;
    console.error = function (...args: any[]) {
      if (
        args[0]?.includes?.('hydrated') ||
        args[0]?.includes?.('A tree hydrated') ||
        args[0]?.includes?.('fdprocessedid')
      ) {
        // Silently ignore hydration errors from browser extensions
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}
