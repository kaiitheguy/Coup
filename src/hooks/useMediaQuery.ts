import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = () => setMatches(m.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 639px)');
}
