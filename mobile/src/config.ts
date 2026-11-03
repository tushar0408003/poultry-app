/**
 * API base URL, read at build time from EXPO_PUBLIC_API_URL (see .env.example).
 * - Android emulator talking to a backend on this PC: http://10.0.2.2:3000
 * - Physical phone on the same Wi-Fi:                 http://<PC LAN IP>:3000
 * - Production:                                       https://api.your-domain.com
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000').replace(/\/+$/, '');
