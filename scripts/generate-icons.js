import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const srcImage = path.resolve('public/assets/Flower Spiral Fibonacci.png');

if (!fs.existsSync(srcImage)) {
  console.error(`Source image not found at ${srcImage}`);
  process.exit(1);
}

const appxDir = path.resolve('build/appx');
const targetDirs = [
  path.resolve('build/icons'),
  path.resolve('electron/icons'),
  path.resolve('public/icons')
];

[...targetDirs, appxDir].forEach(dir => {
  fs.mkdirSync(dir, { recursive: true });
});

const sizes = [16, 24, 32, 44, 48, 50, 64, 71, 96, 128, 150, 256, 300, 310, 512, 1024];

function runMagick(args) {
  try {
    execSync(`magick ${args}`, { stdio: 'pipe' });
  } catch (e) {
    if (process.platform === 'win32') {
      throw new Error(`ImageMagick "magick" command failed on Windows: ${e.message}`);
    }
    execSync(`convert ${args}`, { stdio: 'pipe' });
  }
}

console.log('Generating square cropped base 1024x1024 image...');
const base1024 = path.resolve('build/icons/1024x1024.png');
// Crop to square center and resize to 1024x1024
runMagick(`"${srcImage}" -gravity center -crop 955x955+0+0 +repage -resize 1024x1024 PNG32:"${base1024}"`);

for (const size of sizes) {
  const sizeName = `${size}x${size}.png`;
  console.log(`Generating ${sizeName}...`);
  for (const dir of targetDirs) {
    const outPath = path.join(dir, sizeName);
    runMagick(`"${base1024}" -resize ${size}x${size} PNG32:"${outPath}"`);
  }
}

// Generate 128x128@2x.png (which is 256x256)
for (const dir of targetDirs) {
  const at2x = path.join(dir, '128x128@2x.png');
  runMagick(`"${base1024}" -resize 256x256 PNG32:"${at2x}"`);
}

// Generate icon.png (512x512) for build/, electron/icons/, and public/icons/
const icon512 = path.resolve('build/icon.png');
runMagick(`"${base1024}" -resize 512x512 PNG32:"${icon512}"`);
fs.copyFileSync(icon512, path.resolve('electron/icons/icon.png'));
fs.copyFileSync(icon512, path.resolve('public/icons/icon.png'));

// Generate multi-resolution icon.ico for Windows EXE & window icon
const icoPath = path.resolve('build/icon.ico');
console.log('Generating multi-resolution icon.ico...');
runMagick(`"${base1024}" -define icon:auto-resize=256,128,64,48,32,24,16 "${icoPath}"`);
fs.copyFileSync(icoPath, path.resolve('build/icons/icon.ico'));
fs.copyFileSync(icoPath, path.resolve('electron/icons/icon.ico'));
fs.copyFileSync(icoPath, path.resolve('public/favicon.ico'));

// Generate Windows Store / AppX visual assets in build/appx/
// electron-builder's AppXTarget reads build/appx/ (NOT win.icon) and falls back to the
// grey Electron atom logo (SampleAppx.*.png) if StoreLogo.png, Square150x150Logo.png,
// Square44x44Logo.png, or Wide310x150Logo.png are missing from build/appx/.
console.log('Generating Microsoft Store / AppX assets in build/appx/...');

const appxSquareAssets = [
  { name: 'StoreLogo.png', size: 50 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'LargeTile.png', size: 310 },
  { name: 'SmallTile.png', size: 71 },
  { name: 'BadgeLogo.png', size: 24 }
];

for (const asset of appxSquareAssets) {
  const outFile = path.join(appxDir, asset.name);
  runMagick(`"${base1024}" -resize ${asset.size}x${asset.size} PNG32:"${outFile}"`);
}

// Wide310x150Logo.png (310x150) & SplashScreen.png (620x300):
// Center the SeedPlanet emblem on a dark space-navy canvas (#18212b) matching the app theme
const wideLogoPath = path.join(appxDir, 'Wide310x150Logo.png');
runMagick(`"${base1024}" -resize 136x136 -gravity center -background "#18212b" -extent 310x150 PNG32:"${wideLogoPath}"`);

const splashPath = path.join(appxDir, 'SplashScreen.png');
runMagick(`"${base1024}" -resize 260x260 -gravity center -background "#18212b" -extent 620x300 PNG32:"${splashPath}"`);

// Verify all required icons and AppX assets exist and are non-empty
const requiredFiles = [
  icoPath,
  path.resolve('electron/icons/icon.ico'),
  path.resolve('electron/icons/icon.png'),
  path.join(appxDir, 'StoreLogo.png'),
  path.join(appxDir, 'Square150x150Logo.png'),
  path.join(appxDir, 'Square44x44Logo.png'),
  path.join(appxDir, 'Wide310x150Logo.png'),
  path.join(appxDir, 'LargeTile.png'),
  path.join(appxDir, 'SmallTile.png'),
  path.join(appxDir, 'SplashScreen.png'),
  path.join(appxDir, 'BadgeLogo.png')
];

for (const reqFile of requiredFiles) {
  if (!fs.existsSync(reqFile) || fs.statSync(reqFile).size === 0) {
    console.error(`ERROR: Required icon asset missing or empty: ${reqFile}`);
    process.exit(1);
  }
}

console.log('All EXE, Linux, and Microsoft Store AppX icons generated and verified successfully!');
