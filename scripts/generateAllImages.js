// scripts/generateAllImages.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const puppeteer = require('puppeteer');

const PUBLIC_DIR = path.join(__dirname, '../frontend/public');
const SCREENSHOTS_DIR = path.join(PUBLIC_DIR, 'screenshots');

// Ensure directories exist
if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// 1. Generate Favicon SVG
const faviconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1E3A8A"/>
      <stop offset="100%" style="stop-color:#3B82F6"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="48" fill="url(#g)"/>
  <path d="M25,50 L35,50 L40,30 L50,70 L55,45 L65,50 L75,50" 
        stroke="white" stroke-width="5" fill="none" 
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="70" cy="50" r="3" fill="#F59E0B"/>
</svg>`;

fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), faviconSVG);

// 2. Generate favicon files
async function generateFavicons() {
    const sizes = [
        { size: 16, name: 'favicon-16x16.png' },
        { size: 32, name: 'favicon-32x32.png' },
        { size: 180, name: 'apple-touch-icon.png' },
        { size: 192, name: 'android-chrome-192x192.png' },
        { size: 512, name: 'android-chrome-512x512.png' },
    ];

    for (const { size, name } of sizes) {
        await sharp(path.join(PUBLIC_DIR, 'favicon.svg'))
            .resize(size, size)
            .png()
            .toFile(path.join(PUBLIC_DIR, name));
        console.log(`✅ Generated: ${name}`);
    }

    // Generate ICO (requires ImageMagick)
    try {
        execSync(`convert ${path.join(PUBLIC_DIR, 'favicon-16x16.png')} ${path.join(PUBLIC_DIR, 'favicon-32x32.png')} ${path.join(PUBLIC_DIR, 'favicon.ico')}`);
        console.log('✅ Generated: favicon.ico');
    } catch (error) {
        console.log('⚠️  ImageMagick not found. favicon.ico not generated.');
    }
}

// 3. Generate OG Images
async function generateOGImages() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const ogTemplate = (width, height) => `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                width: ${width}px; height: ${height}px;
                background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
                display: flex; justify-content: center; align-items: center;
                font-family: 'Montserrat', Arial, sans-serif;
                position: relative;
            }
            .container { text-align: center; padding: 40px; }
            .logo { font-size: ${width > 1000 ? 72 : 48}px; font-weight: 900; color: white; letter-spacing: 4px; }
            .logo span { color: #F59E0B; }
            .tagline { font-size: ${width > 1000 ? 28 : 20}px; color: rgba(255,255,255,0.9); margin-top: 20px; font-weight: 300; letter-spacing: 2px; }
            .features { display: flex; justify-content: center; gap: 30px; margin-top: 40px; flex-wrap: wrap; }
            .feature { background: rgba(255,255,255,0.15); padding: ${width > 1000 ? '15px 30px' : '10px 20px'}; border-radius: 12px; color: white; font-size: ${width > 1000 ? 18 : 14}px; font-weight: 500; backdrop-filter: blur(10px); }
            .pulse-line { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, transparent, #F59E0B, transparent); }
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
    </html>`;

    // OG Image (1200x630)
    await page.setViewport({ width: 1200, height: 630 });
    await page.setContent(ogTemplate(1200, 630));
    await page.waitForTimeout(1000);
    await page.screenshot({
        path: path.join(PUBLIC_DIR, 'og-image.jpg'),
        type: 'jpeg',
        quality: 90,
    });
    console.log('✅ Generated: og-image.jpg');

    // Twitter Image (1200x600)
    await page.setViewport({ width: 1200, height: 600 });
    await page.setContent(ogTemplate(1200, 600));
    await page.waitForTimeout(1000);
    await page.screenshot({
        path: path.join(PUBLIC_DIR, 'twitter-image.jpg'),
        type: 'jpeg',
        quality: 90,
    });
    console.log('✅ Generated: twitter-image.jpg');

    await browser.close();
}

// 4. Generate Screenshots
async function generateScreenshots() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Make sure dev server is running
    console.log('📸 Opening your app... (make sure npm run dev is running)');

    try {
        await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 30000 });
        await page.waitForSelector('#root', { timeout: 10000 });
        await page.waitForTimeout(2000);
    } catch (error) {
        console.log('⚠️  Could not connect to dev server. Please run: npm run dev');
        await browser.close();
        return;
    }

    // Desktop
    await page.setViewport({ width: 1280, height: 720 });
    await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'desktop.png'),
        type: 'png',
        fullPage: true,
    });
    console.log('✅ Generated: screenshots/desktop.png');

    // Mobile
    await page.setViewport({ width: 360, height: 740 });
    await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'mobile.png'),
        type: 'png',
        fullPage: true,
    });
    console.log('✅ Generated: screenshots/mobile.png');

    await browser.close();
}

// 5. Add to package.json scripts
function updatePackageJson() {
    const pkgPath = path.join(__dirname, '../package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.scripts = pkg.scripts || {};
        pkg.scripts['generate:images'] = 'node scripts/generateAllImages.js';
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        console.log('✅ Added "generate:images" script to package.json');
    }
}

// Run all
async function main() {
    console.log('🎨 Generating all images...\n');

    console.log('📐 Generating favicons...');
    await generateFavicons();

    console.log('\n🖼️ Generating OG images...');
    await generateOGImages();

    console.log('\n📱 Generating screenshots...');
    await generateScreenshots();

    console.log('\n✅ All images generated successfully!');
    console.log(`📁 Location: ${PUBLIC_DIR}`);
}

main();