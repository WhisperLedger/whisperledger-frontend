const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const originalIconPath = path.join(__dirname, '../assets/images/icon.png');
  const backupPath = path.join(__dirname, '../assets/images/icon-original-backup.png');

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(originalIconPath, backupPath);
    console.log('Backed up original icon to icon-original-backup.png');
  }

  const baseInput = fs.existsSync(backupPath) ? backupPath : originalIconPath;

  // 1. Create SVG badge overlay
  const badgeSvg = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFE066" />
        <stop offset="45%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#B45309" />
      </linearGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000000" flood-opacity="0.65"/>
      </filter>
    </defs>
    
    <!-- Floating Pro Identifier in Top-Right -->
    <g transform="translate(680, 75)" filter="url(#shadow)">
      <!-- Gold Badge Background -->
      <rect x="0" y="0" width="250" height="96" rx="48" fill="url(#goldGrad)" stroke="#FFFFFF" stroke-width="5" />
      
      <!-- Crown Icon -->
      <path d="M 45 64 L 30 38 L 52 46 L 68 25 L 84 46 L 106 38 L 91 64 Z" fill="#FFFFFF" />
      <circle cx="30" cy="36" r="4" fill="#FFFFFF"/>
      <circle cx="68" cy="23" r="5" fill="#FFFFFF"/>
      <circle cx="106" cy="36" r="4" fill="#FFFFFF"/>
      
      <!-- Text PRO -->
      <text x="125" y="64" font-family="sans-serif" font-weight="900" font-size="46" fill="#FFFFFF" letter-spacing="3">PRO</text>
    </g>
  </svg>
  `;

  const badgeBuffer = Buffer.from(badgeSvg);

  // 2. Composite onto 1024x1024 base icon
  const proIcon1024Buffer = await sharp(baseInput)
    .resize(1024, 1024)
    .composite([{ input: badgeBuffer, top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Save to assets
  await sharp(proIcon1024Buffer).toFile(originalIconPath);
  await sharp(proIcon1024Buffer).toFile(path.join(__dirname, '../assets/images/adaptive-icon.png'));
  console.log('Updated assets/images/icon.png and adaptive-icon.png with PRO identifier!');

  // 3. Generate Android Mipmaps
  const resDir = path.join(__dirname, '../android/app/src/main/res');
  const densities = [
    { name: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  for (const d of densities) {
    const targetDir = path.join(resDir, d.name);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // ic_launcher.png
    await sharp(proIcon1024Buffer)
      .resize(d.iconSize, d.iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // ic_launcher_round.png (with circle mask or direct rounded)
    const circleMaskSvg = `
      <svg width="${d.iconSize}" height="${d.iconSize}">
        <circle cx="${d.iconSize / 2}" cy="${d.iconSize / 2}" r="${d.iconSize / 2}" fill="#ffffff" />
      </svg>
    `;
    await sharp(proIcon1024Buffer)
      .resize(d.iconSize, d.iconSize)
      .composite([{ input: Buffer.from(circleMaskSvg), blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (for adaptive icon on Android 8.0+)
    // Adaptive icon foreground needs some safe-zone padding (around 72% centered)
    const innerSize = Math.round(d.fgSize * 0.76);
    const padding = Math.round((d.fgSize - innerSize) / 2);
    
    const resizedInner = await sharp(proIcon1024Buffer)
      .resize(innerSize, innerSize)
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: d.fgSize,
        height: d.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }
    })
      .composite([{ input: resizedInner, top: padding, left: padding }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated launcher icons for ${d.name}`);
  }

  console.log('✅ ALL Android launcher icons successfully generated with the PRO identifier!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
