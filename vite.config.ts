import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  server: {
    port: 574,
    // Allow access through temporary Cloudflare tunnels (Vite >=5.4.12
    // rejects unknown Host headers by default).
    allowedHosts: ['.trycloudflare.com'],
    // The repo lives on a Windows mount (/mnt/d) under WSL2, where inotify
    // events don't propagate — without polling, edits are served stale.
    watch: { usePolling: true, interval: 300 },
  },
  preview: {
    port: 574,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Wildfire Risk Assessment',
        short_name: 'FireRisk',
        description: 'Assess and manage wildfire risk for your property',
        theme_color: '#dc2626',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.mapbox\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapbox-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /\.(?:wasm|tflite)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'model-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              }
            }
          },
          {
            // DeepLab ADE20K (and any future Kaggle-hosted tfjs models).
            // Model JSON + weight shards; redirected to googleapis blobs.
            urlPattern: ({ url }) =>
              url.hostname === 'www.kaggle.com' ||
              (url.hostname.endsWith('googleapis.com') && url.pathname.includes('kagglesdsdata')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tfjs-model-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 90 // 90 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@lib': path.resolve(__dirname, './src/lib')
    }
  },
  optimizeDeps: {
    // Prebundle tfjs in dev: without this it is served as ~1200 raw ESM/CJS
    // modules, which breaks in the browser (CJS `module is not defined`) and
    // crawls over remote tunnels. Production chunking is handled separately
    // by manualChunks below.
    include: ['@tensorflow/tfjs']
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        // Vite 8 / Rolldown only accepts the function form of manualChunks.
        manualChunks(id) {
          if (id.includes('@tensorflow/tfjs')) return 'tensorflow';
          if (id.includes('mapbox-gl')) return 'mapbox';
          if (id.includes('three')) return 'three';
          if (id.includes('vegetationSegmenter')) return 'segmenter';
          if (/node_modules\/(react|react-dom|react-router-dom|zustand)\//.test(id)) return 'vendor';
        }
      }
    }
  }
});
