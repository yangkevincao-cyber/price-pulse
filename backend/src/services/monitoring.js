// backend/src/services/monitoring.js
const prometheus = require('prom-client');
const collectDefaultMetrics = prometheus.collectDefaultMetrics;

collectDefaultMetrics({ timeout: 5000 });

const httpRequestDuration = new prometheus.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code']
});

const activeUsers = new prometheus.Gauge({
    name: 'active_users',
    help: 'Number of active users'
});

const demandAlertsSent = new prometheus.Counter({
    name: 'demand_alerts_sent_total',
    help: 'Total number of demand alerts sent'
});

const transactionsTotal = new prometheus.Counter({
    name: 'transactions_total',
    help: 'Total number of transactions',
    labelNames: ['status']
});

// Export metrics endpoint
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await prometheus.register.metrics());
});