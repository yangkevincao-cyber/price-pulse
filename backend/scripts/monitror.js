// backend/scripts/monitor.js
const os = require('os');
const { sequelize } = require('../src/config/database');
const { redis } = require('../src/config/redis');
const { logger } = require('../src/config/logger');

/**
 * System Monitor
 * Checks system health and performance
 */
async function monitor() {
    try {
        console.log('\n📊 System Monitor');
        console.log('═'.repeat(50));

        // System Info
        console.log('\n💻 System:');
        console.log(`  Platform: ${os.platform()}`);
        console.log(`  Architecture: ${os.arch()}`);
        console.log(`  CPU Cores: ${os.cpus().length}`);
        console.log(`  Memory: ${formatBytes(os.totalmem())}`);
        console.log(`  Free Memory: ${formatBytes(os.freemem())}`);
        console.log(`  Memory Usage: ${((1 - os.freemem() / os.totalmem()) * 100).toFixed(1)}%`);
        console.log(`  Load Average: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}`);
        console.log(`  Uptime: ${formatUptime(os.uptime())}`);

        // Database
        console.log('\n🗄️ Database:');
        try {
            await sequelize.authenticate();
            console.log('  Status: ✅ Connected');

            const [dbSize] = await sequelize.query(`
                SELECT pg_database_size(current_database()) as size
            `);
            console.log(`  Size: ${formatBytes(parseInt(dbSize[0].size))}`);

            const [connections] = await sequelize.query(`
                SELECT count(*) as connections FROM pg_stat_activity
            `);
            console.log(`  Connections: ${connections[0].connections}`);

            const [tables] = await sequelize.query(`
                SELECT count(*) as tables 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `);
            console.log(`  Tables: ${tables[0].tables}`);
        } catch (error) {
            console.log('  Status: ❌ Disconnected');
            console.log(`  Error: ${error.message}`);
        }

        // Redis
        console.log('\n🔴 Redis:');
        try {
            await redis.ping();
            console.log('  Status: ✅ Connected');

            const info = await redis.info();
            const memory = info.match(/used_memory_human:([^\n]+)/);
            if (memory) console.log(`  Memory: ${memory[1].trim()}`);

            const keys = await redis.dbsize();
            console.log(`  Keys: ${keys}`);

            const connectedClients = info.match(/connected_clients:([^\n]+)/);
            if (connectedClients) console.log(`  Clients: ${connectedClients[1].trim()}`);
        } catch (error) {
            console.log('  Status: ❌ Disconnected');
            console.log(`  Error: ${error.message}`);
        }

        // Application
        console.log('\n🚀 Application:');
        console.log(`  Node Version: ${process.version}`);
        console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`  Port: ${process.env.PORT || 3000}`);
        console.log(`  Uptime: ${formatUptime(process.uptime())}`);

        const memoryUsage = process.memoryUsage();
        console.log(`  Memory RSS: ${formatBytes(memoryUsage.rss)}`);
        console.log(`  Memory Heap: ${formatBytes(memoryUsage.heapUsed)} / ${formatBytes(memoryUsage.heapTotal)}`);
        console.log(`  Memory External: ${formatBytes(memoryUsage.external)}`);

        // Process Info
        console.log('\n⚙️ Process:');
        console.log(`  PID: ${process.pid}`);
        console.log(`  CPU Usage: ${process.cpuUsage().user / 1000}ms`);

        console.log('\n' + '═'.repeat(50));

        process.exit(0);
    } catch (error) {
        console.error('❌ Monitor failed:', error);
        process.exit(1);
    }
}

/**
 * Format bytes
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format uptime
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
}

// Run monitor
monitor();