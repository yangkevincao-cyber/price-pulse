// backend/src/services/exchangeService.js
class ExchangeMatchingService {

    async findMatches(listingId) {
        const listing = await db.query(`
            SELECT * FROM exchange_listings WHERE id = $1
        `, [listingId]);

        // Find potential matches (someone who wants what you have, and has what you want)
        const matches = await db.query(`
            WITH user_listing AS (
                SELECT offered_product_id, wanted_product_id, user_id
                FROM exchange_listings
                WHERE id = $1 AND status = 'active'
            )
            SELECT 
                l.*,
                u.username,
                -- Calculate match quality based on product similarity
                (
                    (CASE WHEN l.offered_product_id = ul.wanted_product_id THEN 1 ELSE 0 END) * 0.6 +
                    (CASE WHEN l.wanted_product_id = ul.offered_product_id THEN 1 ELSE 0 END) * 0.4
                ) as match_score,
                -- Suggest cash adjustment based on market prices
                (COALESCE(op1.price, 0) - COALESCE(op2.price, 0)) as suggested_cash_adjustment
            FROM exchange_listings l
            CROSS JOIN user_listing ul
            LEFT JOIN external_prices op1 ON op1.product_id = l.offered_product_id
            LEFT JOIN external_prices op2 ON op2.product_id = ul.offered_product_id
            WHERE l.id != $1
              AND l.status = 'active'
              AND l.user_id != ul.user_id
              AND (l.offered_product_id = ul.wanted_product_id 
                   OR l.wanted_product_id = ul.offered_product_id)
            ORDER BY match_score DESC
            LIMIT 10
        `, [listingId]);

        // Store matches
        for (const match of matches.rows) {
            await db.query(`
                INSERT INTO exchange_matches 
                (listing1_id, listing2_id, match_score, suggested_cash_adjustment)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT DO NOTHING
            `, [listingId, match.id, match.match_score, match.suggested_cash_adjustment]);
        }

        return matches.rows;
    }

    async proposeTrade(matchId, acceptingUserId) {
        const match = await db.query(`
            SELECT * FROM exchange_matches WHERE id = $1 AND status = 'pending'
        `, [matchId]);

        if (!match.rows.length) return { error: 'Match not found or already processed' };

        // Create trade proposal
        const trade = await db.query(`
            INSERT INTO trades (match_id, status, initiated_by, created_at)
            VALUES ($1, 'pending', $2, NOW())
            RETURNING *
        `, [matchId, acceptingUserId]);

        // Notify both parties
        await this.notifyTradePartners(trade.rows[0]);

        return trade.rows[0];
    }
}