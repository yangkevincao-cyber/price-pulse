// frontend/src/pages/ProductDetail.jsx
import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { generateMetaTags, generateProductSchema, generateBreadcrumbSchema, injectSchema } from '../utils/seo';
import { useProduct } from '../hooks/useProduct';

export default function ProductDetail() {
    const { productId } = useParams();
    const { product, loading } = useProduct(productId);

    useEffect(() => {
        if (product) {
            // ✅ Update page meta tags
            const metaTags = generateMetaTags({
                title: `${product.name} - Price Comparison & Best Deals | PricePulse`,
                description: `Compare prices for ${product.name} across global sellers. Current price: $${product.price}. Check demand score and price history.`,
                image: product.image || 'https://pricepulse.com/og-image.jpg',
                url: `https://pricepulse.com/products/${product.id}`,
                type: 'product'
            });

            // ✅ Update document title and meta tags
            document.title = metaTags.title;
            // ... update meta tags (use updatePageMeta helper)

            // ✅ Inject Product Schema
            const productSchema = generateProductSchema({
                id: product.id,
                name: product.name,
                description: product.description,
                image: product.image,
                price: product.price,
                sku: product.sku,
                brand: product.brand,
                inStock: product.inStock,
                rating: product.rating,
                reviewCount: product.reviewCount
            });
            injectSchema(productSchema);

            // ✅ Inject Breadcrumb Schema
            const breadcrumbSchema = generateBreadcrumbSchema([
                { name: 'Home', url: '/' },
                { name: 'Products', url: '/products' },
                { name: product.name, url: `/products/${product.id}` }
            ]);
            injectSchema(breadcrumbSchema);
        }
    }, [product]);

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <h1>{product?.name}</h1>
            <p>Price: ${product?.price}</p>
            {/* ... rest of product detail */}
        </div>
    );
}