// backend/src/models/index.js
const { sequelize } = require('../config/database');
const User = require('./User');
const Product = require('./Product');
const Listing = require('./Listing');
const Transaction = require('./Transaction');
const DemandAlert = require('./DemandAlert');
const Exchange = require('./Exchange');
const Category = require('./Category');
const SearchQuery = require('./SearchQuery');
const PriceHistory = require('./PriceHistory');
const ExternalPrice = require('./ExternalPrice');
const Payment = require('./Payment');
const Notification = require('./Notification');
const Review = require('./Review');
const Wishlist = require('./Wishlist');
const FraudLog = require('./FraudLog');

// Define associations

// User -> Listings
User.hasMany(Listing, { foreignKey: 'user_id', as: 'listings' });
Listing.belongsTo(User, { foreignKey: 'user_id', as: 'seller' });

// User -> Transactions (as buyer)
User.hasMany(Transaction, { foreignKey: 'buyer_id', as: 'purchases' });
Transaction.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });

// User -> Transactions (as seller)
User.hasMany(Transaction, { foreignKey: 'seller_id', as: 'sales' });
Transaction.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

// User -> DemandAlerts
User.hasMany(DemandAlert, { foreignKey: 'user_id', as: 'demand_alerts' });
DemandAlert.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User -> Exchanges
User.hasMany(Exchange, { foreignKey: 'user_id', as: 'exchanges' });
Exchange.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User -> Reviews (as reviewer)
User.hasMany(Review, { foreignKey: 'reviewer_id', as: 'reviews_given' });
Review.belongsTo(User, { foreignKey: 'reviewer_id', as: 'reviewer' });

// User -> Reviews (as reviewed)
User.hasMany(Review, { foreignKey: 'reviewed_id', as: 'reviews_received' });
Review.belongsTo(User, { foreignKey: 'reviewed_id', as: 'reviewed' });

// User -> Wishlists
User.hasMany(Wishlist, { foreignKey: 'user_id', as: 'wishlists' });
Wishlist.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Category -> Products
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// Category -> Subcategories
Category.hasMany(Category, { foreignKey: 'parent_category_id', as: 'subcategories' });
Category.belongsTo(Category, { foreignKey: 'parent_category_id', as: 'parent' });

// Product -> Listings
Product.hasMany(Listing, { foreignKey: 'product_id', as: 'listings' });
Listing.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product -> PriceHistory
Product.hasMany(PriceHistory, { foreignKey: 'product_id', as: 'price_history' });
PriceHistory.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product -> ExternalPrice
Product.hasMany(ExternalPrice, { foreignKey: 'product_id', as: 'external_prices' });
ExternalPrice.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product -> Wishlists
Product.hasMany(Wishlist, { foreignKey: 'product_id', as: 'wishlists' });
Wishlist.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product -> DemandAlerts
Product.hasMany(DemandAlert, { foreignKey: 'product_id', as: 'demand_alerts' });
DemandAlert.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Listing -> Transaction
Listing.hasOne(Transaction, { foreignKey: 'listing_id', as: 'transaction' });
Transaction.belongsTo(Listing, { foreignKey: 'listing_id', as: 'listing' });

// Payment -> Transaction
Payment.hasOne(Transaction, { foreignKey: 'payment_id', as: 'transaction' });
Transaction.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// Transaction -> Reviews
Transaction.hasMany(Review, { foreignKey: 'transaction_id', as: 'reviews' });
Review.belongsTo(Transaction, { foreignKey: 'transaction_id', as: 'transaction' });

// Export all models
module.exports = {
    sequelize,
    User,
    Product,
    Listing,
    Transaction,
    DemandAlert,
    Exchange,
    Category,
    SearchQuery,
    PriceHistory,
    ExternalPrice,
    Payment,
    Notification,
    Review,
    Wishlist,
    FraudLog,
};