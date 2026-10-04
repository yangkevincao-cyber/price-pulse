// backend/tests/fixtures/products.js

const products = {
    iphone: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'iPhone 15 Pro Max',
        slug: 'iphone-15-pro-max',
        description: 'The latest iPhone with advanced camera system',
        brand: 'Apple',
        category_id: 1,
        demand_score: 0.95,
        average_rating: 4.8,
        review_count: 150,
        wishlist_count: 200,
        view_count: 5000,
        search_count: 3000,
        tags: ['apple', 'iphone', 'smartphone'],
        is_active: true,
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date(),
    },
    samsung: {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        name: 'Samsung Galaxy S24 Ultra',
        slug: 'samsung-galaxy-s24-ultra',
        description: 'Premium Android smartphone with S Pen',
        brand: 'Samsung',
        category_id: 1,
        demand_score: 0.92,
        average_rating: 4.7,
        review_count: 120,
        wishlist_count: 150,
        view_count: 4000,
        search_count: 2500,
        tags: ['samsung', 'android', 'smartphone'],
        is_active: true,
        is_featured: true,
        created_at: new Date(),
        updated_at: new Date(),
    },
};

module.exports = products;