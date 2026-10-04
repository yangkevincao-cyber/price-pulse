// backend/scripts/createAdmin.js
const { User } = require('../src/models');
const { sequelize } = require('../src/config/database');
const { logger } = require('../src/config/logger');
const readline = require('readline');

/**
 * Create Admin User
 * Interactive script to create an admin user
 */
async function createAdmin() {
    try {
        // Connect to database
        await sequelize.authenticate();
        logger.info('✅ Connected to database');

        // Get admin details from command line or prompt
        const args = process.argv.slice(2);
        let adminData = {};

        if (args.length >= 4) {
            // Use command line arguments: email username password firstName lastName
            adminData = {
                email: args[0],
                username: args[1],
                password: args[2],
                firstName: args[3] || 'Admin',
                lastName: args[4] || 'User',
            };
        } else {
            // Interactive mode
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const question = (query) => new Promise((resolve) => {
                rl.question(query, resolve);
            });

            console.log('\n📝 Create Admin User');
            console.log('-------------------\n');

            adminData.email = await question('Email: ');
            adminData.username = await question('Username: ');
            adminData.password = await question('Password (min 8 chars): ');
            adminData.firstName = await question('First Name: ');
            adminData.lastName = await question('Last Name: ');

            rl.close();
        }

        // Validate input
        if (!adminData.email || !adminData.username || !adminData.password) {
            throw new Error('Email, username, and password are required');
        }

        if (adminData.password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [sequelize.Op.or]: [
                    { email: adminData.email.toLowerCase() },
                    { username: adminData.username.toLowerCase() }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.role === 'admin') {
                logger.info('ℹ️ Admin user already exists');
                const admin = existingUser.toJSON();
                console.log('\n👤 Existing Admin:');
                console.log(`  ID: ${admin.id}`);
                console.log(`  Email: ${admin.email}`);
                console.log(`  Username: ${admin.username}`);
                console.log(`  Role: ${admin.role}`);
                process.exit(0);
            } else {
                throw new Error('User exists but is not an admin. Update role instead.');
            }
        }

        // Create admin user
        const admin = await User.create({
            email: adminData.email.toLowerCase(),
            username: adminData.username.toLowerCase(),
            password: adminData.password,
            first_name: adminData.firstName,
            last_name: adminData.lastName,
            role: 'admin',
            is_verified: true,
            is_active: true,
            email_verified: true,
            email_verified_at: new Date(),
        });

        console.log('\n✅ Admin user created successfully!');
        console.log('\n👤 Admin Details:');
        console.log(`  ID: ${admin.id}`);
        console.log(`  Email: ${admin.email}`);
        console.log(`  Username: ${admin.username}`);
        console.log(`  Role: ${admin.role}`);
        console.log('\n🔐 Please keep your credentials safe.');

        process.exit(0);
    } catch (error) {
        logger.error('❌ Failed to create admin:', error.message);
        process.exit(1);
    }
}

/**
 * Update existing user to admin
 */
async function makeAdmin(email) {
    try {
        const user = await User.findOne({
            where: { email: email.toLowerCase() }
        });

        if (!user) {
            throw new Error(`User not found: ${email}`);
        }

        await user.update({ role: 'admin' });
        logger.info(`✅ User ${email} is now an admin`);
        process.exit(0);
    } catch (error) {
        logger.error('❌ Failed to make admin:', error.message);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
    createAdmin();
} else if (args[0] === '--make-admin' && args[1]) {
    makeAdmin(args[1]);
} else {
    createAdmin();
}