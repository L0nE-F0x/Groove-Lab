import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// Vite config for GrooveLab.
// Tailwind v4 is wired in via its first-party Vite plugin (no PostCSS config needed).
export default defineConfig({
  plugins: [tailwindcss()],
  server: {
    host: true,
    open: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
