// backend/tests/fixtures/listings.js

const listings = {
    iphoneListing: {
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
        user_id: '22222222-2222-2222-2222-222222222222',
        product_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        title: 'iPhone 15 Pro Max - Like New',
        description: 'Selling my iPhone 15 Pro Max, used for 2 months',
        price: 1099.99,
        original_price: 1199.99,
        condition: 'like-new',
        quantity: 1,
        available_quantity: 1,
        status: 'active',
        shipping_cost: 10.00,
        accepts_offers: true,
        min_offer_price: 999.99,
        created_at: new Date(),
        updated_at: new Date(),
    },
    samsungListing: {
        id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        user_id: '22222222-2222-2222-2222-222222222222',
        product_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        title: 'Samsung Galaxy S24 Ultra - Brand New',
        description: 'Brand new Samsung Galaxy S24 Ultra, sealed in box',
        price: 899.99,
        original_price: 999.99,
        condition: 'new',
        quantity: 1,
        available_quantity: 1,
        status: 'active',
        shipping_cost: 10.00,
        accepts_offers: false,
        created_at: new Date(),
        updated_at: new Date(),
    },
};

module.exports = listings;