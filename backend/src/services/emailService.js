// backend/src/services/emailService.js
const { Resend } = require('resend');
const sgMail = require('@sendgrid/mail');
const { createTransport } = require('nodemailer');

class EmailService {
    constructor() {
        this.provider = process.env.EMAIL_PROVIDER || 'resend';

        if (this.provider === 'resend') {
            this.client = new Resend(process.env.RESEND_API_KEY);
        } else if (this.provider === 'sendgrid') {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.client = sgMail;
        } else {
            this.client = createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: true,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        }
    }

    // Send transactional emails
    async sendWelcomeEmail(user) {
        const template = await this.getEmailTemplate('welcome');

        const html = this.renderTemplate(template, {
            name: user.username,
            dashboard_url: `${process.env.FRONTEND_URL}/dashboard`,
            support_url: `${process.env.FRONTEND_URL}/support`
        });

        return this.send({
            to: user.email,
            subject: 'Welcome to PricePulse! 🎉',
            html,
            from: 'welcome@pricepulse.com'
        });
    }

    async sendDemandAlertEmail(user, alert) {
        const template = await this.getEmailTemplate('demand_alert');

        const html = this.renderTemplate(template, {
            name: user.username,
            product_name: alert.product_name,
            demand_score: alert.demand_score * 100,
            search_volume: alert.search_volume_7d,
            volume_change: alert.search_volume_change_pct,
            avg_price: alert.avg_listing_price,
            suggested_price: alert.suggested_price,
            active_sellers: alert.active_listings,
            opportunity_score: alert.opportunity_score * 100,
            sell_url: `${process.env.FRONTEND_URL}/sell?product=${alert.product_id}`,
            pro_tip: this.getProTip(alert)
        });

        return this.send({
            to: user.email,
            subject: `🚨 Demand Spike: ${alert.product_name} is trending!`,
            html,
            from: 'alerts@pricepulse.com'
        });
    }

    async sendWeeklyDigest(user, opportunities) {
        const template = await this.getEmailTemplate('weekly_digest');

        const html = this.renderTemplate(template, {
            name: user.username,
            date: new Date().toLocaleDateString(),
            opportunities_count: opportunities.length,
            total_alerts: opportunities.length,
            avg_opportunity: (opportunities.reduce((sum, o) => sum + o.opportunity_score, 0) / opportunities.length) * 100,
            potential_profit: opportunities.reduce((sum, o) => sum + o.suggested_price, 0).toFixed(2),
            opportunities: opportunities.map((opp, idx) => ({
                rank: idx + 1,
                product_name: opp.product_name,
                score: (opp.opportunity_score * 100).toFixed(0),
                message: opp.message,
                demand_change: opp.search_volume_change_pct,
                suggested_price: opp.suggested_price,
                link: `${process.env.FRONTEND_URL}/sell?product=${opp.product_id}`
            })),
            dashboard_url: `${process.env.FRONTEND_URL}/dashboard`
        });

        return this.send({
            to: user.email,
            subject: `📊 Your PricePulse Weekly Digest: ${opportunities.length} new opportunities!`,
            html,
            from: 'digest@pricepulse.com'
        });
    }

    async sendPriceDropAlert(user, product, oldPrice, newPrice) {
        const template = await this.getEmailTemplate('price_drop');

        const savings = (oldPrice - newPrice).toFixed(2);
        const dropPercent = ((oldPrice - newPrice) / oldPrice * 100).toFixed(1);

        const html = this.renderTemplate(template, {
            name: user.username,
            product_name: product.name,
            old_price: oldPrice,
            new_price: newPrice,
            savings,
            drop_percent: dropPercent,
            product_url: `${process.env.FRONTEND_URL}/product/${product.id}`,
            stock_left: product.stock_count
        });

        return this.send({
            to: user.email,
            subject: `🎉 Price Drop Alert: ${product.name} down ${dropPercent}%!`,
            html,
            from: 'deals@pricepulse.com'
        });
    }

    // Email marketing campaigns
    async sendNewsletter(subscribers, campaign) {
        const batchSize = 100;
        const results = [];

        for (let i = 0; i < subscribers.length; i += batchSize) {
            const batch = subscribers.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
                batch.map(sub => this.send({
                    to: sub.email,
                    subject: campaign.subject,
                    html: this.renderTemplate(campaign.template, sub.data),
                    from: `${campaign.fromName} <${campaign.fromEmail}>`
                }))
            );
            results.push(...batchResults);

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await this.logCampaignResults(campaign.id, results);
        return results;
    }

    // Abandoned cart recovery
    async sendAbandonedCartReminder(user, cart) {
        const template = await this.getEmailTemplate('abandoned_cart');

        const html = this.renderTemplate(template, {
            name: user.username,
            items: cart.items,
            total: cart.total,
            checkout_url: `${process.env.FRONTEND_URL}/checkout?cart=${cart.id}`
        });

        return this.send({
            to: user.email,
            subject: '💡 Don\'t forget your items! They\'re still waiting',
            html,
            from: 'cart@pricepulse.com'
        });
    }

    // Email list management
    async addToNewsletter(email, name, source = 'website') {
        const existing = await db.query(
            'SELECT id FROM newsletter_subscribers WHERE email = $1',
            [email]
        );

        if (existing.rows.length === 0) {
            await db.query(`
                INSERT INTO newsletter_subscribers (email, name, source, subscribed_at)
                VALUES ($1, $2, $3, NOW())
            `, [email, name, source]);
        }

        // Sync with external email service
        if (process.env.MAILCHIMP_API_KEY) {
            await this.syncWithMailchimp(email, name);
        }
    }

    async syncWithMailchimp(email, name) {
        const mailchimp = require('@mailchimp/mailchimp_marketing');
        mailchimp.setConfig({
            apiKey: process.env.MAILCHIMP_API_KEY,
            server: process.env.MAILCHIMP_SERVER_PREFIX
        });

        try {
            await mailchimp.lists.addListMember(process.env.MAILCHIMP_LIST_ID, {
                email_address: email,
                status: 'subscribed',
                merge_fields: {
                    FNAME: name?.split(' ')[0] || '',
                    LNAME: name?.split(' ')[1] || ''
                }
            });
        } catch (error) {
            console.error('Mailchimp sync error:', error);
        }
    }

    // Template management
    async getEmailTemplate(name) {
        const cache = await redis.get(`email_template:${name}`);
        if (cache) return JSON.parse(cache);

        const template = await db.query(
            'SELECT * FROM email_templates WHERE name = $1 AND active = true',
            [name]
        );

        if (template.rows[0]) {
            await redis.setex(`email_template:${name}`, 3600, JSON.stringify(template.rows[0]));
        }

        return template.rows[0];
    }

    renderTemplate(template, data) {
        let html = template.html;
        Object.keys(data).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            html = html.replace(regex, data[key]);
        });
        return html;
    }

    async send(options) {
        try {
            let result;

            if (this.provider === 'resend') {
                result = await this.client.emails.send({
                    from: options.from,
                    to: options.to,
                    subject: options.subject,
                    html: options.html
                });
            } else if (this.provider === 'sendgrid') {
                result = await this.client.send({
                    to: options.to,
                    from: options.from,
                    subject: options.subject,
                    html: options.html
                });
            } else {
                result = await this.client.sendMail({
                    from: options.from,
                    to: options.to,
                    subject: options.subject,
                    html: options.html
                });
            }

            // Log email sent
            await db.query(`
                INSERT INTO email_logs (recipient, subject, type, status, sent_at)
                VALUES ($1, $2, $3, 'sent', NOW())
            `, [options.to, options.subject, options.type || 'transactional']);

            return result;
        } catch (error) {
            console.error('Email send error:', error);

            await db.query(`
                INSERT INTO email_logs (recipient, subject, type, status, error, attempted_at)
                VALUES ($1, $2, $3, 'failed', $4, NOW())
            `, [options.to, options.subject, options.type || 'transactional', error.message]);

            throw error;
        }
    }

    async logCampaignResults(campaignId, results) {
        const stats = {
            total: results.length,
            sent: results.filter(r => r.status === 'fulfilled').length,
            failed: results.filter(r => r.status === 'rejected').length
        };

        await db.query(`
            UPDATE email_campaigns
            SET sent_at = NOW(),
                sent_count = $1,
                failed_count = $2,
                status = 'completed'
            WHERE id = $3
        `, [stats.sent, stats.failed, campaignId]);
    }

    getProTip(alert) {
        const tips = [
            `Only ${alert.active_listings} sellers active. List now to capture this market!`,
            `List at $${alert.suggested_price} for optimal sell-through rate.`,
            `Add high-quality photos - listings with 5+ photos sell 40% faster.`,
            `Include keywords like "${alert.product_name}" and "best price" in your title.`,
            `Promote your listing on social media - demand is high right now!`
        ];
        return tips[Math.floor(Math.random() * tips.length)];
    }
}

module.exports = EmailService;