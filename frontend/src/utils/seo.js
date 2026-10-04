// frontend/src/utils/seo.js

/**
 * Generate dynamic meta tags for React pages
 * Use this in each page component
 */
export const generateMetaTags = (options = {}) => {
    const defaults = {
        title: 'PricePulse - Feel the Market Pulse',
        description: 'Real-time price comparison and demand alerts for smart sellers and buyers.',
        image: 'https://pricepulse.com/og-image.jpg',
        url: 'https://pricepulse.com',
        siteName: 'PricePulse',
        twitterHandle: '@pricepulse',
        type: 'website'
    };

    const config = { ...defaults, ...options };

    return {
        title: config.title,
        meta: [
            { name: 'description', content: config.description },

            // Open Graph
            { property: 'og:title', content: config.title },
            { property: 'og:description', content: config.description },
            { property: 'og:image', content: config.image },
            { property: 'og:url', content: config.url },
            { property: 'og:type', content: config.type },
            { property: 'og:site_name', content: config.siteName },

            // Twitter
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:title', content: config.title },
            { name: 'twitter:description', content: config.description },
            { name: 'twitter:image', content: config.image },
            { name: 'twitter:site', content: config.twitterHandle },

            // Additional SEO
            { name: 'robots', content: 'index, follow' },
            { name: 'author', content: 'PricePulse' },
            { name: 'theme-color', content: '#1E3A8A' }
        ],
        link: [
            { rel: 'canonical', href: config.url }
        ]
    };
};

/**
 * Generate Product Schema (JSON-LD)
 */
export const generateProductSchema = (product) => ({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "description": product.description,
    "image": product.image,
    "sku": product.sku,
    "mpn": product.mpn,
    "brand": {
        "@type": "Brand",
        "name": product.brand || 'PricePulse'
    },
    "offers": {
        "@type": "Offer",
        "price": product.price,
        "priceCurrency": "USD",
        "availability": product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "url": `https://pricepulse.com/products/${product.id}`,
        "seller": {
            "@type": "Organization",
            "name": product.seller || 'PricePulse Marketplace'
        }
    },
    "aggregateRating": product.rating ? {
        "@type": "AggregateRating",
        "ratingValue": product.rating,
        "reviewCount": product.reviewCount || 0
    } : undefined
});

/**
 * Generate Breadcrumb Schema (JSON-LD)
 */
export const generateBreadcrumbSchema = (items) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "name": item.name,
        "item": `https://pricepulse.com${item.url}`
    }))
});

/**
 * Generate FAQ Schema (JSON-LD) - Great for SEO
 */
export const generateFAQSchema = (faqs) => ({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer
        }
    }))
});

/**
 * Generate Review Schema (JSON-LD)
 */
export const generateReviewSchema = (review) => ({
    "@context": "https://schema.org",
    "@type": "Review",
    "itemReviewed": {
        "@type": "Product",
        "name": review.productName
    },
    "reviewRating": {
        "@type": "Rating",
        "ratingValue": review.rating,
        "bestRating": 5
    },
    "author": {
        "@type": "Person",
        "name": review.author
    },
    "reviewBody": review.content,
    "datePublished": review.date
});

/**
 * Helper to inject JSON-LD into page
 */
export const injectSchema = (schema) => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return script;
};

/**
 * Update page title and meta tags dynamically
 */
export const updatePageMeta = (options) => {
    const tags = generateMetaTags(options);

    // Update title
    document.title = tags.title;

    // Update or create meta tags
    tags.meta.forEach(tag => {
        let selector;
        if (tag.name) selector = `meta[name="${tag.name}"]`;
        else if (tag.property) selector = `meta[property="${tag.property}"]`;
        else return;

        let element = document.querySelector(selector);
        if (!element) {
            element = document.createElement('meta');
            if (tag.name) element.name = tag.name;
            else if (tag.property) element.property = tag.property;
            document.head.appendChild(element);
        }
        element.content = tag.content;
    });

    // Update canonical link
    if (options.url) {
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.rel = 'canonical';
            document.head.appendChild(canonical);
        }
        canonical.href = options.url;
    }
};