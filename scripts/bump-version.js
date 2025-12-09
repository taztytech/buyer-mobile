#!/usr/bin/env node

/**
 * Combined Version Auto-Bump Script
 * Bumps versions for both Android and iOS
 * 
 * Usage:
 *   node scripts/bump-version.js [patch|minor|major] [--android-only] [--ios-only]
 *   Default: patch (increments versionCode/buildNumber only)
 */

const { execSync } = require('child_process');
const path = require('path');

const bumpType = process.argv[2] || 'patch';
const androidOnly = process.argv.includes('--android-only');
const iosOnly = process.argv.includes('--ios-only');

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('❌ Invalid bump type. Use: patch, minor, or major');
  process.exit(1);
}

console.log(`🚀 Bumping version (${bumpType})...\n`);

try {
  if (!iosOnly) {
    console.log('📱 Bumping Android version...');
    execSync(`node ${path.join(__dirname, 'bump-android-version.js')} ${bumpType}`, { stdio: 'inherit' });
    console.log('');
  }
  
  if (!androidOnly) {
    console.log('🍎 Bumping iOS version...');
    execSync(`node ${path.join(__dirname, 'bump-ios-version.js')} ${bumpType}`, { stdio: 'inherit' });
    console.log('');
  }
  
  console.log('✅ All versions bumped successfully!');
} catch (error) {
  console.error('❌ Error bumping versions:', error.message);
  process.exit(1);
}
