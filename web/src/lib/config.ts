// The API runs on port 3000 of whatever machine served this page, unless VITE_API_URL says otherwise.
export const API_URL: string = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3000`;
export const LIVE_URL = `${API_URL.replace(/^http/, 'ws')}/live`;
export const GYM_TIME_ZONE = 'Europe/Istanbul';
