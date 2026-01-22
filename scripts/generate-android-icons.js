/**
 * Generate Android launcher icons from source app-icon.png
 * Based on the design: square with rounded corners, green background with radial pattern, "Tazty" text
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Android icon sizes (in pixels)
const ICON_SIZES = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

// Adaptive icon foreground sizes (108dp)
const FOREGROUND_SIZES = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

// Background sizes (same as foreground for adaptive icons)
const BACKGROUND_SIZES = FOREGROUND_SIZES;

/**
 * Create foreground icon from source image
 */
async function createForegroundIcon(sourcePath, outputPath, size) {
  await sharp(sourcePath)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
    })
    .toFile(outputPath);
}

/**
 * Create background icon with green color and radial pattern
 * Since we can't easily create complex patterns with sharp, we'll use a solid green
 * or extract the background from the source image
 */
async function createBackgroundIcon(outputPath, size, greenColor = { r: 0, g: 177, b: 79 }) {
  // Create a solid green rounded square
  // For a more complex pattern, we'd need to use the source image's background
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.15}" 
            fill="rgb(${greenColor.r}, ${greenColor.g}, ${greenColor.b})"/>
    </svg>
  `;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(outputPath);
}

/**
 * Create monochrome version of the icon
 */
async function createMonochromeIcon(sourcePath, outputPath, size) {
  await sharp(sourcePath)
    .resize(size, size, {
      fit: 'cover',
    })
    .greyscale()
    .toFile(outputPath);
}

/**
 * Create full launcher icon (for older Android versions)
 */
async function createFullLauncherIcon(sourcePath, outputPath, size) {
  await sharp(sourcePath)
    .resize(size, size, {
      fit: 'cover',
    })
    .toFile(outputPath);
}

/**
 * Extract background from source image and create background icon
 * Uses the source image's background (green with radial pattern)
 */
async function extractBackgroundIcon(sourcePath, outputPath, size) {
  // Use the source image itself for the background to preserve the green and radial pattern
  // The background should match the source image's background
  await sharp(sourcePath)
    .resize(size, size, {
      fit: 'cover',
    })
    .toFile(outputPath);
}

/**
 * Generate all Android launcher icons
 */
async function generateAllIcons(sourcePath, outputBaseDir) {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Error: Source image not found at ${sourcePath}`);
    return false;
  }

  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];

  for (const density of densities) {
    console.log(`Generating ${density} icons...`);

    const outputDir = path.join(outputBaseDir, `mipmap-${density}`);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const iconSize = ICON_SIZES[density];
    const foregroundSize = FOREGROUND_SIZES[density];
    const backgroundSize = BACKGROUND_SIZES[density];

    try {
      // Generate foreground icon
      const foregroundPath = path.join(outputDir, 'ic_launcher_foreground.png');
      await createForegroundIcon(sourcePath, foregroundPath, foregroundSize);
      console.log(`  ✓ Created: ${foregroundPath}`);

      // Generate background icon
      const backgroundPath = path.join(outputDir, 'ic_launcher_background.png');
      await extractBackgroundIcon(sourcePath, backgroundPath, backgroundSize);
      console.log(`  ✓ Created: ${backgroundPath}`);

      // Generate monochrome icon
      const monochromePath = path.join(outputDir, 'ic_launcher_monochrome.png');
      await createMonochromeIcon(sourcePath, monochromePath, iconSize);
      console.log(`  ✓ Created: ${monochromePath}`);

      // Generate full launcher icon
      const launcherPath = path.join(outputDir, 'ic_launcher.png');
      await createFullLauncherIcon(sourcePath, launcherPath, iconSize);
      console.log(`  ✓ Created: ${launcherPath}`);
    } catch (error) {
      console.error(`  ✗ Error generating ${density} icons:`, error.message);
      return false;
    }
  }

  console.log('\n✅ All icons generated successfully!');
  return true;
}

// Main execution
async function main() {
  const sourcePath = process.argv[2] || path.join('src', 'assets', 'app-icon.png');
  const outputBaseDir = process.argv[3] || path.join('android', 'app', 'src', 'main', 'res');

  console.log(`Source image: ${sourcePath}`);
  console.log(`Output directory: ${outputBaseDir}\n`);

  // Check if sharp is available
  try {
    require('sharp');
  } catch (error) {
    console.error('Error: sharp is required. Install it with: npm install --save-dev sharp');
    process.exit(1);
  }

  const success = await generateAllIcons(sourcePath, outputBaseDir);
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { generateAllIcons };

