import { useEffect, useState } from 'react';

export type Route = 'kapi' | 'resepsiyon' | 'form' | 'demo' | 'reel';

export const ROUTES: readonly { route: Route; label: string; caption: string }[] = [
  { route: 'kapi', label: 'Kapı', caption: 'Kapı 01 · Turnike ekranı' },
  { route: 'resepsiyon', label: 'Resepsiyon', caption: 'Resepsiyon · Üyeler ve satış' },
  { route: 'form', label: 'AI Form', caption: 'AI form analizi · Kamera' },
  { route: 'demo', label: 'İkili görünüm', caption: 'Kapı ve resepsiyon yan yana' },
  { route: 'reel', label: 'Instagram Reel', caption: '@saynovra · 60 sn tanıtım videosu stüdyosu' },
];

function parse(hash: string): Route {
  const name = hash.replace(/^#\/?/, '');
  return ROUTES.find((entry) => entry.route === name)?.route ?? 'kapi';
}

export const routeHref = (route: Route): string => `#/${route}`;

/** Hash routing: four screens, no router dependency, and a reload keeps the screen. */
export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
