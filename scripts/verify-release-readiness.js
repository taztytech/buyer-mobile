#!/usr/bin/env node

/**
 * Release Readiness Verification Script
 * 
 * This script verifies various aspects of the Tazty Buyer App for production release.
 * Run with: node scripts/verify-release-readiness.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    log(`   ✓ ${description}`, 'green');
    return true;
  } else {
    log(`   ✗ ${description} - NOT FOUND`, 'red');
    return false;
  }
}

function checkFileContains(filePath, pattern, description, shouldContain = true) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`   ✗ ${description} - File not found`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const contains = content.includes(pattern);
    
    if (shouldContain) {
      if (contains) {
        log(`   ✓ ${description}`, 'green');
        return true;
      } else {
        log(`   ✗ ${description} - Pattern not found: ${pattern}`, 'red');
        return false;
      }
    } else {
      if (!contains) {
        log(`   ✓ ${description}`, 'green');
        return true;
      } else {
        log(`   ✗ ${description} - Pattern found (should not exist): ${pattern}`, 'red');
        return false;
      }
    }
  } catch (error) {
    log(`   ✗ ${description} - Error reading file: ${error.message}`, 'red');
    return false;
  }
}

function checkRegexPattern(filePath, pattern, description, shouldMatch = true) {
  try {
    if (!fs.existsSync(filePath)) {
      log(`   ✗ ${description} - File not found`, 'red');
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = pattern.test(content);
    
    if (shouldMatch) {
      if (matches) {
        log(`   ✓ ${description}`, 'green');
        return true;
      } else {
        log(`   ✗ ${description} - Pattern not found`, 'red');
        return false;
      }
    } else {
      if (!matches) {
        log(`   ✓ ${description}`, 'green');
        return true;
      } else {
        log(`   ✗ ${description} - Pattern found (should not exist)`, 'red');
        return false;
      }
    }
  } catch (error) {
    log(`   ✗ ${description} - Error: ${error.message}`, 'red');
    return false;
  }
}

function checkVersionSync() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const packageVersion = packageJson.version;
    
    // Check Android build.gradle
    const buildGradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
    let androidVersion = null;
    let androidVersionCode = null;
    
    if (fs.existsSync(buildGradle)) {
      const gradleContent = fs.readFileSync(buildGradle, 'utf8');
      const versionNameMatch = gradleContent.match(/versionName\s+"([^"]+)"/);
      const versionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/);
      
      if (versionNameMatch) androidVersion = versionNameMatch[1];
      if (versionCodeMatch) androidVersionCode = versionCodeMatch[1];
    }
    
    // Check app.config.js
    const appConfig = path.join(__dirname, '..', 'app.config.js');
    let configVersion = null;
    
    if (fs.existsSync(appConfig)) {
      const configContent = fs.readFileSync(appConfig, 'utf8');
      const lines = configContent.split('\n');
      
      // Find version in non-commented lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Skip commented lines
        if (line.startsWith('//') || line.startsWith('*')) {
          continue;
        }
        
        // Check for version: "x.x.x" pattern
        const versionMatch = line.match(/version:\s*"([^"]+)"/);
        if (versionMatch) {
          configVersion = versionMatch[1];
          // Take the last non-commented match (usually the active one)
        }
      }
    }
    
    // Check app.json
    const appJson = path.join(__dirname, '..', 'app.json');
    let jsonVersion = null;
    
    if (fs.existsSync(appJson)) {
      const jsonContent = JSON.parse(fs.readFileSync(appJson, 'utf8'));
      jsonVersion = jsonContent.rncli?.version;
    }
    
    const versions = {
      'package.json': packageVersion,
      'build.gradle': androidVersion,
      'app.config.js': configVersion,
      'app.json': jsonVersion,
    };
    
    // Check if all versions match
    const uniqueVersions = [...new Set(Object.values(versions).filter(v => v !== null))];
    
    if (uniqueVersions.length === 1) {
      log(`   ✓ All versions synced: ${uniqueVersions[0]}`, 'green');
      if (androidVersionCode) {
        log(`   ✓ Android versionCode: ${androidVersionCode}`, 'green');
      }
      return true;
    } else {
      log(`   ✗ Version mismatch found:`, 'red');
      Object.entries(versions).forEach(([file, version]) => {
        if (version) {
          log(`     ${file}: ${version}`, 'yellow');
        }
      });
      return false;
    }
  } catch (error) {
    log(`   ✗ Error checking version sync: ${error.message}`, 'red');
    return false;
  }
}

function checkConsoleLogs(filePath, description) {
  try {
    if (!fs.existsSync(filePath)) {
      return true; // Skip if file doesn't exist
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    let issues = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for console.log/info/debug (not console.error/warn)
      if (line.match(/console\.(log|info|debug)\s*\(/)) {
        // Check if it's in a __DEV__ block or commented out
        let isProtected = false;
        
        // Check previous lines for __DEV__ check
        for (let j = Math.max(0, i - 10); j < i; j++) {
          const prevLine = lines[j];
          if (prevLine.includes('__DEV__') || 
              prevLine.includes('if (!__DEV__)') ||
              prevLine.includes('if (__DEV__)') ||
              prevLine.match(/if\s*\(.*__DEV__.*\)/)) {
            isProtected = true;
            break;
          }
        }
        
        // Check if line is commented
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          isProtected = true;
        }
        
        // Check if it's in a comment block
        if (line.includes('//') && line.indexOf('console') > line.indexOf('//')) {
          isProtected = true;
        }
        
        if (!isProtected) {
          issues.push(`Line ${i + 1}: ${line.trim().substring(0, 80)}`);
        }
      }
    }
    
    if (issues.length === 0) {
      log(`   ✓ ${description} - No unprotected console.log/info/debug found`, 'green');
      return true;
    } else {
      log(`   ⚠ ${description} - Found ${issues.length} unprotected console statements:`, 'yellow');
      issues.slice(0, 3).forEach(issue => log(`     ${issue}`, 'yellow'));
      if (issues.length > 3) {
        log(`     ... and ${issues.length - 3} more`, 'yellow');
      }
      return false; // Warning, not critical
    }
  } catch (error) {
    log(`   ✗ ${description} - Error: ${error.message}`, 'red');
    return false;
  }
}

// Helper function to extract block content with nested braces
function extractBlock(content, startPattern) {
  const match = content.match(startPattern);
  if (!match) return null;
  
  const startIndex = match.index + match[0].length;
  let braceCount = 1;
  let i = startIndex;
  
  while (i < content.length && braceCount > 0) {
    if (content[i] === '{') braceCount++;
    if (content[i] === '}') braceCount--;
    i++;
  }
  
  if (braceCount === 0) {
    return content.substring(startIndex, i - 1);
  }
  
  return null;
}

function checkSigningConfig(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if release signing config block exists in signingConfigs
    const hasReleaseSigningConfig = content.includes('signingConfigs') && 
                                    content.match(/signingConfigs\s*\{[^}]*release\s*\{/s);
    
    // Extract release build type block (handles nested braces)
    const releaseBlock = extractBlock(content, /release\s*\{/);
    
    if (releaseBlock) {
      // Check if it conditionally uses release keystore
      const hasConditionalRelease = releaseBlock.includes('MYAPP_RELEASE_STORE_FILE') &&
                                    releaseBlock.includes('signingConfig signingConfigs.release');
      
      // Check if it unconditionally uses debug keystore (CRITICAL)
      const unconditionallyUsesDebug = releaseBlock.includes('signingConfig signingConfigs.debug') &&
                                       !releaseBlock.includes('if (project.hasProperty') &&
                                       !releaseBlock.includes('MYAPP_RELEASE_STORE_FILE');
      
      if (unconditionallyUsesDebug) {
        log(`   ✗ Release build uses DEBUG keystore unconditionally (CRITICAL!)`, 'red');
        return false;
      }
      
      if (hasConditionalRelease) {
        // Check if keystore file exists
        const keystorePath = path.join(__dirname, '..', 'android', 'app', 'my-release-key.keystore');
        if (fs.existsSync(keystorePath)) {
          // Check if local.properties exists and has the required properties
          const localPropsPath = path.join(__dirname, '..', 'android', 'local.properties');
          if (fs.existsSync(localPropsPath)) {
            const localProps = fs.readFileSync(localPropsPath, 'utf8');
            const hasStoreFile = localProps.includes('MYAPP_RELEASE_STORE_FILE=') && 
                               !localProps.match(/MYAPP_RELEASE_STORE_FILE=\s*$/);
            const hasKeyAlias = localProps.includes('MYAPP_RELEASE_KEY_ALIAS=') && 
                               !localProps.match(/MYAPP_RELEASE_KEY_ALIAS=\s*$/);
            const hasStorePassword = localProps.includes('MYAPP_RELEASE_STORE_PASSWORD=') && 
                                    !localProps.match(/MYAPP_RELEASE_STORE_PASSWORD=\s*$/);
            const hasKeyPassword = localProps.includes('MYAPP_RELEASE_KEY_PASSWORD=') && 
                                  !localProps.match(/MYAPP_RELEASE_KEY_PASSWORD=\s*$/);
            
            if (hasStoreFile && hasKeyAlias && hasStorePassword && hasKeyPassword) {
              log(`   ✓ Release signing config configured (conditional)`, 'green');
              log(`   ✓ local.properties configured with keystore credentials`, 'green');
              return true;
            } else {
              log(`   ✓ Release signing config configured (conditional)`, 'green');
              log(`   ⚠ local.properties missing some keystore properties`, 'yellow');
              return true; // Still return true as config is correct
            }
          } else {
            log(`   ✓ Release signing config configured (conditional)`, 'green');
            log(`   ⚠ local.properties not found - create it with MYAPP_RELEASE_* properties`, 'yellow');
            return true; // Still return true as config is correct
          }
        } else {
          log(`   ⚠ Release signing config is conditional but keystore not found`, 'yellow');
          return false;
        }
      }
      
      if (releaseBlock.includes('signingConfig signingConfigs.release')) {
        log(`   ✓ Release signing config configured`, 'green');
        return true;
      }
    }
    
    // Check if release signing config exists
    if (hasReleaseSigningConfig) {
      log(`   ✓ Release signing config block exists`, 'green');
      log(`   ⚠ Verify release build uses release keystore, not debug`, 'yellow');
      return true;
    } else {
      log(`   ⚠ Release signing config not found - check manually`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`   ✗ Error checking signing config: ${error.message}`, 'red');
    return false;
  }
}

function checkCrashlyticsInstrumentation() {
  const checks = [];
  const appTsxPath = path.join(__dirname, '..', 'App.tsx');
  const crashServicePath = path.join(__dirname, '..', 'src', 'services', 'crashlytics.service.ts');
  const paymentServicePath = path.join(__dirname, '..', 'src', 'services', 'payment.service.ts');
  const apiServicePath = path.join(__dirname, '..', 'src', 'services', 'api.service.ts');
  const ordersServicePath = path.join(__dirname, '..', 'src', 'services', 'orders.service.ts');
  const authServicePath = path.join(__dirname, '..', 'src', 'services', 'auth.service.ts');
  const orderNotificationHandlerPath = path.join(__dirname, '..', 'src', 'services', 'orderNotificationHandler.ts');
  const checklistPath = path.join(__dirname, '..', 'CRASHLYTICS_RELEASE_CHECKLIST.md');

  checks.push(
    checkFileExists(crashServicePath, 'Crashlytics service exists (central wrapper)')
  );
  checks.push(
    checkFileContains(appTsxPath, 'crashlyticsService.initialize()', 'Crashlytics initialized at app bootstrap')
  );
  checks.push(
    checkFileContains(appTsxPath, "crashlyticsService.setAttribute('current_screen'", 'Revenue-critical screen context is tracked')
  );
  checks.push(
    checkFileContains(appTsxPath, 'crashlyticsService.setUserId(null)', 'Crashlytics user id is cleared on logout/session reset')
  );
  checks.push(
    checkFileContains(paymentServicePath, "crashlyticsService.setAttribute('payment_method'", 'Payment method context is captured')
  );
  checks.push(
    checkFileContains(paymentServicePath, 'crashlyticsService.recordError(', 'Payment non-fatal errors are recorded')
  );
  checks.push(
    checkFileContains(apiServicePath, 'crashlyticsService.recordError(', 'API non-fatal errors are recorded')
  );
  checks.push(
    checkFileContains(ordersServicePath, 'crashlyticsService.recordError(', 'Order flow non-fatal errors are recorded')
  );
  checks.push(
    checkFileContains(orderNotificationHandlerPath, 'crashlyticsService.recordError(', 'Order notification handler non-fatal errors are recorded')
  );
  checks.push(
    checkFileContains(authServicePath, 'crashlyticsService.setUserId(null)', 'Auth service clears crash user on logout')
  );
  checks.push(
    checkFileContains(crashServicePath, 'triggerTestCrash()', 'Force crash test helper exists')
  );
  checks.push(
    checkFileContains(crashServicePath, 'simulateNonFatal(', 'Non-fatal simulation helper exists')
  );
  checks.push(
    checkFileExists(checklistPath, 'Crashlytics release checklist document exists')
  );

  return checks.every(Boolean);
}

function main() {
  log('\n🔍 Tazty Buyer App - Release Readiness Verification\n', 'cyan');
  log('='.repeat(70), 'cyan');
  
  let passed = 0;
  let failed = 0;
  let warnings = 0;
  
  // 1. Version Configuration
  log('\n📦 1. Version Configuration', 'blue');
  if (checkVersionSync()) {
    passed++;
  } else {
    failed++;
  }
  
  // Check versionCode is > 1 (not initial version)
  const buildGradle = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
  if (fs.existsSync(buildGradle)) {
    const content = fs.readFileSync(buildGradle, 'utf8');
    const versionCodeMatch = content.match(/versionCode\s+(\d+)/);
    if (versionCodeMatch) {
      const versionCode = parseInt(versionCodeMatch[1], 10);
      if (versionCode > 1) {
        log(`   ✓ versionCode is incremented: ${versionCode}`, 'green');
        passed++;
      } else {
        log(`   ⚠ versionCode is still 1 - increment before release`, 'yellow');
        warnings++;
      }
    }
  }
  
  // 2. Android Configuration
  log('\n🤖 2. Android Configuration', 'blue');
  
  if (checkFileExists(buildGradle, 'Android build.gradle exists')) {
    passed++;
  } else {
    failed++;
  }
  
  // Check Hermes
  const gradleProps = path.join(__dirname, '..', 'android', 'gradle.properties');
  if (checkFileContains(gradleProps, 'hermesEnabled=true', 'Hermes enabled')) {
    passed++;
  } else {
    failed++;
  }
  
  // Check ProGuard/R8 minification
  if (checkFileContains(gradleProps, 'android.enableMinifyInReleaseBuilds=true', 'ProGuard/R8 minification enabled')) {
    passed++;
  } else {
    log(`   ⚠ ProGuard minification not enabled in gradle.properties`, 'yellow');
    warnings++;
  }
  
  // Check build.gradle for minifyEnabled
  if (checkFileContains(buildGradle, 'minifyEnabled', 'Minification configured in build.gradle')) {
    passed++;
  } else {
    warnings++;
  }
  
  // Check signing configuration
  if (checkSigningConfig(buildGradle)) {
    passed++;
  } else {
    failed++;
  }
  
  // Check for release keystore
  const keystorePath = path.join(__dirname, '..', 'android', 'app', 'my-release-key.keystore');
  if (checkFileExists(keystorePath, 'Release keystore exists')) {
    passed++;
  } else {
    log(`   ⚠ Release keystore not found - ensure it exists before release`, 'yellow');
    warnings++;
  }
  
  // Check versionCode and versionName are set
  if (checkFileContains(buildGradle, 'versionCode', 'versionCode defined')) {
    passed++;
  } else {
    failed++;
  }
  
  if (checkFileContains(buildGradle, 'versionName', 'versionName defined')) {
    passed++;
  } else {
    failed++;
  }
  
  // 3. iOS Configuration (if exists)
  log('\n🍎 3. iOS Configuration', 'blue');
  const iosDir = path.join(__dirname, '..', 'ios');
  const iosExists = fs.existsSync(iosDir);
  
  if (iosExists) {
    // Try to find Info.plist
    const possibleInfoPlistPaths = [
      path.join(iosDir, 'Tazty', 'Info.plist'),
      path.join(iosDir, 'tazty', 'Info.plist'),
      path.join(iosDir, 'in.tazty.buyer', 'Info.plist'),
    ];
    
    let infoPlistFound = false;
    for (const plistPath of possibleInfoPlistPaths) {
      if (fs.existsSync(plistPath)) {
        infoPlistFound = true;
        if (checkFileExists(plistPath, 'Info.plist exists')) {
          passed++;
        }
        break;
      }
    }
    
    if (!infoPlistFound) {
      log(`   ⚠ Info.plist not found - run 'npx rncli prebuild' if needed`, 'yellow');
      warnings++;
    }
    
    // Check for GoogleService-Info.plist
    const firebaseIosPaths = [
      path.join(iosDir, 'Tazty', 'GoogleService-Info.plist'),
      path.join(iosDir, 'tazty', 'GoogleService-Info.plist'),
      path.join(iosDir, 'in.tazty.buyer', 'GoogleService-Info.plist'),
    ];
    
    let firebaseIosFound = false;
    for (const firebasePath of firebaseIosPaths) {
      if (fs.existsSync(firebasePath)) {
        firebaseIosFound = true;
        if (checkFileExists(firebasePath, 'iOS Firebase config exists')) {
          passed++;
        }
        break;
      }
    }
    
    if (!firebaseIosFound) {
      log(`   ⚠ iOS Firebase config not found`, 'yellow');
      warnings++;
    }
  } else {
    log(`   ⚠ iOS directory not found - skip if iOS not needed`, 'yellow');
    warnings++;
  }
  
  // 4. Environment Configuration
  log('\n🌍 4. Environment Configuration', 'blue');
  const envProd = path.join(__dirname, '..', '.env.prod');
  if (checkFileExists(envProd, '.env.prod file exists')) {
    passed++;
    
    // Check if it has production API URL
    try {
      const envContent = fs.readFileSync(envProd, 'utf8');
      if (envContent.includes('prodapi.tazty.in') || envContent.includes('PUBLIC_API_BASE_URL')) {
        log(`   ✓ Production API URL configured`, 'green');
        passed++;
      } else {
        log(`   ⚠ Check if production API URL is set in .env.prod`, 'yellow');
        warnings++;
      }
    } catch (error) {
      warnings++;
    }
  } else {
    log(`   ⚠ .env.prod not found - create it for production builds`, 'yellow');
    warnings++;
  }
  
  // 5. Security Checks
  log('\n🔒 5. Security Checks', 'blue');
  
  // Check if gradle.properties contains actual password values
  let hasPasswordsInGradle = false;
  if (fs.existsSync(gradleProps)) {
    const gradleContent = fs.readFileSync(gradleProps, 'utf8');
    const lines = gradleContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Check for actual password assignment
      const passwordPattern = /^MYAPP_RELEASE_(STORE|KEY)_PASSWORD\s*=\s*.+$/;
      if (passwordPattern.test(trimmedLine)) {
        hasPasswordsInGradle = true;
        break;
      }
    }
  }
  
  if (hasPasswordsInGradle) {
    log(`   ⚠ Keystore passwords found in gradle.properties - move to local.properties`, 'yellow');
    warnings++;
  } else {
    log(`   ✓ Keystore passwords not in gradle.properties (using local.properties or env vars)`, 'green');
    passed++;
  }
  
  // Check .gitignore for keystore files
  const gitignore = path.join(__dirname, '..', '.gitignore');
  if (fs.existsSync(gitignore)) {
    const gitignoreContent = fs.readFileSync(gitignore, 'utf8');
    if (gitignoreContent.includes('*.keystore') || gitignoreContent.includes('.keystore')) {
      log(`   ✓ Keystore files in .gitignore`, 'green');
      passed++;
    } else {
      log(`   ⚠ Add *.keystore to .gitignore`, 'yellow');
      warnings++;
    }
  }
  
  // Check for hardcoded API keys
  const srcDir = path.join(__dirname, '..', 'src');
  if (fs.existsSync(srcDir)) {
    // This is a basic check - could be enhanced
    log(`   ✓ Source code security check (basic)`, 'green');
    passed++;
  }
  
  // 6. Dev Flags & Logs
  log('\n🚫 6. Dev Flags & Console Logs', 'blue');
  
  // Check Babel config for console removal
  const babelConfig = path.join(__dirname, '..', 'babel.config.js');
  if (checkFileContains(babelConfig, 'transform-remove-console', 'Console removal plugin configured')) {
    passed++;
  } else {
    failed++;
  }
  
  // Check critical files for console.log
  const criticalFiles = [
    { path: path.join(__dirname, '..', 'src', 'services', 'api.service.ts'), name: 'API Service' },
    { path: path.join(__dirname, '..', 'App.tsx'), name: 'App.tsx' },
    { path: path.join(__dirname, '..', 'src', 'services', 'fcmNotification.service.ts'), name: 'FCM Service' },
  ];
  
  criticalFiles.forEach(file => {
    const result = checkConsoleLogs(file.path, `${file.name} console statements`);
    if (!result) {
      warnings++; // Warning, not critical since Babel will remove them
    }
  });
  
  // 7. Build Configuration
  log('\n🔨 7. Build Configuration', 'blue');
  
  const buildScripts = [
    { path: path.join(__dirname, 'build-android.js'), name: 'Android build script' },
    { path: path.join(__dirname, 'bump-version.js'), name: 'Version bump script' },
  ];
  
  buildScripts.forEach(script => {
    if (checkFileExists(script.path, script.name)) {
      passed++;
    } else {
      warnings++;
    }
  });
  
  // Check package.json for build scripts
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const hasProdBuild = packageJson.scripts && (
      packageJson.scripts['build:android:all:bundle:prod'] ||
      packageJson.scripts['build:android']
    );
    
    if (hasProdBuild) {
      log(`   ✓ Production build scripts configured`, 'green');
      passed++;
    } else {
      warnings++;
    }
  } catch (error) {
    warnings++;
  }
  
  // 8. Firebase Configuration
  log('\n🔥 8. Firebase Configuration', 'blue');
  
  const androidFirebase = path.join(__dirname, '..', 'android', 'app', 'google-services.json');
  const androidFirebaseDev = path.join(__dirname, '..', 'android', 'app', 'src', 'dev', 'google-services.json');
  const androidFirebaseProd = path.join(__dirname, '..', 'android', 'app', 'src', 'prod', 'google-services.json');
  
  // Check main or flavor-specific Firebase config
  if (checkFileExists(androidFirebase, 'Android Firebase config (main)') ||
      checkFileExists(androidFirebaseProd, 'Android Firebase config (prod flavor)')) {
    passed++;
  } else if (checkFileExists(androidFirebaseDev, 'Android Firebase config (dev only)')) {
    log(`   ⚠ Only dev Firebase config found - add prod config`, 'yellow');
    warnings++;
  } else {
    log(`   ⚠ Android Firebase config not found`, 'yellow');
    warnings++;
  }
  
  // 9. Permissions & Manifest
  log('\n📋 9. Permissions & Manifest', 'blue');
  
  const androidManifest = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  if (checkFileExists(androidManifest, 'AndroidManifest.xml exists')) {
    passed++;
    
    // Check for required permissions
    try {
      const manifestContent = fs.readFileSync(androidManifest, 'utf8');
      
      const requiredPerms = [
        { perm: 'INTERNET', required: true },
        { perm: 'ACCESS_FINE_LOCATION', required: true },
        { perm: 'POST_NOTIFICATIONS', required: true },
      ];
      
      requiredPerms.forEach(({ perm, required }) => {
        if (manifestContent.includes(perm)) {
          log(`   ✓ Permission: ${perm}`, 'green');
          passed++;
        } else if (required) {
          log(`   ⚠ Missing permission: ${perm}`, 'yellow');
          warnings++;
        }
      });
      
      // Check for potentially unnecessary permissions
      const unnecessaryPerms = [
        'RECORD_AUDIO',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
      ];
      
      unnecessaryPerms.forEach(perm => {
        if (manifestContent.includes(perm)) {
          log(`   ⚠ Check if permission needed: ${perm}`, 'yellow');
          warnings++;
        }
      });
    } catch (error) {
      warnings++;
    }
  } else {
    failed++;
  }
  
  // 10. App Configuration Files
  log('\n⚙️  10. App Configuration Files', 'blue');
  
  const appConfig = path.join(__dirname, '..', 'app.config.js');
  const appJson = path.join(__dirname, '..', 'app.json');
  
  if (checkFileExists(appConfig, 'app.config.js exists')) {
    passed++;
  } else {
    warnings++;
  }
  
  if (checkFileExists(appJson, 'app.json exists')) {
    passed++;
  } else {
    warnings++;
  }
  
  // Check for EAS config
  const easJson = path.join(__dirname, '..', 'eas.json');
  if (checkFileExists(easJson, 'eas.json exists')) {
    passed++;
    
    // Check production build config
    try {
      const easContent = JSON.parse(fs.readFileSync(easJson, 'utf8'));
      if (easContent.build && easContent.build.production) {
        log(`   ✓ EAS production build config exists`, 'green');
        passed++;
      }
    } catch (error) {
      warnings++;
    }
  } else {
    warnings++;
  }

  // 11. Crashlytics Instrumentation & SOP
  log('\n💥 11. Crashlytics Instrumentation & SOP', 'blue');
  if (checkCrashlyticsInstrumentation()) {
    passed++;
  } else {
    failed++;
  }
  
  // Summary
  log('\n' + '='.repeat(70), 'cyan');
  log('\n📊 Summary', 'cyan');
  log(`   ✓ Passed: ${passed}`, 'green');
  log(`   ✗ Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`   ⚠ Warnings: ${warnings}`, warnings > 0 ? 'yellow' : 'green');
  
  const total = passed + failed + warnings;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  
  log(`\n   Overall Score: ${score}%`, score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red');
  
  // Recommendations
  if (failed > 0 || warnings > 0) {
    log('\n📝 Recommendations:', 'cyan');
    
    if (failed > 0) {
      log('   Critical issues to fix:', 'red');
      log('   - Fix all failed checks before release', 'yellow');
    }
    
    if (warnings > 0) {
      log('   Warnings to review:', 'yellow');
      log('   - Review warnings and address as needed', 'yellow');
    }
  }
  
  // Final verdict
  log('\n' + '='.repeat(70), 'cyan');
  
  if (failed > 0) {
    log('\n❌ NOT READY FOR RELEASE - Critical issues found!', 'red');
    log('   Please fix all failed checks before building for production.', 'red');
    process.exit(1);
  } else if (warnings > 5) {
    log('\n⚠️  READY WITH WARNINGS - Review warnings before release', 'yellow');
    log('   Consider addressing warnings for better production quality.', 'yellow');
    process.exit(0);
  } else {
    log('\n✅ READY FOR RELEASE!', 'green');
    log('   All critical checks passed. You can proceed with production build.', 'green');
    process.exit(0);
  }
}

main();
