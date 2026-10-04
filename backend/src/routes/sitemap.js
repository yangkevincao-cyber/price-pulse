// backend/src/routes/sitemap.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/sitemap.xml', async (req, res) => {
    const baseUrl = 'https://pricepulse.com';

    // Fetch all products
    const products = await db.query(`
        SELECT id, slug, updated_at FROM products WHERE status = 'active'
    `);

    // Fetch all categories
    const categories = await db.query(`
        SELECT id, name FROM categories
    `);

    // Fetch all sellers
    const sellers = await db.query(`
        SELECT id, username FROM users WHERE role = 'seller' AND status = 'active'
    `);

    // Build sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
            xmlns:xhtml="http://www.w3.org/1999/xhtml"
            xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
            xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
        
        <!-- Homepage -->
        <url>
            <loc>${baseUrl}</loc>
            <lastmod>${new Date().toISOString()}</lastmod>
            <changefreq>daily</changefreq>
            <priority>1.0</priority>
            <xhtml:link rel="alternate" hreflang="en" href="${baseUrl}/en"/>
            <xhtml:link rel="alternate" hreflang="es" href="${baseUrl}/es"/>
            <xhtml:link rel="alternate" hreflang="fr" href="${baseUrl}/fr"/>
        </url>
        
        <!-- Static Pages -->
        ${['about', 'contact', 'terms', 'privacy', 'faq'].map(page => `
            <url>
                <loc>${baseUrl}/${page}</loc>
                <changefreq>monthly</changefreq>
                <priority>0.6</priority>
            </url>
        `).join('')}
        
        <!-- Categories -->
        ${categories.rows.map(cat => `
            <url>
                <loc>${baseUrl}/category/${cat.id}</loc>
                <changefreq>daily</changefreq>
                <priority>0.8</priority>
            </url>
        `).join('')}
        
        <!-- Products (with images) -->
        ${products.rows.map(product => `
            <url>
                <loc>${baseUrl}/product/${product.slug}</loc>
                <lastmod>${new Date(product.updated_at).toISOString()}</lastmod>
                <changefreq>weekly</changefreq>
                <priority>0.7</priority>
                <image:image>
                    <image:loc>${baseUrl}/images/products/${product.id}.jpg</image:loc>
                    <image:caption>${product.name}</image:caption>
                </image:image>
            </url>
        `).join('')}
        
        <!-- Sellers -->
        ${sellers.rows.map(seller => `
            <url>
                <loc>${baseUrl}/seller/${seller.username}</loc>
                <changefreq>weekly</changefreq>
                <priority>0.5</priority>
            </url>
        `).join('')}
        
        <!-- Trending Products (updated frequently) -->
        ${products.rows.filter(p => p.demand_score > 0.8).map(product => `
            <url>
                <loc>${baseUrl}/product/${product.slug}</loc>
                <changefreq>daily</changefreq>
                <priority>0.9</priority>
                <news:news>
                    <news:publication>
                        <news:name>PricePulse</news:name>
                        <news:language>en</news:language>
                    </news:publication>
                    <news:publication_date>${new Date().toISOString()}</news:publication_date>
                    <news:title>Trending: ${product.name}</news:title>
                </news:news>
            </url>
        `).join('')}
        
    </urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
});

// Also support sitemap index for large sites
router.get('/sitemap-index.xml', async (req, res) => {
    const baseUrl = 'https://pricepulse.com';

    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
    <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap>
            <loc>${baseUrl}/sitemap-products.xml</loc>
            <lastmod>${new Date().toISOString()}</lastmod>
        </sitemap>
        <sitemap>
            <loc>${baseUrl}/sitemap-categories.xml</loc>
            <lastmod>${new Date().toISOString()}</lastmod>
        </sitemap>
        <sitemap>
            <loc>${baseUrl}/sitemap-pages.xml</loc>
            <lastmod>${new Date().toISOString()}</lastmod>
        </sitemap>
    </sitemapindex>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemapIndex);
});

module.exports = router;