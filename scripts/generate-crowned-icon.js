const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateCrownedIcon() {
  const backupPath = path.join(__dirname, '../assets/images/icon-original-backup.png');
  const baseInput = fs.existsSync(backupPath) ? backupPath : path.join(__dirname, '../assets/images/icon.png');

  // 1. High-Resolution Vector Gold Crown that crowns the "W"
  const crownSvg = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="goldLight" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFFBEB" />
        <stop offset="25%" stop-color="#FDE68A" />
        <stop offset="55%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#B45309" />
      </linearGradient>

      <linearGradient id="goldDark" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#78350F" />
        <stop offset="50%" stop-color="#D97706" />
        <stop offset="100%" stop-color="#FCD34D" />
      </linearGradient>

      <linearGradient id="rubyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FDA4AF" />
        <stop offset="50%" stop-color="#E11D48" />
        <stop offset="100%" stop-color="#881337" />
      </linearGradient>

      <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#A7F3D0" />
        <stop offset="50%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#064E3B" />
      </linearGradient>

      <linearGradient id="diamondGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" />
        <stop offset="50%" stop-color="#E0F2FE" />
        <stop offset="100%" stop-color="#38BDF8" />
      </linearGradient>

      <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.6" />
        <stop offset="65%" stop-color="#D97706" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#1E1B4B" stop-opacity="0" />
      </radialGradient>

      <filter id="crownShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000000" flood-opacity="0.8" />
      </filter>
      
      <filter id="pillShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.7" />
      </filter>
    </defs>

    <!-- Warm Golden Light Aura Behind the Crown -->
    <circle cx="512" cy="225" r="230" fill="url(#glowGrad)" />

    <!-- Radiant Sparkle Stars -->
    <g transform="translate(300, 130) scale(0.9)">
      <path d="M 0 -28 Q 0 0 28 0 Q 0 0 0 28 Q 0 0 -28 0 Q 0 0 0 -28 Z" fill="#FFFBEB" />
    </g>
    <g transform="translate(724, 140) scale(0.8)">
      <path d="M 0 -24 Q 0 0 24 0 Q 0 0 0 24 Q 0 0 -24 0 Q 0 0 0 -24 Z" fill="#FFFBEB" />
    </g>
    <g transform="translate(512, 60) scale(0.6)">
      <path d="M 0 -20 Q 0 0 20 0 Q 0 0 0 20 Q 0 0 -20 0 Q 0 0 0 -20 Z" fill="#FFFBEB" />
    </g>

    <!-- The 3D Royal Gold Crown Resting Directly on the W Logo Apex -->
    <g transform="translate(512, 215) rotate(-5)" filter="url(#crownShadow)">
      <!-- Back Velvet Interior Arc -->
      <path d="M -160 46 C -90 64, 90 64, 160 46 L 144 16 C 80 32, -80 32, -144 16 Z" fill="#5B21B6" opacity="0.8" />

      <!-- Main Crown Peaks -->
      <path d="M -165 40 
               L -150 -55 
               L -80 10 
               L 0 -95 
               L 80 10 
               L 150 -55 
               L 165 40 
               C 95 60, -95 60, -165 40 Z" 
            fill="url(#goldLight)" 
            stroke="#FFFBEB" 
            stroke-width="5.5" 
            stroke-linejoin="round" />

      <!-- 3D Shading Facets -->
      <path d="M 0 -95 L 0 54 C 45 54, 100 48, 165 40 L 150 -55 L 80 10 Z" fill="url(#goldDark)" opacity="0.38" />
      <path d="M -80 10 L 0 -95 L 0 54 C -45 54, -100 48, -165 40 L -150 -55 Z" fill="url(#goldLight)" opacity="0.45" />

      <!-- Base Crown Band -->
      <path d="M -170 40 C -95 62, 95 62, 170 40 L 165 66 C 95 86, -95 86, -165 66 Z" 
            fill="url(#goldDark)" 
            stroke="#FFFBEB" 
            stroke-width="4.5" />

      <!-- Peak Gemstones -->
      <!-- Center Main Diamond -->
      <circle cx="0" cy="-100" r="18" fill="url(#diamondGrad)" stroke="#FFFFFF" stroke-width="3" />
      <circle cx="-4" cy="-104" r="4.5" fill="#FFFFFF" />

      <!-- Left Peak Ruby -->
      <circle cx="-150" cy="-60" r="14" fill="url(#rubyGrad)" stroke="#FFFFFF" stroke-width="2.5" />
      <circle cx="-153" cy="-63" r="3.5" fill="#FFFFFF" />

      <!-- Right Peak Emerald -->
      <circle cx="150" cy="-60" r="14" fill="url(#emeraldGrad)" stroke="#FFFFFF" stroke-width="2.5" />
      <circle cx="147" cy="-63" r="3.5" fill="#FFFFFF" />

      <!-- Inner Peak Diamonds -->
      <circle cx="-80" cy="8" r="11" fill="url(#diamondGrad)" stroke="#FFFBEB" stroke-width="2" />
      <circle cx="80" cy="8" r="11" fill="url(#diamondGrad)" stroke="#FFFBEB" stroke-width="2" />

      <!-- Band Jewels -->
      <circle cx="-115" cy="55" r="9" fill="url(#emeraldGrad)" />
      <circle cx="-60" cy="60" r="10" fill="url(#rubyGrad)" />
      <circle cx="0" cy="62" r="13" fill="url(#diamondGrad)" stroke="#FFFFFF" stroke-width="2.5" />
      <circle cx="60" cy="60" r="10" fill="url(#rubyGrad)" />
      <circle cx="115" cy="55" r="9" fill="url(#emeraldGrad)" />
    </g>

    <!-- Sleek "PRO" Badge at the Base within Safe Zone -->
    <g transform="translate(512, 855)" filter="url(#pillShadow)">
      <rect x="-105" y="-30" width="210" height="60" rx="30" fill="url(#goldLight)" stroke="#FFFFFF" stroke-width="4" />
      <text x="0" y="11" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="30" fill="#78350F" letter-spacing="4">👑 PRO</text>
    </g>
  </svg>
  `;

  // Base icon without white border/corners
  const baseImg = await sharp(baseInput)
    .resize(1024, 1024)
    .toBuffer();

  const fullCanvas = await sharp(baseImg)
    .composite([
      { input: Buffer.from(crownSvg), top: 0, left: 0 }
    ])
    .png()
    .toBuffer();

  const originalIconPath = path.join(__dirname, '../assets/images/icon.png');
  const adaptiveIconPath = path.join(__dirname, '../assets/images/adaptive-icon.png');

  await sharp(fullCanvas).toFile(originalIconPath);
  await sharp(fullCanvas).toFile(adaptiveIconPath);

  // Generate all Android launcher densities
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

    // 1. Standard square/legacy
    await sharp(fullCanvas)
      .resize(d.iconSize, d.iconSize)
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // 2. Round icon
    const circleMask = `
      <svg width="${d.iconSize}" height="${d.iconSize}">
        <circle cx="${d.iconSize / 2}" cy="${d.iconSize / 2}" r="${d.iconSize / 2}" fill="#ffffff" />
      </svg>
    `;
    await sharp(fullCanvas)
      .resize(d.iconSize, d.iconSize)
      .composite([{ input: Buffer.from(circleMask), blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // 3. Adaptive Foreground for Android 8.0 - 15 (Centered inside safe zone 72/108dp)
    const innerSize = Math.round(d.fgSize * 0.74);
    const offset = Math.round((d.fgSize - innerSize) / 2);

    const resizedFg = await sharp(fullCanvas)
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
      .composite([{ input: resizedFg, top: offset, left: offset }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));
  }

  console.log('✅ Crowned PRO App Icon fully generated with clean bleed background and safe zone alignment!');
}

generateCrownedIcon().catch(console.error);
