// backend/src/index.js
const express = require('express');
const ScrapingScheduler = require('./scraping/scheduler');
const demandAlertRoutes = require('./routes/demandAlerts');

const app = express();
app.use(express.json());
app.use('/api/demand-alerts', demandAlertRoutes);

// Start scraping scheduler
const scheduler = new ScrapingScheduler();
scheduler.start();

app.listen(3000, () => {
    console.log('🚀 Smart Marketplace running on port 3000');
    console.log('📊 Demand alert system active');
    console.log('🕷️ Web scraping scheduler started');
});