#!/usr/bin/env node

/**
 * iOS Version Auto-Bump Script
 * Automatically increments CFBundleVersion (build number) and optionally CFBundleShortVersionString
 * 
 * Usage:
 *   node scripts/bump-ios-version.js [patch|minor|major]
 *   Default: patch (increments build number only)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IOS_DIR = path.join(__dirname, '..', 'ios');
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

// Find Xcode project file
function findXcodeProject() {
  if (!fs.existsSync(IOS_DIR)) {
    return null;
  }
  
  const files = fs.readdirSync(IOS_DIR);
  const xcodeproj = files.find(f => f.endsWith('.xcodeproj'));
  
  if (!xcodeproj) {
    return null;
  }
  
  return path.join(IOS_DIR, xcodeproj);
}

// Get current version from Xcode project using PlistBuddy or agvtool
function getCurrentIOSVersion() {
  const xcodeproj = findXcodeProject();
  if (!xcodeproj) {
    // Try to read from Info.plist if it exists
    const infoPlistPath = path.join(IOS_DIR, 'Tazty', 'Info.plist');
    if (fs.existsSync(infoPlistPath)) {
      try {
        const plistContent = fs.readFileSync(infoPlistPath, 'utf8');
        const versionMatch = plistContent.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/);
        const buildMatch = plistContent.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/);
        
        if (versionMatch && buildMatch) {
          return {
            version: versionMatch[1],
            buildNumber: buildMatch[1]
          };
        }
      } catch (error) {
        console.warn('⚠️  Could not read Info.plist:', error.message);
      }
    }
    
    console.error('❌ iOS project not found. Run "npx rncli prebuild" first.');
    process.exit(1);
  }
  
  // Try using agvtool (requires Xcode)
  try {
    const projectName = path.basename(xcodeproj, '.xcodeproj');
    const agvOutput = execSync(`cd "${IOS_DIR}" && agvtool what-version -terse`, { encoding: 'utf8' }).trim();
    const marketingVersion = execSync(`cd "${IOS_DIR}" && agvtool what-marketing-version -terse`, { encoding: 'utf8' }).trim();
    
    return {
      version: marketingVersion || '1.0.0',
      buildNumber: agvOutput || '1'
    };
  } catch (error) {
    // Fallback: try to read from project.pbxproj
    const pbxprojPath = path.join(xcodeproj, 'project.pbxproj');
    if (fs.existsSync(pbxprojPath)) {
      const pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
      const versionMatch = pbxContent.match(/MARKETING_VERSION = ([^;]+);/);
      const buildMatch = pbxContent.match(/CURRENT_PROJECT_VERSION = ([^;]+);/);
      
      if (versionMatch && buildMatch) {
        return {
          version: versionMatch[1].trim().replace(/"/g, ''),
          buildNumber: buildMatch[1].trim().replace(/"/g, '')
        };
      }
    }
    
    console.error('❌ Could not determine current iOS version');
    process.exit(1);
  }
}

// Update iOS version using agvtool or direct file editing
function bumpIOSVersion(bumpType = 'patch') {
  const xcodeproj = findXcodeProject();
  if (!xcodeproj) {
    console.error('❌ iOS project not found');
    process.exit(1);
  }
  
  const current = getCurrentIOSVersion();
  const newVersion = incrementVersion(current.version, bumpType);
  const newBuildNumber = (parseInt(current.buildNumber, 10) + 1).toString();
  
  const projectName = path.basename(xcodeproj, '.xcodeproj');
  
  try {
    // Try using agvtool (preferred method)
    execSync(`cd "${IOS_DIR}" && agvtool new-version -all ${newBuildNumber}`, { stdio: 'inherit' });
    execSync(`cd "${IOS_DIR}" && agvtool new-marketing-version ${newVersion}`, { stdio: 'inherit' });
    
    console.log('✅ iOS version bumped successfully!');
    console.log(`   CFBundleVersion (Build): ${current.buildNumber} → ${newBuildNumber}`);
    console.log(`   CFBundleShortVersionString: ${current.version} → ${newVersion}`);
  } catch (error) {
    // Fallback: manual file editing
    console.warn('⚠️  agvtool failed, trying manual update...');
    
    // Update project.pbxproj
    const pbxprojPath = path.join(xcodeproj, 'project.pbxproj');
    if (fs.existsSync(pbxprojPath)) {
      let pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
      
      // Update MARKETING_VERSION
      pbxContent = pbxContent.replace(
        /MARKETING_VERSION = [^;]+;/g,
        `MARKETING_VERSION = ${newVersion};`
      );
      
      // Update CURRENT_PROJECT_VERSION
      pbxContent = pbxContent.replace(
        /CURRENT_PROJECT_VERSION = [^;]+;/g,
        `CURRENT_PROJECT_VERSION = ${newBuildNumber};`
      );
      
      fs.writeFileSync(pbxprojPath, pbxContent, 'utf8');
      
      // Also update Info.plist if it exists
      const infoPlistPath = path.join(IOS_DIR, projectName, 'Info.plist');
      if (fs.existsSync(infoPlistPath)) {
        let plistContent = fs.readFileSync(infoPlistPath, 'utf8');
        
        plistContent = plistContent.replace(
          /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/,
          `<key>CFBundleShortVersionString</key>\n\t<string>${newVersion}</string>`
        );
        
        plistContent = plistContent.replace(
          /<key>CFBundleVersion<\/key>\s*<string>[^<]+<\/string>/,
          `<key>CFBundleVersion</key>\n\t<string>${newBuildNumber}</string>`
        );
        
        fs.writeFileSync(infoPlistPath, plistContent, 'utf8');
      }
      
      console.log('✅ iOS version bumped successfully!');
      console.log(`   CFBundleVersion (Build): ${current.buildNumber} → ${newBuildNumber}`);
      console.log(`   CFBundleShortVersionString: ${current.version} → ${newVersion}`);
    } else {
      console.error('❌ Could not update iOS version');
      process.exit(1);
    }
  }
  
  return { version: newVersion, buildNumber: newBuildNumber };
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
  const { version } = bumpIOSVersion(bumpType);
  updatePackageJsonVersion(version);
  console.log('\n🎉 Version bump complete!');
} catch (error) {
  console.error('❌ Error bumping version:', error.message);
  process.exit(1);
}
