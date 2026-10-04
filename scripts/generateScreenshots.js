// scripts/generateScreenshots.js
const puppeteer = require('puppeteer');
const path = require('path');

async function generateScreenshots() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Navigate to your app (run npm run dev first)
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });

    // Wait for content to load
    await page.waitForSelector('#root');
    await page.waitForTimeout(2000);

    // Desktop screenshot
    await page.setViewport({ width: 1280, height: 720 });
    await page.screenshot({
        path: path.join(__dirname, '../frontend/public/screenshots/desktop.png'),
        type: 'png',
        fullPage: true,
    });
    console.log('Generated: desktop.png');

    // Mobile screenshot
    await page.setViewport({ width: 360, height: 740 });
    await page.screenshot({
        path: path.join(__dirname, '../frontend/public/screenshots/mobile.png'),
        type: 'png',
        fullPage: true,
    });
    console.log('Generated: mobile.png');

    await browser.close();
}

generateScreenshots();