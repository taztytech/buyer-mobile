# Asset Protection Guide

## NEVER RUN THESE COMMANDS:
```bash
npx rncli prebuild --clean  # DESTROYS all custom assets
npx rncli prebuild          # May regenerate assets
```

## SAFE COMMANDS TO USE:
```bash
# Build and install on device:
npx rncli run:android
npx rncli run:ios

# Start development server:
npx rncli start

# Direct Gradle builds (safest):
cd android && ./gradlew assembleDebug
cd android && ./gradlew assembleRelease
```

## Asset Locations:
- App Icons: `android/app/src/main/res/mipmap-*/ic_launcher*.png`
- Splash Images: `android/app/src/main/res/drawable-*/splashscreen_logo.png`

## If Assets Get Replaced:
1. Delete all .webp files: `find android/app/src/main/res -name "*.webp" -delete`
2. Restore from git: `git checkout HEAD -- android/app/src/main/res/mipmap-*/ android/app/src/main/res/drawable-*/`
3. Or restore from specific commit: `git checkout 7baba28 -- android/app/src/main/res/`

## Protection Measures Enabled:
- ✅ Removed `icon` path from app.json
- ✅ Removed `splash.image` path from app.json
- ✅ Removed `adaptiveIcon.foregroundImage` from app.json
- ✅ This prevents RN CLI from finding source assets to regenerate

## Note:
The app.json no longer references asset paths. All graphics are now managed directly in the android/ios native folders. RN CLI cannot regenerate what it cannot find.
