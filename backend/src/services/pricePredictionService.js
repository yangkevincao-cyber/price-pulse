// backend/src/services/pricePredictionService.js
const db = require('../config/database');
const { Op } = require('sequelize');

class PricePredictionService {

    constructor() {
        this.alpha = 0.3; // Learning rate for exponential smoothing
        this.seasonalityWindow = 7; // Weekly seasonality
    }

    // Main prediction method
    async predictPrice(productId, daysAhead = 7) {
        // Get historical price data
        const history = await db.query(`
            SELECT 
                DATE(scraped_at) as date,
                AVG(price) as avg_price,
                COUNT(*) as sample_count
            FROM external_prices
            WHERE product_id = $1 
                AND scraped_at > NOW() - INTERVAL '90 days'
            GROUP BY DATE(scraped_at)
            ORDER BY date ASC
        `, [productId]);

        if (history.rows.length < 7) {
            return this.getFallbackPrediction(productId);
        }

        const prices = history.rows.map(r => parseFloat(r.avg_price));
        const dates = history.rows.map(r => r.date);

        // Multiple prediction models ensemble
        const predictions = {
            exponentialSmoothing: this.exponentialSmoothing(prices, daysAhead),
            arima: this.simpleARIMA(prices, daysAhead),
            seasonality: this.seasonalPrediction(prices, dates, daysAhead),
            trend: this.trendPrediction(prices, daysAhead)
        };

        // Weighted ensemble (give more weight to recent patterns)
        const weights = {
            exponentialSmoothing: 0.35,
            arima: 0.25,
            seasonality: 0.25,
            trend: 0.15
        };

        let finalPrediction = 0;
        for (const [model, prediction] of Object.entries(predictions)) {
            finalPrediction += prediction * weights[model];
        }

        // Calculate confidence interval
        const predictionError = this.calculatePredictionError(prices);
        const confidenceInterval = {
            lower: finalPrediction * (1 - predictionError),
            upper: finalPrediction * (1 + predictionError)
        };

        // Get market factors affecting price
        const marketFactors = await this.getMarketFactors(productId);

        // Determine recommendation
        const currentPrice = prices[prices.length - 1];
        const recommendation = this.getRecommendation(currentPrice, finalPrediction, marketFactors);

        return {
            product_id: productId,
            current_price: currentPrice,
            predicted_price: finalPrediction,
            predicted_price_7d: predictions.exponentialSmoothing,
            predicted_price_30d: this.exponentialSmoothing(prices, 30),
            confidence_interval: confidenceInterval,
            recommendation,
            market_factors: marketFactors,
            model_confidence: 1 - predictionError,
            predictions_by_model: predictions
        };
    }

    // Exponential Smoothing (Holt-Winters)
    exponentialSmoothing(prices, daysAhead) {
        if (prices.length === 0) return 0;

        let smoothed = prices[0];
        let trend = 0;

        for (let i = 1; i < prices.length; i++) {
            const newSmoothed = this.alpha * prices[i] + (1 - this.alpha) * (smoothed + trend);
            trend = this.alpha * (newSmoothed - smoothed) + (1 - this.alpha) * trend;
            smoothed = newSmoothed;
        }

        // Forecast future values
        let forecast = smoothed;
        for (let i = 0; i < daysAhead; i++) {
            forecast += trend;
        }

        return Math.max(forecast, prices[prices.length - 1] * 0.5); // Don't predict below 50% of current
    }

    // Simple ARIMA-like model (AutoRegressive)
    simpleARIMA(prices, daysAhead) {
        const lag = 3; // Use last 3 days for regression
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

    // Seasonal pattern detection (weekly cycles)
    seasonalPrediction(prices, dates, daysAhead) {
        if (prices.length < this.seasonalityWindow) {
            return prices[prices.length - 1];
        }

        // Calculate average price for each day of week
        const dayAverages = new Array(7).fill(0);
        const dayCounts = new Array(7).fill(0);

        for (let i = 0; i < prices.length; i++) {
            const date = new Date(dates[i]);
            const dayOfWeek = date.getDay();
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
        const lastDate = new Date(dates[dates.length - 1]);
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

    // Trend-based prediction (linear regression)
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

    // Get market factors affecting price
    async getMarketFactors(productId) {
        const factors = await db.query(`
            SELECT 
                -- Competitor count
                COUNT(DISTINCT source_id) as competitor_count,
                
                -- Price volatility
                STDDEV(price) / AVG(price) as price_volatility,
                
                -- Demand score (if available)
                COALESCE(p.demand_score, 0) as demand_score,
                
                -- Inventory level (listings count)
                COUNT(DISTINCT l.id) as active_listings,
                
                -- Seasonality factor (month)
                CASE 
                    WHEN EXTRACT(MONTH FROM NOW()) IN (11, 12) THEN 1.2  -- Holiday season
                    WHEN EXTRACT(MONTH FROM NOW()) IN (6, 7, 8) THEN 0.9  -- Summer
                    ELSE 1.0
                END as seasonal_factor
                
            FROM external_prices ep
            LEFT JOIN products p ON p.id = ep.product_id
            LEFT JOIN listings l ON l.product_id = ep.product_id AND l.status = 'active'
            WHERE ep.product_id = $1
                AND ep.scraped_at > NOW() - INTERVAL '30 days'
            GROUP BY p.demand_score
        `, [productId]);

        if (factors.rows.length === 0) {
            return {
                competitor_count: 0,
                price_volatility: 0,
                demand_score: 0,
                active_listings: 0,
                seasonal_factor: 1.0,
                market_condition: 'unknown'
            };
        }

        const factor = factors.rows[0];

        // Determine market condition
        let marketCondition = 'stable';
        if (factor.price_volatility > 0.2) marketCondition = 'volatile';
        if (factor.demand_score > 0.7 && factor.active_listings < 10) marketCondition = 'seller_market';
        if (factor.demand_score < 0.3 && factor.active_listings > 50) marketCondition = 'buyer_market';

        return {
            ...factor,
            market_condition: marketCondition,
            price_volatility: parseFloat(factor.price_volatility) || 0,
            demand_score: parseFloat(factor.demand_score) || 0
        };
    }

    // Get recommendation based on predictions
    getRecommendation(currentPrice, predictedPrice, marketFactors) {
        const priceChange = ((predictedPrice - currentPrice) / currentPrice) * 100;

        if (priceChange > 10 && marketFactors.market_condition === 'seller_market') {
            return {
                action: 'BUY_NOW',
                urgency: 'high',
                message: `Prices expected to rise ${priceChange.toFixed(1)}% soon. Buy now!`,
                suggested_action: 'Purchase immediately'
            };
        } else if (priceChange < -10 && marketFactors.market_condition === 'buyer_market') {
            return {
                action: 'WAIT',
                urgency: 'low',
                message: `Prices expected to drop ${Math.abs(priceChange).toFixed(1)}%. Wait for better deals.`,
                suggested_action: 'Monitor price, buy in 1-2 weeks'
            };
        } else if (marketFactors.demand_score > 0.8) {
            return {
                action: 'SELL_NOW',
                urgency: 'high',
                message: 'High demand detected! Great time to sell.',
                suggested_action: 'List your item now at premium price'
            };
        } else {
            return {
                action: 'HOLD',
                urgency: 'medium',
                message: 'Prices stable. No urgent action needed.',
                suggested_action: 'Continue monitoring'
            };
        }
    }

    // Calculate prediction error based on historical accuracy
    calculatePredictionError(prices) {
        if (prices.length < 14) return 0.15; // Default 15% error

        // Test prediction accuracy on last 7 days
        const testPrices = prices.slice(-14, -7);
        const actualPrices = prices.slice(-7);

        let totalError = 0;
        for (let i = 0; i < testPrices.length; i++) {
            const prediction = this.exponentialSmoothing(prices.slice(0, -14 + i), 7);
            const error = Math.abs((prediction - actualPrices[i]) / actualPrices[i]);
            totalError += error;
        }

        const avgError = totalError / testPrices.length;
        return Math.min(avgError, 0.3); // Cap at 30% error
    }

    // Fallback when not enough data
    async getFallbackPrediction(productId) {
        // Get similar products in same category
        const similarProducts = await db.query(`
            SELECT AVG(ep.price) as avg_price
            FROM products p
            JOIN external_prices ep ON ep.product_id = p.id
            WHERE p.category_id = (SELECT category_id FROM products WHERE id = $1)
                AND ep.scraped_at > NOW() - INTERVAL '30 days'
            GROUP BY p.id
        `, [productId]);

        const avgMarketPrice = similarProducts.rows.reduce((sum, p) => sum + parseFloat(p.avg_price), 0) /
            similarProducts.rows.length;

        return {
            product_id: productId,
            current_price: avgMarketPrice,
            predicted_price: avgMarketPrice,
            confidence_interval: { lower: avgMarketPrice * 0.8, upper: avgMarketPrice * 1.2 },
            recommendation: {
                action: 'RESEARCH',
                urgency: 'low',
                message: 'Insufficient data for accurate prediction. Market average price shown.',
                suggested_action: 'Check competitor prices manually'
            },
            model_confidence: 0.3
        };
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
        // Simple 2x2 and 3x3 matrix inversion
        const n = matrix.length;

        if (n === 2) {
            const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
            if (det === 0) return matrix;
            return [
                [matrix[1][1] / det, -matrix[0][1] / det],
                [-matrix[1][0] / det, matrix[0][0] / det]
            ];
        } else if (n === 3) {
            // For 3x3, use simplified approach
            const a = matrix[0][0], b = matrix[0][1], c = matrix[0][2];
            const d = matrix[1][0], e = matrix[1][1], f = matrix[1][2];
            const g = matrix[2][0], h = matrix[2][1], i = matrix[2][2];

            const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
            if (det === 0) return matrix;

            return [
                [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
                [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
                [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det]
            ];
        }

        return matrix;
    }
}

module.exports = PricePredictionService;