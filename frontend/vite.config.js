// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { createHtmlPlugin } from 'vite-plugin-html';

export default defineConfig({
    plugins: [
        react(),

        // ✅ PWA for better SEO & mobile experience
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
            manifest: {
                name: 'PricePulse',
                short_name: 'PricePulse',
                description: 'Real-time price comparison and demand alerts',
                theme_color: '#1E3A8A',
                background_color: '#ffffff',
                display: 'standalone',
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
                    }
                ]
            }
        }),

        // ✅ HTML optimization for SEO
        createHtmlPlugin({
            minify: true,
            inject: {
                data: {
                    title: 'PricePulse - Feel the Market Pulse',
                    description: 'Real-time price comparison and demand alerts'
                }
            }
        })
    ],

    build: {
        // ✅ SEO-friendly build
        rollupOptions: {
            output: {
                // ⚡ Code splitting for better performance (improves SEO)
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    ui: ['@headlessui/react', '@heroicons/react'],
                    charts: ['recharts', 'chart.js']
                }
            }
        },
        // ✅ Minify for faster load (improves Core Web Vitals)
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true,
                pure_funcs: ['console.log']
            }
        },
        // ✅ Optimize images
        assetsInlineLimit: 4096,
        sourcemap: false
    },

    server: {
        // ✅ Proper MIME types for SEO files
        headers: {
            'Content-Type': 'application/xml'
        }
    }
});