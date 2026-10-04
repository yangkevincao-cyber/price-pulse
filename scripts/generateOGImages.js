// scripts/generateOGImages.js
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateOGImage(type = 'og') {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Set viewport for OG image
    if (type === 'og') {
        await page.setViewport({ width: 1200, height: 630 });
    } else {
        await page.setViewport({ width: 1200, height: 600 });
    }

    // HTML template for the OG image
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                width: 1200px;
                height: ${type === 'og' ? '630px' : '600px'};
                background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: 'Montserrat', Arial, sans-serif;
                position: relative;
            }
            .container {
                text-align: center;
                padding: 40px;
            }
            .logo {
                font-size: 72px;
                font-weight: 900;
                color: white;
                letter-spacing: 4px;
            }
            .logo span {
                color: #F59E0B;
            }
            .tagline {
                font-size: 28px;
                color: rgba(255,255,255,0.9);
                margin-top: 20px;
                font-weight: 300;
                letter-spacing: 2px;
            }
            .features {
                display: flex;
                justify-content: center;
                gap: 40px;
                margin-top: 40px;
            }
            .feature {
                background: rgba(255,255,255,0.15);
                padding: 15px 30px;
                border-radius: 12px;
                color: white;
                font-size: 18px;
                font-weight: 500;
                backdrop-filter: blur(10px);
            }
            .pulse-line {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, transparent, #F59E0B, transparent);
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">PRICE<span>PULSE</span></div>
            <div class="tagline">Feel the Market Pulse</div>
            <div class="features">
                <span class="feature">📊 Demand Alerts</span>
                <span class="feature">🏷️ Price Compare</span>
                <span class="feature">🤝 Smart Exchange</span>
            </div>
        </div>
        <div class="pulse-line"></div>
    </body>
    </html>
    `;

    await page.setContent(html);
    await page.waitForTimeout(1000);

    // Screenshot
    const filename = type === 'og' ? 'og-image.jpg' : 'twitter-image.jpg';
    await page.screenshot({
        path: path.join(__dirname, '../frontend/public', filename),
        type: 'jpeg',
        quality: 90,
    });

    await browser.close();
    console.log(`Generated: ${filename}`);
}

// Generate both images
generateOGImage('og');
generateOGImage('twitter');