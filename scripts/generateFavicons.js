// scripts/generateFavicons.js
const sharp = require('sharp');
const fs = require('fs');

const svgBuffer = fs.readFileSync('frontend/public/favicon.svg');

const sizes = [
    { size: 16, name: 'favicon-16x16.png' },
    { size: 32, name: 'favicon-32x32.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'android-chrome-192x192.png' },
    { size: 512, name: 'android-chrome-512x512.png' },
];

async function generateFavicons() {
    for (const { size, name } of sizes) {
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(`frontend/public/${name}`);
        console.log(`Generated: ${name}`);
    }

    // Generate ICO (requires imagemagick or ico library)
    console.log('Favicons generated successfully!');
}

generateFavicons();