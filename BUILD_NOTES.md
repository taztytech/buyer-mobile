# Build Notes - IMPORTANT

## ⚠️ CRITICAL: DO NOT REPLACE CUSTOM ASSETS

### Custom Assets That Must Be Preserved

The following custom assets have been manually created and configured. **DO NOT RUN `npx expo prebuild` or any command that regenerates these assets**, as it will replace them with auto-generated versions.

#### Android Assets (DO NOT TOUCH)

**App Icons:**
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png`
- `android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png`
- `android/app/src/main/res/mipmap-hdpi/ic_launcher_background.png`
- `android/app/src/main/res/mipmap-hdpi/ic_launcher_monochrome.png`
- `android/app/src/main/res/mipmap-mdpi/ic_launcher*.png` (all variants)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher*.png` (all variants)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher*.png` (all variants)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher*.png` (all variants)

**Splash Screen Logos:**
- `android/app/src/main/res/drawable-hdpi/splashscreen_logo.png`
- `android/app/src/main/res/drawable-mdpi/splashscreen_logo.png`
- `android/app/src/main/res/drawable-xhdpi/splashscreen_logo.png`
- `android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png`
- `android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png`

#### iOS Assets (DO NOT TOUCH)

**App Icons:**
- `ios/Tazty/Images.xcassets/AppIcon.appiconset/*`

**Splash Screen:**
- `ios/Tazty/Images.xcassets/SplashScreenLegacy.imageset/*`
- `ios/Tazty/SplashScreen.storyboard`

---

## Building the App

### Android APK Build

```bash
# Clean build
cd android
./gradlew clean
./gradlew assembleRelease

# Output location:
# android/app/build/outputs/apk/release/app-release.apk
```

### Android AAB Build (for Google Play)

```bash
cd android
./gradlew bundleRelease

# Output location:
# android/app/build/outputs/bundle/release/app-release.aab
```

### iOS Build

```bash
# Open in Xcode
open ios/Tazty.xcworkspace

# Build from Xcode:
# 1. Select "Tazty" scheme
# 2. Select "Any iOS Device" or a specific device
# 3. Product > Archive
# 4. Follow App Store submission steps
```

### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure
eas build:configure

# Build for Android
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

---

## ⚠️ What NOT to Do

### NEVER run these commands (they will replace custom assets):

```bash
# ❌ DON'T RUN THESE:
npx expo prebuild
npx expo prebuild --clean
expo prebuild
```

These commands regenerate native folders based on `app.json` and will **overwrite all custom assets**.

---

## If Assets Get Replaced Accidentally

### Restore from Git

If assets were accidentally replaced, restore them from commit `dfe78ff` (the commit where custom assets were originally added):

```bash
# Restore Android assets
git checkout dfe78ff -- android/app/src/main/res/mipmap-hdpi/
git checkout dfe78ff -- android/app/src/main/res/mipmap-mdpi/
git checkout dfe78ff -- android/app/src/main/res/mipmap-xhdpi/
git checkout dfe78ff -- android/app/src/main/res/mipmap-xxhdpi/
git checkout dfe78ff -- android/app/src/main/res/mipmap-xxxhdpi/
git checkout dfe78ff -- android/app/src/main/res/drawable-hdpi/splashscreen_logo.png
git checkout dfe78ff -- android/app/src/main/res/drawable-mdpi/splashscreen_logo.png
git checkout dfe78ff -- android/app/src/main/res/drawable-xhdpi/splashscreen_logo.png
git checkout dfe78ff -- android/app/src/main/res/drawable-xxhdpi/splashscreen_logo.png
git checkout dfe78ff -- android/app/src/main/res/drawable-xxxhdpi/splashscreen_logo.png

# Check what was restored
git status
```

---

## Asset Backup Location

Original custom assets are preserved in git commit: **`dfe78ff`**

To view original assets:
```bash
git show dfe78ff:android/app/src/main/res/mipmap-hdpi/ic_launcher.png
```

---

## Pre-Build Checklist

Before creating a production build:

- [ ] Verify custom app icons are in place (check file sizes/dates)
- [ ] Verify splash screen logos are in place
- [ ] Test splash screen on device/emulator
- [ ] Test app icon on device/emulator
- [ ] Increment version in `app.json`
- [ ] Update version code/build number
- [ ] Run `git status` to ensure no asset files were modified
- [ ] Clean build folders: `cd android && ./gradlew clean`

---

## Version Management

Update these before each build:

### app.json
```json
{
  "expo": {
    "version": "1.0.0",  // Update this
    "android": {
      "versionCode": 1    // Increment this for each Android build
    },
    "ios": {
      "buildNumber": "1"  // Increment this for each iOS build
    }
  }
}
```

### Android (android/app/build.gradle)
```gradle
android {
    defaultConfig {
        versionCode 1        // Increment for each release
        versionName "1.0.0"  // Update for version changes
    }
}
```

---

## Troubleshooting

### Issue: Build fails with missing resources

**Solution:** Assets may have been deleted. Restore from git (see above).

### Issue: Wrong app icon appears

**Solution:**
1. Check if assets were replaced
2. Restore from git if needed
3. Clean build: `cd android && ./gradlew clean`
4. Rebuild

### Issue: Splash screen looks wrong

**Solution:**
1. Verify `splashscreen_logo.png` files in all drawable folders
2. Check `SplashScreen.storyboard` (iOS)
3. Restore from git if needed

---

## Contact

If you're unsure about any build step or if assets get corrupted, refer to this document first before making changes.

**Last Updated:** January 2025
**Original Assets Commit:** `dfe78ff`
