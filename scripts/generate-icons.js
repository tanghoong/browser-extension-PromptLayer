// This is a placeholder SVG icon that will be converted to PNG
// For production, replace with proper PNG icons

const fs = require('fs');
const path = require('path');

// Simple SVG icon
const svgIcon = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#10a37f" rx="24"/>
  <path d="M64 30 L38 50 L38 78 L64 98 L90 78 L90 50 Z" fill="none" stroke="white" stroke-width="6"/>
  <circle cx="64" cy="64" r="12" fill="white"/>
</svg>
`.trim();

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Save SVG placeholders
const sizes = [16, 48, 128];
sizes.forEach(size => {
  const svg = svgIcon.replace(/width="128" height="128"/, `width="${size}" height="${size}"`);
  const filename = `icon-${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svg);
  console.log(`Created ${filename}`);
});

console.log('\nPlaceholder SVG icons created!');
console.log('NOTE: For production, convert these to PNG or create proper icon files.');
