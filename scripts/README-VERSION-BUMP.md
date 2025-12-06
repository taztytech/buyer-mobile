# Version Auto-Bump Scripts

Automatically increment version numbers for Android and iOS before production builds.

## Quick Start

```bash
# Bump both Android and iOS versions (patch)
npm run version:bump

# Bump patch version (1.0.0 → 1.0.1)
npm run version:bump:patch

# Bump minor version (1.0.0 → 1.1.0)
npm run version:bump:minor

# Bump major version (1.0.0 → 2.0.0)
npm run version:bump:major
```

## Individual Platform Bumping

```bash
# Android only
npm run version:bump:android

# iOS only
npm run version:bump:ios
```

## Direct Script Usage

```bash
# Bump both platforms
node scripts/bump-version.js [patch|minor|major]

# Android only
node scripts/bump-android-version.js [patch|minor|major]

# iOS only
node scripts/bump-ios-version.js [patch|minor|major]
```

## What Gets Updated

### Android
- ✅ `versionCode` - Always incremented by 1 (required for Play Store)
- ✅ `versionName` - Updated based on bump type (patch/minor/major)
- ✅ `package.json` version - Synced with versionName

**File:** `android/app/build.gradle`

### iOS
- ✅ `CFBundleVersion` (Build Number) - Always incremented by 1 (required for App Store)
- ✅ `CFBundleShortVersionString` (Version) - Updated based on bump type
- ✅ `package.json` version - Synced with version

**Files:** 
- `ios/[AppName].xcodeproj/project.pbxproj`
- `ios/[AppName]/Info.plist` (if exists)

## Version Bump Types

### Patch (Default)
- Version: `1.0.0` → `1.0.1`
- Use for: Bug fixes, small changes
- Command: `npm run version:bump:patch`

### Minor
- Version: `1.0.0` → `1.1.0`
- Use for: New features, backward compatible
- Command: `npm run version:bump:minor`

### Major
- Version: `1.0.0` → `2.0.0`
- Use for: Breaking changes, major updates
- Command: `npm run version:bump:major`

## Integration with Build Process

### Automated Release Builds

```bash
# Android: Bump version + Build AAB
npm run release:android

# iOS: Bump version + Build IPA
npm run release:ios
```

### Manual Workflow

```bash
# 1. Bump versions
npm run version:bump:patch

# 2. Build Android
npm run build:android:all:bundle:prod

# 3. Build iOS
npm run build:ios
```

## Examples

### Example 1: Patch Release
```bash
# Current: versionCode 5, versionName "1.0.0"
npm run version:bump:patch

# Result: versionCode 6, versionName "1.0.1"
```

### Example 2: Minor Release
```bash
# Current: versionCode 10, versionName "1.0.5"
npm run version:bump:minor

# Result: versionCode 11, versionName "1.1.0"
```

### Example 3: Major Release
```bash
# Current: versionCode 25, versionName "1.5.2"
npm run version:bump:major

# Result: versionCode 26, versionName "2.0.0"
```

## Requirements

- Node.js installed
- For iOS: Xcode and `agvtool` (included with Xcode Command Line Tools)
- Android project must exist (`android/app/build.gradle`)
- iOS project must exist (run `npx expo prebuild` first if needed)

## Troubleshooting

### Error: "build.gradle not found"
- Ensure you've run `npx expo prebuild` to generate Android folder
- Check that `android/app/build.gradle` exists

### Error: "iOS project not found"
- Run `npx expo prebuild` to generate iOS folder
- Ensure `ios/[AppName].xcodeproj` exists

### Error: "agvtool: command not found" (iOS)
- Install Xcode Command Line Tools: `xcode-select --install`
- The script will fall back to manual file editing if agvtool is unavailable

### Version not syncing
- Check that `package.json` version matches your intended version
- Verify build.gradle and Info.plist were updated correctly
- Re-run the bump script if needed

## Notes

- ⚠️ **Always commit version changes** before building
- ⚠️ **Version codes must always increase** - Play Store and App Store enforce this
- ✅ Scripts are idempotent - safe to run multiple times
- ✅ Scripts update `package.json` automatically for consistency
