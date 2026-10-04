// frontend/src/utils/performance.js

// Lazy loading for routes
import { lazy, Suspense } from 'react';

const ProductDetail = lazy(() => import('../pages/ProductDetail'));
const SellerDashboard = lazy(() => import('../pages/SellerDashboard'));
const DemandAlerts = lazy(() => import('../pages/DemandAlerts'));

// Image lazy loading with Intersection Observer
export const LazyImage = ({ src, alt, className }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const imageRef = useRef();

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setImageSrc(src);
                    observer.disconnect();
                }
            });
        });

        if (imageRef.current) {
            observer.observe(imageRef.current);
        }

        return () => observer.disconnect();
    }, [src]);

    return (
        <img
            ref={imageRef}
            src={imageSrc || 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E'}
            alt={alt}
            className={className}
        />
    );
};

// Virtual scrolling for long lists
import { FixedSizeList as List } from 'react-window';

const VirtualProductList = ({ products }) => {
    const Row = ({ index, style }) => (
        <div style={style}>
            <ProductCard product={products[index]} />
        </div>
    );

    return (
        <List
            height={600}
            itemCount={products.length}
            itemSize={120}
            width="100%"
        >
            {Row}
        </List>
    );
};

// Debounced search
export const useDebouncedSearch = (searchFn, delay = 300) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length > 2) {
                setIsLoading(true);
                const data = await searchFn(query);
                setResults(data);
                setIsLoading(false);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [query, searchFn, delay]);

    return { query, setQuery, results, isLoading };
};

// Memoized components
import React, { memo } from 'react';

const ProductCard = memo(({ product, onClick }) => {
    return (
        <div onClick={() => onClick(product.id)} className="product-card">
            <LazyImage src={product.image} alt={product.name} />
            <h3>{product.name}</h3>
            <p>${product.price}</p>
        </div>
    );
});

// Code splitting configuration (vite.config.js)
export default {
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                    charts: ['recharts', 'chart.js'],
                    ui: ['@headlessui/react', '@heroicons/react']
                }
            }
        },
        chunkSizeWarningLimit: 1000,
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        }
    }
};

// Service Worker for offline support
// public/sw.js
const CACHE_NAME = 'pricepulse-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/static/css/main.css',
    '/static/js/main.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});