import { defineConfig } from 'astro/config';

// Tree House Yoga Retreat
// Static site, generated into ./dist
// On Cloudflare Pages, configure:
//   Build command:      npm run build
//   Build output:       dist
export default defineConfig({
  site: 'https://treehouse-yoga.dulipz.workers.dev',
  trailingSlash: 'ignore',
  build: {
    format: 'file' // emit /retreats.html, /about.html, etc. (not folders with index.html)
  },
  compressHTML: true,
  // Preserve legacy URLs from the pre-Astro site so any existing links
  // (bookmarks, shared threads) keep working.
  redirects: {
    '/retreat-1.html': '/retreats/jungle-and-ocean.html',
    '/retreat-2.html': '/retreats/quiet-mornings.html',
  },
});
