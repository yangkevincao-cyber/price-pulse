// backend/src/services/notification/emailService.js
const { Resend } = require('resend');
const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const { logger } = require('../../config/logger');
const { redis } = require('../../config/redis');
const { User } = require('../../models');

class EmailService {
    constructor() {
        this.provider = process.env.EMAIL_PROVIDER || 'resend';
        this.fromEmail = process.env.EMAIL_FROM || 'noreply@pricepulse.com';
        this.supportEmail = process.env.EMAIL_SUPPORT || 'support@pricepulse.com';

        // Initialize provider
        if (this.provider === 'resend') {
            this.client = new Resend(process.env.RESEND_API_KEY);
        } else if (this.provider === 'sendgrid') {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.client = sgMail;
        } else {
            this.client = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: true,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }
    }

    /**
     * Send email
     */
    async send(options) {
        try {
            const { to, subject, html, text, from, replyTo } = options;

            // Check if user has unsubscribed
            const user = await User.findOne({ where: { email: to } });
            if (user && user.preferences?.notifications?.email === false) {
                logger.info(`Email skipped: ${to} has unsubscribed`);
                return;
            }

            // Rate limiting per user
            const rateKey = `email:rate:${to}`;
            const count = await redis.incr(rateKey);
            if (count === 1) {
                await redis.expire(rateKey, 3600);
            }
            if (count > 10) {
                logger.warn(`Email rate limit exceeded for ${to}`);
                throw new Error('Email rate limit exceeded');
            }

            // Send email
            let result;
            const emailData = {
                from: from || this.fromEmail,
                to,
                subject,
                html,
                text,
                replyTo: replyTo || this.supportEmail,
            };

            if (this.provider === 'resend') {
                result = await this.client.emails.send(emailData);
            } else if (this.provider === 'sendgrid') {
                result = await this.client.send(emailData);
            } else {
                result = await this.client.sendMail(emailData);
            }

            // Log email sent
            await redis.lpush('email:logs', JSON.stringify({
                to,
                subject,
                sentAt: new Date().toISOString(),
                provider: this.provider,
            }));
            await redis.ltrim('email:logs', 0, 999);

            logger.info(`Email sent to ${to}: ${subject}`);
            return result;

        } catch (error) {
            logger.error('Email send failed:', error);
            throw error;
        }
    }

    /**
     * Send welcome email
     */
    async sendWelcomeEmail(user) {
        const template = this.getWelcomeTemplate(user);
        return this.send({
            to: user.email,
            subject: 'Welcome to PricePulse! 🎉',
            html: template,
        });
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(user, token) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
        const template = this.getPasswordResetTemplate(user, resetUrl);
        return this.send({
            to: user.email,
            subject: 'Reset Your Password - PricePulse',
            html: template,
        });
    }

    /**
     * Send demand alert email
     */
    async sendDemandAlertEmail(user, alert) {
        const template = this.getDemandAlertTemplate(user, alert);
        return this.send({
            to: user.email,
            subject: `🚨 Demand Spike: ${alert.product_name}`,
            html: template,
        });
    }

    /**
     * Send weekly digest email
     */
    async sendWeeklyDigestEmail(user, opportunities) {
        const template = this.getWeeklyDigestTemplate(user, opportunities);
        return this.send({
            to: user.email,
            subject: `📊 Your PricePulse Weekly Digest`,
            html: template,
        });
    }

    /**
     * Send price drop alert
     */
    async sendPriceDropAlert(user, product, oldPrice, newPrice) {
        const template = this.getPriceDropTemplate(user, product, oldPrice, newPrice);
        return this.send({
            to: user.email,
            subject: `🎉 Price Drop: ${product.name}`,
            html: template,
        });
    }

    /**
     * Send exchange match notification
     */
    async sendExchangeMatchEmail(user, match) {
        const template = this.getExchangeMatchTemplate(user, match);
        return this.send({
            to: user.email,
            subject: `🤝 Exchange Match Found!`,
            html: template,
        });
    }

    /**
     * Email templates
     */
    getWelcomeTemplate(user) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 12px 30px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎉 Welcome to PricePulse!</h1>
                    <p>Feel the market pulse</p>
                </div>
                <div class="content">
                    <h2>Hello ${user.first_name}! 👋</h2>
                    <p>You've just joined the smartest marketplace on the planet. Get ready to sell smarter, buy cheaper, and trade fair.</p>
                    <div style="background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0;">
                        <h3>📊 Quick Start Guide</h3>
                        <ol>
                            <li>Complete your seller profile</li>
                            <li>Subscribe to categories you sell</li>
                            <li>Check your dashboard for demand alerts</li>
                            <li>List products when demand is high</li>
                        </ol>
                    </div>
                    <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Go to Dashboard →</a>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} PricePulse. All rights reserved.</p>
                    <p>Need help? <a href="mailto:${this.supportEmail}">Contact our support team</a></p>
                </div>
            </body>
            </html>
        `;
    }

    getPasswordResetTemplate(user, resetUrl) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 12px 30px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🔐 Reset Your Password</h1>
                </div>
                <div class="content">
                    <p>Hi ${user.first_name},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" class="button">Reset Password</a>
                    </div>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="font-size: 14px; color: #6b7280;">For security, this link will expire in 1 hour.</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} PricePulse. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;
    }

    getDemandAlertTemplate(user, alert) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #EF4444; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                    .metric { background: #f3f4f6; padding: 15px; border-radius: 10px; margin: 15px 0; }
                    .button { display: inline-block; padding: 12px 30px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>🚨 Demand Spike Detected!</h2>
                </div>
                <div class="content">
                    <h2>${alert.product_name}</h2>
                    <p style="font-size: 18px;">Demand has <strong style="color: #EF4444;">spiked ${alert.search_volume_change_pct}%</strong> in the last 7 days!</p>
                    
                    <div class="metric">
                        <div style="display: flex; justify-content: space-between;">
                            <span>📈 Demand Score</span>
                            <span><strong>${Math.round(alert.demand_score * 100)}%</strong></span>
                        </div>
                        <div style="background: #e5e7eb; height: 8px; border-radius: 4px; margin-top: 5px;">
                            <div style="background: #10B981; width: ${alert.demand_score * 100}%; height: 8px; border-radius: 4px;"></div>
                        </div>
                    </div>
                    
                    <div class="metric">
                        <div style="display: flex; justify-content: space-between;">
                            <span>🔍 Weekly Searches</span>
                            <span><strong>${alert.search_volume_7d}</strong></span>
                        </div>
                    </div>
                    
                    <div class="metric">
                        <div style="display: flex; justify-content: space-between;">
                            <span>💰 Suggested Price</span>
                            <span><strong>$${alert.suggested_price}</strong></span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/seller/alerts?alert=${alert.id}" class="button">💰 List This Product Now →</a>
                    </div>
                    
                    <div style="background: #FEF3C7; padding: 15px; border-radius: 10px; margin-top: 20px;">
                        <p style="margin: 0; color: #92400E;">💡 ${alert.message}</p>
                    </div>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} PricePulse. All rights reserved.</p>
                    <p><a href="${process.env.FRONTEND_URL}/settings/notifications">Adjust alert preferences</a></p>
                </div>
            </body>
            </html>
        `;
    }

    getWeeklyDigestTemplate(user, opportunities) {
        const opportunityList = opportunities.map((opp, index) => `
            <div style="border: 1px solid #e5e7eb; padding: 15px; margin: 10px 0; border-radius: 10px;">
                <div style="display: flex; justify-content: space-between;">
                    <strong>#${index + 1} ${opp.product_name}</strong>
                    <span style="background: #FEF3C7; padding: 2px 8px; border-radius: 10px; font-size: 12px;">${Math.round(opp.opportunity_score * 100)}%</span>
                </div>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #6b7280;">${opp.message}</p>
                <a href="${process.env.FRONTEND_URL}/seller/alerts?alert=${opp.id}" style="color: #3B82F6; font-size: 14px;">View Opportunity →</a>
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #1E3A8A, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                    .stats { display: flex; justify-content: space-around; background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0; }
                    .stat { text-align: center; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #1E3A8A; }
                    .stat-label { font-size: 12px; color: #6b7280; }
                    .button { display: inline-block; padding: 12px 30px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>📊 Your Weekly Digest</h2>
                    <p>${new Date().toLocaleDateString()}</p>
                </div>
                <div class="content">
                    <h2>Hello ${user.first_name}! 👋</h2>
                    <p>Here's your weekly market intelligence report. <strong>${opportunities.length} new opportunities</strong> this week!</p>
                    
                    <div class="stats">
                        <div class="stat">
                            <div class="stat-value">${opportunities.length}</div>
                            <div class="stat-label">New Opportunities</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${Math.round(opportunities.reduce((sum, o) => sum + o.opportunity_score, 0) / opportunities.length * 100)}%</div>
                            <div class="stat-label">Avg Score</div>
                        </div>
                    </div>
                    
                    <h3>🔥 Top Opportunities This Week</h3>
                    ${opportunityList}
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/seller/dashboard" class="button">View Full Dashboard →</a>
                    </div>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} PricePulse. All rights reserved.</p>
                    <p><a href="${process.env.FRONTEND_URL}/settings/notifications">Manage your preferences</a></p>
                </div>
            </body>
            </html>
        `;
    }

    getPriceDropTemplate(user, product, oldPrice, newPrice) {
        const savings = (oldPrice - newPrice).toFixed(2);
        const dropPercent = ((oldPrice - newPrice) / oldPrice * 100).toFixed(1);

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #10B981; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                    .price-drop { text-align: center; padding: 20px; margin: 20px 0; }
                    .old-price { text-decoration: line-through; color: #6b7280; font-size: 20px; }
                    .new-price { font-size: 36px; font-weight: bold; color: #10B981; }
                    .savings { background: #DEF7EC; display: inline-block; padding: 4px 12px; border-radius: 20px; color: #03543E; font-size: 14px; font-weight: bold; }
                    .button { display: inline-block; padding: 12px 30px; background: #3B82F6; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>🎉 Price Drop Alert!</h2>
                </div>
                <div class="content">
                    <h2>${product.name}</h2>
                    
                    <div class="price-drop">
                        <span class="old-price">$${oldPrice.toFixed(2)}</span>
                        <span style="font-size: 24px; margin: 0 10px;">→</span>
                        <span class="new-price">$${newPrice.toFixed(2)}</span>
                        <div style="margin-top: 10px;">
                            <span class="savings">💸 Save $${savings} (${dropPercent}% off)</span>
                        </div>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/product/${product.slug}" class="button">🛍️ Buy Now →</a>
                    </div>
                    
                    <div style="background: #EFF6FF; padding: 15px; border-radius: 10px;">
                        <p style="margin: 0; color: #1E3A8A;">⏰ This price won't last long!</p>
                    </div>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} PricePulse. All rights reserved.</p>
                    <p><a href="${process.env.FRONTEND_URL}/settings/notifications">Manage price alerts</a></p>
                </div>
            </body>
            </html>
        `;
    }

    getExchangeMatchTemplate(user, match) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 10px 10px; }
                    .match-card { background: #f3f4f6; padding: 20px; border-radius: 10px; margin: 20px 0; }
                    .match-score { text-align: center; font-size: 24px; font-weight: bold; color: #10B981; }
                    .button { display: inline-block; padding: 12px 30px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>🤝 Exchange Match Found!</h2>
                </div>
                <div class="content">
                    <h2>Great news, ${user.first_name}!</h2>
                    <p>We found a perfect match for your exchange request.</p>
                    
                    <div class="match-card">
                        <div style="display: flex; justify-content: space-around;">
                            <div>
                                <p><strong>You Offer:</strong></p>
                                <p>${match.offered_product_name}</p>
                                <p style="font-size: 12px; color: #6b7280;">${match.offered_condition}</p>
                            </div>
                            <div style="font-size: 30px; color: #10B981;">⟷</div>
                            <div>
                                <p><strong>You Receive:</strong></p>
                                <p>${match.wanted_product_name}</p>
                                <p style="font-size: 12px; color: #6b7280;">${match.wanted_condition}</p>
                            </div>
                        </div>
                        ${match.suggested_cash_adjustment !== 0 ? `
                            <div style="text-align: center; margin-top: 15px; padding: 10px; background: #FEF3C7; border-radius: 5px;">
                                <span style="color: #92400E;">Cash adjustment: $${match.suggested_cash_adjustment}</span>
                            </div>
                        ` : ''}
                        <div class="match-score">${Math.round(match.match_score * 100)}% Match Quality</div>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.FRONTEND_URL}/exchanges/matches/${match.id}" class="button">View Match →</a>
                    </div>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} PricePulse. All rights reserved.</p>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Bulk email send
     */
    async sendBulkEmail(recipients, subject, template) {
        const results = [];
        const batchSize = 50;

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);
            const promises = batch.map(recipient =>
                this.send({
                    to: recipient.email,
                    subject,
                    html: template(recipient),
                }).catch(error => ({
                    error,
                    recipient: recipient.email,
                }))
            );
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;
    }
}

module.exports = new EmailService();