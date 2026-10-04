// backend/scripts/generateSitemap.js
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/config/database');
const { logger } = require('../src/config/logger');
const { Product, Category, User } = require('../src/models');

/**
 * Generate Sitemap
 * Creates sitemap.xml and sitemap index files
 */
async function generateSitemap() {
    try {
        logger.info('🗺️ Generating sitemap...');

        const baseUrl = process.env.FRONTEND_URL || 'https://pricepulse.com';
        const outputDir = path.join(__dirname, '../../frontend/public');
        const sitemapIndex = [];

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 1. Static pages
        const staticPages = [
            { url: '/', priority: 1.0, changefreq: 'daily' },
            { url: '/about', priority: 0.8, changefreq: 'monthly' },
            { url: '/contact', priority: 0.7, changefreq: 'monthly' },
            { url: '/faq', priority: 0.7, changefreq: 'monthly' },
            { url: '/terms', priority: 0.5, changefreq: 'yearly' },
            { url: '/privacy', priority: 0.5, changefreq: 'yearly' },
            { url: '/compare', priority: 0.9, changefreq: 'daily' },
            { url: '/exchanges', priority: 0.8, changefreq: 'daily' },
        ];

        const staticSitemap = generateSitemapFile(staticPages, 'static');
        fs.writeFileSync(path.join(outputDir, 'sitemap-static.xml'), staticSitemap);
        sitemapIndex.push('sitemap-static.xml');

        // 2. Product pages
        logger.info('📦 Generating product sitemap...');
        const products = await Product.findAll({
            where: { is_active: true, is_deleted: false },
            attributes: ['id', 'slug', 'updated_at'],
        });

        const productPages = products.map(product => ({
            url: `/product/${product.slug}`,
            priority: 0.8,
            changefreq: 'weekly',
            lastmod: product.updated_at,
        }));

        // Split products into chunks for large sitemaps
        const chunkSize = 5000;
        const productChunks = [];
        for (let i = 0; i < productPages.length; i += chunkSize) {
            productChunks.push(productPages.slice(i, i + chunkSize));
        }

        productChunks.forEach((chunk, index) => {
            const filename = `sitemap-products-${index + 1}.xml`;
            const content = generateSitemapFile(chunk, 'products');
            fs.writeFileSync(path.join(outputDir, filename), content);
            sitemapIndex.push(filename);
        });

        // 3. Category pages
        logger.info('📁 Generating category sitemap...');
        const categories = await Category.findAll({
            where: { is_active: true },
            attributes: ['id', 'slug', 'updated_at'],
        });

        const categoryPages = categories.map(category => ({
            url: `/category/${category.slug}`,
            priority: 0.7,
            changefreq: 'weekly',
            lastmod: category.updated_at,
        }));

        const categorySitemap = generateSitemapFile(categoryPages, 'categories');
        fs.writeFileSync(path.join(outputDir, 'sitemap-categories.xml'), categorySitemap);
        sitemapIndex.push('sitemap-categories.xml');

        // 4. Seller pages
        logger.info('👤 Generating seller sitemap...');
        const sellers = await User.findAll({
            where: { role: 'seller', is_active: true },
            attributes: ['id', 'username', 'updated_at'],
        });

        const sellerPages = sellers.map(seller => ({
            url: `/seller/${seller.username}`,
            priority: 0.6,
            changefreq: 'weekly',
            lastmod: seller.updated_at,
        }));

        const sellerSitemap = generateSitemapFile(sellerPages, 'sellers');
        fs.writeFileSync(path.join(outputDir, 'sitemap-sellers.xml'), sellerSitemap);
        sitemapIndex.push('sitemap-sellers.xml');

        // 5. Generate main sitemap index
        const sitemapIndexContent = generateSitemapIndex(baseUrl, sitemapIndex);
        fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemapIndexContent);

        // 6. Generate robots.txt
        const robotsTxt = generateRobotsTxt(baseUrl);
        fs.writeFileSync(path.join(outputDir, 'robots.txt'), robotsTxt);

        logger.info(`✅ Sitemap generated successfully! (${sitemapIndex.length} files)`);
        logger.info(`📁 Output directory: ${outputDir}`);

        process.exit(0);
    } catch (error) {
        logger.error('❌ Failed to generate sitemap:', error);
        process.exit(1);
    }
}

/**
 * Generate sitemap file
 */
function generateSitemapFile(pages, type) {
    const now = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">`;

    for (const page of pages) {
        const lastmod = page.lastmod ? new Date(page.lastmod).toISOString().split('T')[0] : now.split('T')[0];

        xml += `
    <url>
        <loc>${process.env.FRONTEND_URL || 'https://pricepulse.com'}${page.url}</loc>
        <lastmod>${lastmod}</lastmod>
        <changefreq>${page.changefreq || 'weekly'}</changefreq>
        <priority>${page.priority || 0.5}</priority>
    </url>`;
    }

    xml += `
</urlset>`;

    return xml;
}

/**
 * Generate sitemap index
 */
function generateSitemapIndex(baseUrl, sitemaps) {
    const now = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    for (const sitemap of sitemaps) {
        xml += `
    <sitemap>
        <loc>${baseUrl}/${sitemap}</loc>
        <lastmod>${now}</lastmod>
    </sitemap>`;
    }

    xml += `
</sitemapindex>`;

    return xml;
}

/**
 * Generate robots.txt
 */
function generateRobotsTxt(baseUrl) {
    return `# Robots.txt for PricePulse
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /dashboard/
Disallow: /profile/
Disallow: /settings/
Disallow: /checkout/
Disallow: /payment/

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay for heavy crawlers
User-agent: Bingbot
Crawl-delay: 1

User-agent: Googlebot
Crawl-delay: 1

# Image crawlers
User-agent: Googlebot-Image
Allow: /images/

# Video crawlers
User-agent: Googlebot-Video
Allow: /videos/
`;
}

// Run generation
generateSitemap();