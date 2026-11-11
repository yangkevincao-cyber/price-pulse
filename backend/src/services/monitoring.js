// backend/src/services/monitoring.js
const prometheus = require('prom-client');

// Collect default Node.js metrics
prometheus.collectDefaultMetrics({ timeout: 5000 });

// ─────────────────────────────────────────────
// Custom Metrics
// ─────────────────────────────────────────────

const httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5],
});

const activeUsers = new prometheus.Gauge({
    name: 'active_users',
    help: 'Number of active users',
});

const demandAlertsSent = new prometheus.Counter({
    name: 'demand_alerts_sent_total',
    help: 'Total number of demand alerts sent',
});

const transactionsTotal = new prometheus.Counter({
    name: 'transactions_total',
    help: 'Total number of transactions',
    labelNames: ['status'],
});

// ─────────────────────────────────────────────
// Exports — makes ESLint recognize them as used
// ─────────────────────────────────────────────

module.exports = {
    prometheus,
    httpRequestDuration,
    activeUsers,
    demandAlertsSent,
    transactionsTotal,
};