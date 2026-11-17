// Entry point: boots the app into #app. All wiring lives in app.ts.
import './renderer/teletext.css';
import { createApp } from './app';

const root = document.getElementById('app');
if (root === null) throw new Error('Missing #app element in index.html');

createApp({
  root,
  env: {
    VITE_NEWS_API_KEY: import.meta.env.VITE_NEWS_API_KEY,
    VITE_WEATHER_LATITUDE: import.meta.env.VITE_WEATHER_LATITUDE,
    VITE_WEATHER_LONGITUDE: import.meta.env.VITE_WEATHER_LONGITUDE,
    VITE_WEATHER_NAME: import.meta.env.VITE_WEATHER_NAME,
  },
});
