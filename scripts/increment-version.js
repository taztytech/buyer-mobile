#!/usr/bin/env node

/**
 * Complete Version Bump Script
 * Increments versionName and versionCode across all configuration files
 * 
 * Updates:
 *   - versionName: Incremented based on type (patch/minor/major)
 *   - versionCode: Always incremented by 1 (required for Android builds)
 * 
 * Files updated:
 *   - android/version.properties (VERSION_CODE & VERSION_NAME)
 *   - package.json (version)
 *   - app.json (version)
 *   - app.config.js (version)
 *   - src/config/api.config.ts (APP_VERSION)
 *   - src/config/appVersion.generated.ts (APP_VERSION_CODE & APP_VERSION_NAME)
 * 
 * Usage:
 *   node scripts/increment-version.js [patch|minor|major]
 *   Default: patch (1.0.1 → 1.0.2, versionCode: 5 → 6)
 */

const fs = require('fs');
const path = require('path');

// File paths
const VERSION_PROPS_PATH = path.join(__dirname, '..', 'android', 'version.properties');
const PACKAGE_JSON_PATH = path.join(__dirname, '..', 'package.json');
const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');
const APP_CONFIG_JS_PATH = path.join(__dirname, '..', 'app.config.js');
const API_CONFIG_TS_PATH = path.join(__dirname, '..', 'src', 'config', 'api.config.ts');
const APP_VERSION_TS_PATH = path.join(__dirname, '..', 'src', 'config', 'appVersion.generated.ts');

// Parse version string (e.g., "1.0.1") into parts
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

// Load android/version.properties
function loadVersionProps() {
  const defaults = { VERSION_CODE: '3', VERSION_NAME: '1.0.0' };

  if (!fs.existsSync(VERSION_PROPS_PATH)) {
    return { ...defaults };
  }

  const content = fs.readFileSync(VERSION_PROPS_PATH, 'utf8');
  const lines = content.split('\n');
  const props = { ...defaults };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, value] = trimmed.split('=');
    if (key && value !== undefined) {
      props[key.trim()] = value.trim();
    }
  }

  return props;
}

// Save android/version.properties
function saveVersionProps(props) {
  const lines = [
    `VERSION_CODE=${props.VERSION_CODE}`,
    `VERSION_NAME=${props.VERSION_NAME}`,
    ''
  ];

  fs.writeFileSync(VERSION_PROPS_PATH, lines.join('\n'), 'utf8');
}

// Update package.json
function updatePackageJson(newVersion) {
  if (!fs.existsSync(PACKAGE_JSON_PATH)) {
    console.warn('⚠️  package.json not found, skipping');
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  
  fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  console.log(`   ✅ package.json: ${oldVersion} → ${newVersion}`);
}

// Update app.json
function updateAppJson(newVersion) {
  if (!fs.existsSync(APP_JSON_PATH)) {
    console.warn('⚠️  app.json not found, skipping');
    return;
  }
  
  const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
  const oldVersion = appJson.rncli?.version;
  appJson.rncli.version = newVersion;
  
  fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n', 'utf8');
  console.log(`   ✅ app.json: ${oldVersion} → ${newVersion}`);
}

// Update app.config.js
function updateAppConfigJs(newVersion) {
  if (!fs.existsSync(APP_CONFIG_JS_PATH)) {
    console.warn('⚠️  app.config.js not found, skipping');
    return;
  }
  
  let content = fs.readFileSync(APP_CONFIG_JS_PATH, 'utf8');
  const oldVersionMatch = content.match(/version:\s*["']([^"']+)["']/);
  const oldVersion = oldVersionMatch ? oldVersionMatch[1] : 'unknown';
  
  // Replace version in the module.exports section
  content = content.replace(
    /(version:\s*["'])([^"']+)(["'])/,
    `$1${newVersion}$3`
  );
  
  fs.writeFileSync(APP_CONFIG_JS_PATH, content, 'utf8');
  console.log(`   ✅ app.config.js: ${oldVersion} → ${newVersion}`);
}

// Update api.config.ts
function updateApiConfigTs(newVersion) {
  if (!fs.existsSync(API_CONFIG_TS_PATH)) {
    console.warn('⚠️  api.config.ts not found, skipping');
    return;
  }
  
  let content = fs.readFileSync(API_CONFIG_TS_PATH, 'utf8');
  const oldVersionMatch = content.match(/APP_VERSION:\s*['"]([^'"]+)['"]/);
  const oldVersion = oldVersionMatch ? oldVersionMatch[1] : 'unknown';
  
  // Replace APP_VERSION
  content = content.replace(
    /(APP_VERSION:\s*['"])([^'"]+)(['"])/,
    `$1${newVersion}$3`
  );
  
  fs.writeFileSync(API_CONFIG_TS_PATH, content, 'utf8');
  console.log(`   ✅ api.config.ts: ${oldVersion} → ${newVersion}`);
}

// Generate TypeScript config file for app version
function writeAppVersionConfig(versionName, versionCode) {
  const fileContents = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// This file is generated by scripts/increment-version.js
// It keeps the JS/TS layer in sync with native Android versioning.

export const APP_VERSION_NAME = '${versionName}';
export const APP_VERSION_CODE = ${versionCode};
`;

  fs.writeFileSync(APP_VERSION_TS_PATH, fileContents, 'utf8');
  console.log(`   ✅ appVersion.generated.ts: ${versionName} (code: ${versionCode})`);
}

// Main function
function incrementVersionName(bumpType = 'patch') {
  console.log(`\n🚀 Incrementing version (${bumpType})...\n`);
  
  // Load current version from android/version.properties
  const props = loadVersionProps();
  const currentVersionName = props.VERSION_NAME;
  const currentVersionCode = parseInt(props.VERSION_CODE, 10) || 0;
  
  // Increment version
  const newVersionName = incrementVersion(currentVersionName, bumpType);
  const newVersionCode = currentVersionCode + 1;
  
  console.log(`📦 Current version: ${currentVersionName} (code: ${currentVersionCode})`);
  console.log(`📦 New version: ${newVersionName} (code: ${newVersionCode})\n`);
  
  // Update all files
  console.log('📝 Updating files...\n');
  
  // 1. Update android/version.properties
  props.VERSION_NAME = newVersionName;
  props.VERSION_CODE = String(newVersionCode);
  saveVersionProps(props);
  console.log(`   ✅ android/version.properties: ${currentVersionName} → ${newVersionName}`);
  console.log(`   ✅ android/version.properties: versionCode ${currentVersionCode} → ${newVersionCode}`);
  
  // 2. Update package.json
  updatePackageJson(newVersionName);
  
  // 3. Update app.json
  updateAppJson(newVersionName);
  
  // 4. Update app.config.js
  updateAppConfigJs(newVersionName);
  
  // 5. Update api.config.ts
  updateApiConfigTs(newVersionName);
  
  // 6. Update generated TypeScript file
  writeAppVersionConfig(newVersionName, newVersionCode);
  
  console.log('\n✅ Version increment complete!');
  console.log(`\n📋 Summary:`);
  console.log(`   Version Name: ${currentVersionName} → ${newVersionName}`);
  console.log(`   Version Code: ${currentVersionCode} → ${newVersionCode}`);
  console.log(`\n📁 Files updated with versionCode:`);
  console.log(`   ✓ android/version.properties (VERSION_CODE: ${newVersionCode})`);
  console.log(`   ✓ src/config/appVersion.generated.ts (APP_VERSION_CODE: ${newVersionCode})`);
  console.log(`\n📁 Files updated with versionName:`);
  console.log(`   ✓ android/version.properties (VERSION_NAME: ${newVersionName})`);
  console.log(`   ✓ package.json (version: ${newVersionName})`);
  console.log(`   ✓ app.json (version: ${newVersionName})`);
  console.log(`   ✓ app.config.js (version: ${newVersionName})`);
  console.log(`   ✓ src/config/api.config.ts (APP_VERSION: ${newVersionName})`);
  console.log(`   ✓ src/config/appVersion.generated.ts (APP_VERSION_NAME: ${newVersionName})`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review the changes`);
  console.log(`   2. Clean build: cd android && ./gradlew clean`);
  console.log(`   3. Rebuild: npm run build:android:all:release:prod`);
  
  return { versionName: newVersionName, versionCode: newVersionCode };
}

// Main execution
const bumpType = process.argv[2] || 'patch';

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('❌ Invalid bump type. Use: patch, minor, or major');
  console.error('\nExamples:');
  console.error('  patch: 1.0.1 → 1.0.2');
  console.error('  minor: 1.0.1 → 1.1.0');
  console.error('  major: 1.0.1 → 2.0.0');
  process.exit(1);
}

try {
  incrementVersionName(bumpType);
  console.log('\n🎉 Done!\n');
} catch (error) {
  console.error('\n❌ Error incrementing version:', error.message);
  console.error(error.stack);
  process.exit(1);
}

