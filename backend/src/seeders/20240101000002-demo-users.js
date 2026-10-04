// backend/src/seeders/20240101000002-demo-users.js
'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
    up: async (queryInterface) => {
        const salt = bcrypt.genSaltSync(10);

        const users = [
            {
                id: '11111111-1111-1111-1111-111111111111',
                email: 'admin@pricepulse.com',
                username: 'admin',
                password: bcrypt.hashSync('Admin@123456', salt),
                first_name: 'Admin',
                last_name: 'User',
                role: 'admin',
                is_verified: true,
                is_active: true,
                email_verified: true,
                email_verified_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: '22222222-2222-2222-2222-222222222222',
                email: 'seller@pricepulse.com',
                username: 'seller',
                password: bcrypt.hashSync('Seller@123456', salt),
                first_name: 'Seller',
                last_name: 'User',
                role: 'seller',
                is_verified: true,
                is_active: true,
                seller_rating: 4.8,
                total_sales: 50,
                total_reviews: 45,
                email_verified: true,
                email_verified_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                id: '33333333-3333-3333-3333-333333333333',
                email: 'buyer@pricepulse.com',
                username: 'buyer',
                password: bcrypt.hashSync('Buyer@123456', salt),
                first_name: 'Buyer',
                last_name: 'User',
                role: 'buyer',
                is_verified: true,
                is_active: true,
                email_verified: true,
                email_verified_at: new Date(),
                created_at: new Date(),
                updated_at: new Date(),
            },
        ];

        await queryInterface.bulkInsert('users', users);
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('users', null, {});
    },
};