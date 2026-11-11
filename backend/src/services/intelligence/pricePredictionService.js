// backend/src/services/intelligence/pricePredictionService.js
const { sequelize } = require('../../config/database');
const { PriceHistory, ExternalPrice } = require('../../models');
const { redis } = require('../../config/redis');

class PricePredictionService {
    /**
     * Predict price for a product
     */
    async predictPrice(productId, daysAhead = 7) {
        // Check cache
        const cacheKey = `price_prediction:${productId}:${daysAhead}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        // Get price history
        const history = await PriceHistory.findAll({
            where: { product_id: productId },
            order: [['created_at', 'ASC']],
            limit: 90, // Last 90 days
        });

        if (history.length < 7) {
            return this.getFallbackPrediction(productId);
        }

        const prices = history.map(h => parseFloat(h.price));
        const dates = history.map(h => h.created_at);

        // Multiple prediction models
        const predictions = {
            exponentialSmoothing: this.exponentialSmoothing(prices, daysAhead),
            arima: this.simpleARIMA(prices, daysAhead),
            seasonality: this.seasonalPrediction(prices, dates, daysAhead),
            trend: this.trendPrediction(prices, daysAhead),
        };

        // Weighted ensemble
        const weights = {
            exponentialSmoothing: 0.35,
            arima: 0.25,
            seasonality: 0.25,
            trend: 0.15,
        };

        let finalPrediction = 0;
        for (const [model, prediction] of Object.entries(predictions)) {
            finalPrediction += prediction * weights[model];
        }

        // Calculate confidence interval
        const predictionError = this.calculatePredictionError(prices);
        const confidenceInterval = {
            lower: finalPrediction * (1 - predictionError),
            upper: finalPrediction * (1 + predictionError),
        };

        // Get market factors
        const marketFactors = await this.getMarketFactors(productId);

        // Get recommendation
        const currentPrice = prices[prices.length - 1];
        const recommendation = this.getRecommendation(currentPrice, finalPrediction, marketFactors);

        const result = {
            product_id: productId,
            current_price: currentPrice,
            predicted_price: finalPrediction,
            predicted_price_7d: predictions.exponentialSmoothing,
            predicted_price_30d: this.exponentialSmoothing(prices, 30),
            confidence_interval: confidenceInterval,
            recommendation,
            market_factors: marketFactors,
            model_confidence: 1 - predictionError,
            predictions_by_model: predictions,
        };

        // Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(result));

        return result;
    }

    /**
     * Exponential smoothing
     */
    exponentialSmoothing(prices, daysAhead, alpha = 0.3) {
        if (prices.length === 0) return 0;

        let smoothed = prices[0];
        let trend = 0;

        for (let i = 1; i < prices.length; i++) {
            const newSmoothed = alpha * prices[i] + (1 - alpha) * (smoothed + trend);
            trend = alpha * (newSmoothed - smoothed) + (1 - alpha) * trend;
            smoothed = newSmoothed;
        }

        // Forecast future values
        let forecast = smoothed;
        for (let i = 0; i < daysAhead; i++) {
            forecast += trend;
        }

        return Math.max(forecast, prices[prices.length - 1] * 0.5);
    }

    /**
     * Simple ARIMA (AutoRegressive)
     */
    simpleARIMA(prices, daysAhead) {
        const lag = 3;
        if (prices.length < lag + 1) return prices[prices.length - 1];

        // Build regression on lagged values
        const X = [];
        const y = [];
        for (let i = lag; i < prices.length; i++) {
            X.push([prices[i - 1], prices[i - 2], prices[i - 3]]);
            y.push(prices[i]);
        }

        // Simple linear regression using normal equation
        const Xt = this.transpose(X);
        const XtX = this.multiply(Xt, X);
        const XtX_inv = this.inverse(XtX);
        const Xty = this.multiply(Xt, [y]);
        const coefficients = this.multiply(XtX_inv, Xty);

        // Predict next values
        let lastPrices = prices.slice(-lag);
        let forecast = 0;
        for (let i = 0; i < daysAhead; i++) {
            forecast = coefficients[0][0] * lastPrices[0] +
                coefficients[1][0] * lastPrices[1] +
                coefficients[2][0] * lastPrices[2];
            lastPrices = [forecast, lastPrices[0], lastPrices[1]];
        }

        return Math.max(forecast, prices[prices.length - 1] * 0.6);
    }

    /**
     * Seasonal prediction
     */
    seasonalPrediction(prices, dates, daysAhead) {
        if (prices.length < 7) return prices[prices.length - 1];

        // Calculate average price for each day of week
        const dayAverages = new Array(7).fill(0);
        const dayCounts = new Array(7).fill(0);

        for (let i = 0; i < prices.length; i++) {
            const dayOfWeek = dates[i].getDay();
            dayAverages[dayOfWeek] += prices[i];
            dayCounts[dayOfWeek]++;
        }

        for (let i = 0; i < 7; i++) {
            if (dayCounts[i] > 0) {
                dayAverages[i] /= dayCounts[i];
            } else {
                dayAverages[i] = prices[prices.length - 1];
            }
        }

        // Calculate base price (remove seasonality)
        const overallAvg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const seasonalIndices = dayAverages.map(avg => avg / overallAvg);

        // Forecast using seasonality
        const lastDate = dates[dates.length - 1];
        let forecast = 0;
        let forecastSum = 0;

        for (let i = 1; i <= daysAhead; i++) {
            const forecastDate = new Date(lastDate);
            forecastDate.setDate(lastDate.getDate() + i);
            const dayOfWeek = forecastDate.getDay();
            forecast += seasonalIndices[dayOfWeek] * overallAvg;
            forecastSum++;
        }

        return forecast / forecastSum;
    }

    /**
     * Trend prediction (linear regression)
     */
    trendPrediction(prices, daysAhead) {
        const n = prices.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += prices[i];
            sumXY += i * prices[i];
            sumX2 += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const forecast = intercept + slope * (n + daysAhead - 1);
        return Math.max(forecast, prices[prices.length - 1] * 0.7);
    }

    /**
     * Calculate prediction error
     */
    calculatePredictionError(prices) {
        if (prices.length < 14) return 0.15;

        // Test prediction accuracy on last 7 days
        const testPrices = prices.slice(-14, -7);
        const actualPrices = prices.slice(-7);

        let totalError = 0;
        for (let i = 0; i < testPrices.length; i++) {
            const prediction = this.exponentialSmoothing(prices.slice(0, -14 + i), 7);
            const error = Math.abs((prediction - actualPrices[i]) / actualPrices[i]);
            totalError += error;
        }

        return Math.min(totalError / testPrices.length, 0.3);
    }

    /**
     * Get market factors
     */
    async getMarketFactors(productId) {
        const factors = await sequelize.query(`
            SELECT 
                COUNT(DISTINCT ep.source_id) as competitor_count,
                STDDEV(ep.price) / AVG(ep.price) as price_volatility,
                COALESCE(p.demand_score, 0) as demand_score,
                COUNT(DISTINCT l.id) as active_listings,
                AVG(l.price) as avg_listing_price,
                CASE 
                    WHEN EXTRACT(MONTH FROM NOW()) IN (11, 12) THEN 1.2
                    WHEN EXTRACT(MONTH FROM NOW()) IN (6, 7, 8) THEN 0.9
                    ELSE 1.0
                END as seasonal_factor
            FROM external_prices ep
            LEFT JOIN products p ON p.id = ep.product_id
            LEFT JOIN listings l ON l.product_id = ep.product_id AND l.status = 'active'
            WHERE ep.product_id = $1
                AND ep.scraped_at > NOW() - INTERVAL '30 days'
            GROUP BY p.demand_score
        `, {
            bind: [productId],
            type: sequelize.QueryTypes.SELECT,
        });

        if (!factors.length) {
            return {
                competitor_count: 0,
                price_volatility: 0,
                demand_score: 0,
                active_listings: 0,
                avg_listing_price: 0,
                seasonal_factor: 1.0,
                market_condition: 'unknown',
            };
        }

        const factor = factors[0];
        let marketCondition = 'stable';
        if (factor.price_volatility > 0.2) marketCondition = 'volatile';
        if (factor.demand_score > 0.7 && factor.active_listings < 10) marketCondition = 'seller_market';
        if (factor.demand_score < 0.3 && factor.active_listings > 50) marketCondition = 'buyer_market';

        return {
            ...factor,
            market_condition: marketCondition,
            price_volatility: parseFloat(factor.price_volatility) || 0,
            demand_score: parseFloat(factor.demand_score) || 0,
            avg_listing_price: parseFloat(factor.avg_listing_price) || 0,
        };
    }

    /**
     * Get recommendation
     */
    getRecommendation(currentPrice, predictedPrice, marketFactors) {
        const priceChange = ((predictedPrice - currentPrice) / currentPrice) * 100;
        const { market_condition, demand_score, price_volatility } = marketFactors;

        if (priceChange > 10 && market_condition === 'seller_market') {
            return {
                action: 'BUY_NOW',
                urgency: 'high',
                message: `Prices expected to rise ${priceChange.toFixed(1)}% soon. Buy now!`,
                suggested_action: 'Purchase immediately',
            };
        }

        if (priceChange < -10 && market_condition === 'buyer_market') {
            return {
                action: 'WAIT',
                urgency: 'low',
                message: `Prices expected to drop ${Math.abs(priceChange).toFixed(1)}%. Wait for better deals.`,
                suggested_action: 'Monitor price, buy in 1-2 weeks',
            };
        }

        if (demand_score > 0.8) {
            return {
                action: 'SELL_NOW',
                urgency: 'high',
                message: 'High demand detected! Great time to sell.',
                suggested_action: 'List your item now at premium price',
            };
        }

        if (price_volatility > 0.15) {
            return {
                action: 'MONITOR',
                urgency: 'medium',
                message: 'Price is volatile. Monitor for best timing.',
                suggested_action: 'Set price alerts',
            };
        }

        return {
            action: 'HOLD',
            urgency: 'low',
            message: 'Prices stable. No urgent action needed.',
            suggested_action: 'Continue monitoring',
        };
    }

    /**
     * Get fallback prediction
     */
    async getFallbackPrediction(productId) {
        const similar = await ExternalPrice.findAll({
            where: { product_id: productId },
            order: [['scraped_at', 'DESC']],
            limit: 1,
        });

        const avgMarketPrice = similar.length > 0
            ? parseFloat(similar[0].price)
            : 0;

        const result = {
            product_id: productId,
            current_price: avgMarketPrice || 0,
            predicted_price: avgMarketPrice || 0,
            confidence_interval: {
                lower: avgMarketPrice * 0.8 || 0,
                upper: avgMarketPrice * 1.2 || 0,
            },
            recommendation: {
                action: 'RESEARCH',
                urgency: 'low',
                message: 'Insufficient data for accurate prediction. Market average price shown.',
                suggested_action: 'Check competitor prices manually',
            },
            model_confidence: 0.3,
        };

        return result;
    }

    // Matrix operations helpers
    transpose(matrix) {
        return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
    }

    multiply(a, b) {
        const aRows = a.length;
        const aCols = a[0].length;
        const bRows = b.length;
        const bCols = b[0].length;

        if (aCols !== bRows) throw new Error('Incompatible matrices');

        const result = Array(aRows).fill().map(() => Array(bCols).fill(0));

        for (let i = 0; i < aRows; i++) {
            for (let j = 0; j < bCols; j++) {
                for (let k = 0; k < aCols; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }

        return result;
    }

    inverse(matrix) {
        const n = matrix.length;

        if (n === 2) {
            const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
            if (det === 0) return matrix;
            return [
                [matrix[1][1] / det, -matrix[0][1] / det],
                [-matrix[1][0] / det, matrix[0][0] / det],
            ];
        }

        if (n === 3) {
            const a = matrix[0][0], b = matrix[0][1], c = matrix[0][2];
            const d = matrix[1][0], e = matrix[1][1], f = matrix[1][2];
            const g = matrix[2][0], h = matrix[2][1], i = matrix[2][2];

            const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
            if (det === 0) return matrix;

            return [
                [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
                [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
                [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
            ];
        }

        return matrix;
    }
}

module.exports = new PricePredictionService();