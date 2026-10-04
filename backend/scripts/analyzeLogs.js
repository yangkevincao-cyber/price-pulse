// backend/scripts/analyzeLogs.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Analyze Logs
 * Provides statistics and analysis of log files
 */
async function analyzeLogs() {
    try {
        const logDir = path.join(__dirname, '../logs');
        const args = process.argv.slice(2);
        const logFile = args[0] || 'combined.log';
        const filePath = path.join(logDir, logFile);

        if (!fs.existsSync(filePath)) {
            console.error(`❌ Log file not found: ${logFile}`);
            process.exit(1);
        }

        console.log(`\n📊 Analyzing: ${logFile}`);
        console.log('═'.repeat(50));

        const stats = await analyzeFile(filePath);
        printStats(stats);

        process.exit(0);
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        process.exit(1);
    }
}

/**
 * Analyze a log file
 */
async function analyzeFile(filePath) {
    const stats = {
        totalLines: 0,
        errorLines: 0,
        warnLines: 0,
        infoLines: 0,
        httpLines: 0,
        debugLines: 0,
        errorsByType: {},
        topIPs: {},
        topURLs: {},
        topUsers: {},
        timeRange: { start: null, end: null },
        uniqueIPs: new Set(),
        uniqueUsers: new Set(),
    };

    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        stats.totalLines++;

        // Parse log line (JSON format)
        try {
            const log = JSON.parse(line);
            const level = log.level || 'unknown';

            // Count by level
            if (level.includes('ERROR')) stats.errorLines++;
            else if (level.includes('WARN')) stats.warnLines++;
            else if (level.includes('INFO')) stats.infoLines++;
            else if (level.includes('HTTP')) stats.httpLines++;
            else if (level.includes('DEBUG')) stats.debugLines++;

            // Track errors by type
            if (level.includes('ERROR') && log.message) {
                const type = log.message.split(':')[0] || 'Unknown';
                stats.errorsByType[type] = (stats.errorsByType[type] || 0) + 1;
            }

            // Track IPs
            if (log.ip) {
                stats.uniqueIPs.add(log.ip);
                stats.topIPs[log.ip] = (stats.topIPs[log.ip] || 0) + 1;
            }

            // Track URLs
            if (log.url) {
                stats.topURLs[log.url] = (stats.topURLs[log.url] || 0) + 1;
            }

            // Track users
            if (log.userId) {
                stats.uniqueUsers.add(log.userId);
                stats.topUsers[log.userId] = (stats.topUsers[log.userId] || 0) + 1;
            }

            // Track time range
            if (log.timestamp) {
                const timestamp = new Date(log.timestamp);
                if (!stats.timeRange.start || timestamp < stats.timeRange.start) {
                    stats.timeRange.start = timestamp;
                }
                if (!stats.timeRange.end || timestamp > stats.timeRange.end) {
                    stats.timeRange.end = timestamp;
                }
            }
        } catch (e) {
            // Skip non-JSON lines (like access.log format)
            if (line.includes('HTTP')) {
                stats.httpLines++;
            }
        }
    }

    return stats;
}

/**
 * Print statistics
 */
function printStats(stats) {
    console.log('\n📈 Summary:');
    console.log(`  Total Lines: ${stats.totalLines.toLocaleString()}`);
    console.log(`  Errors: ${stats.errorLines.toLocaleString()}`);
    console.log(`  Warnings: ${stats.warnLines.toLocaleString()}`);
    console.log(`  Info: ${stats.infoLines.toLocaleString()}`);
    console.log(`  HTTP Requests: ${stats.httpLines.toLocaleString()}`);
    console.log(`  Debug: ${stats.debugLines.toLocaleString()}`);

    if (stats.timeRange.start && stats.timeRange.end) {
        console.log('\n⏰ Time Range:');
        console.log(`  Start: ${stats.timeRange.start.toISOString()}`);
        console.log(`  End: ${stats.timeRange.end.toISOString()}`);
        const duration = stats.timeRange.end - stats.timeRange.start;
        console.log(`  Duration: ${formatDuration(duration)}`);
    }

    console.log(`\n👤 Users:`);
    console.log(`  Unique Users: ${stats.uniqueUsers.size}`);
    const topUsers = Object.entries(stats.topUsers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    topUsers.forEach(([user, count], i) => {
        console.log(`  ${i + 1}. User ${user}: ${count} requests`);
    });

    console.log(`\n🌐 IPs:`);
    console.log(`  Unique IPs: ${stats.uniqueIPs.size}`);
    const topIPs = Object.entries(stats.topIPs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    topIPs.forEach(([ip, count], i) => {
        console.log(`  ${i + 1}. ${ip}: ${count} requests`);
    });

    console.log(`\n📁 Top URLs:`);
    const topURLs = Object.entries(stats.topURLs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    topURLs.forEach(([url, count], i) => {
        console.log(`  ${i + 1}. ${url}: ${count} requests`);
    });

    if (Object.keys(stats.errorsByType).length > 0) {
        console.log(`\n❌ Errors by Type:`);
        const errors = Object.entries(stats.errorsByType)
            .sort((a, b) => b[1] - a[1]);
        errors.forEach(([type, count], i) => {
            console.log(`  ${i + 1}. ${type}: ${count}`);
        });
    }

    console.log('\n' + '═'.repeat(50));
}

/**
 * Format duration
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Run analysis
analyzeLogs();