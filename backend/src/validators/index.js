// backend/src/validators/index.js
const authValidator = require('./authValidator');
const productValidator = require('./productValidator');
const listingValidator = require('./listingValidator');
const exchangeValidator = require('./exchangeValidator');
const paymentValidator = require('./paymentValidator');
const userValidator = require('./userValidator');

module.exports = {
    authValidator,
    productValidator,
    listingValidator,
    exchangeValidator,
    paymentValidator,
    userValidator,
};