// scripts/generateLogos.js
const fs = require('fs');
const path = require('path');

const LOGO_DIR = path.join(__dirname, '../frontend/public/logo');

// Ensure directory exists
if (!fs.existsSync(LOGO_DIR)) {
    fs.mkdirSync(LOGO_DIR, { recursive: true });
}

// All logo SVGs (paste from above)
const logos = {
    'pricepulse-logo.svg': `<!-- Primary Logo -->\n<svg ...>...</svg>`,
    'pricepulse-horizontal.svg': `<!-- Horizontal Logo -->\n<svg ...>...</svg>`,
    'pricepulse-white.svg': `<!-- White Logo -->\n<svg ...>...</svg>`,
    'pricepulse-small.svg': `<!-- Small Logo -->\n<svg ...>...</svg>`,
    'pricepulse-mark.svg': `<!-- Logo Mark -->\n<svg ...>...</svg>`,
    'pricepulse-animated.svg': `<!-- Animated Logo -->\n<svg ...>...</svg>`,
};

// Write each logo
Object.entries(logos).forEach(([filename, svgContent]) => {
    const filepath = path.join(LOGO_DIR, filename);
    fs.writeFileSync(filepath, svgContent);
    console.log(`✅ Generated: ${filename}`);
});

// Also save favicon version
fs.writeFileSync(
    path.join(__dirname, '../frontend/public/favicon.svg'),
    logos['pricepulse-mark.svg'] // Use mark as favicon
);

console.log('🎨 All logos generated successfully!');