#!/usr/bin/env node

/**
 * Android Version Auto-Bump Script
 * Automatically increments versionCode and optionally versionName
 * 
 * Usage:
 *   node scripts/bump-android-version.js [patch|minor|major]
 *   Default: patch (increments versionCode only)
 */

const fs = require('fs');
const path = require('path');

const BUILD_GRADLE_PATH = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');

// Parse version string (e.g., "1.0.0") into parts
function parseVersion(version) {
  const parts = version.split('.').map(Number);
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0,
    toString() {
      return `${this.major}.${this.minor}.${this.patch}`;
    }
  };
}

// Increment version based on type
function incrementVersion(version, type = 'patch') {
  const v = parseVersion(version);
  
  switch (type) {
    case 'major':
      v.major++;
      v.minor = 0;
      v.patch = 0;
      break;
    case 'minor':
      v.minor++;
      v.patch = 0;
      break;
    case 'patch':
    default:
      v.patch++;
      break;
  }
  
  return v.toString();
}

// Read and update build.gradle
function bumpAndroidVersion(bumpType = 'patch') {
  if (!fs.existsSync(BUILD_GRADLE_PATH)) {
    console.error('❌ build.gradle not found at:', BUILD_GRADLE_PATH);
    process.exit(1);
  }

  let content = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
  
  // Extract current versionCode
  const versionCodeMatch = content.match(/versionCode\s+(\d+)/);
  if (!versionCodeMatch) {
    console.error('❌ Could not find versionCode in build.gradle');
    process.exit(1);
  }
  
  const currentVersionCode = parseInt(versionCodeMatch[1], 10);
  const newVersionCode = currentVersionCode + 1;
  
  // Extract current versionName
  const versionNameMatch = content.match(/versionName\s+"([^"]+)"/);
  if (!versionNameMatch) {
    console.error('❌ Could not find versionName in build.gradle');
    process.exit(1);
  }
  
  const currentVersionName = versionNameMatch[1];
  const newVersionName = incrementVersion(currentVersionName, bumpType);
  
  // Update versionCode
  content = content.replace(
    /versionCode\s+\d+/,
    `versionCode ${newVersionCode}`
  );
  
  // Update versionName
  content = content.replace(
    /versionName\s+"[^"]+"/,
    `versionName "${newVersionName}"`
  );
  
  // Write back to file
  fs.writeFileSync(BUILD_GRADLE_PATH, content, 'utf8');
  
  console.log('✅ Android version bumped successfully!');
  console.log(`   versionCode: ${currentVersionCode} → ${newVersionCode}`);
  console.log(`   versionName: ${currentVersionName} → ${newVersionName}`);
  
  return { versionCode: newVersionCode, versionName: newVersionName };
}

// Update package.json version
function updatePackageJsonVersion(newVersion) {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    console.warn('⚠️  package.json not found, skipping version update');
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`   package.json: ${oldVersion} → ${newVersion}`);
}

// Main execution
const bumpType = process.argv[2] || 'patch';

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('❌ Invalid bump type. Use: patch, minor, or major');
  process.exit(1);
}

try {
  const { versionName } = bumpAndroidVersion(bumpType);
  updatePackageJsonVersion(versionName);
  console.log('\n🎉 Version bump complete!');
} catch (error) {
  console.error('❌ Error bumping version:', error.message);
  process.exit(1);
}
