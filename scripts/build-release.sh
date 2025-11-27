#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${1:-dev}
ARTIFACT=${2:-apk}
TARGET=${3:-all}

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"

APP_NAME=${APP_NAME:-"Tazty Buyer"}
VERSION=$(cd "$PROJECT_ROOT" && node -p "require('./package.json').version")

if [[ ! -d "$ANDROID_DIR" ]]; then
  echo "Android directory not found at $ANDROID_DIR"
  exit 1
fi

cd "$ANDROID_DIR"

export APP_ENV="$ENVIRONMENT"
export BUILD_ARTIFACT="$ARTIFACT"
export BUILD_TARGET="$TARGET"

GRADLE_CMD="./gradlew"
if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == CYGWIN* ]]; then
  GRADLE_CMD="gradlew.bat"
fi

if [[ "$ARTIFACT" == "bundle" ]]; then
  BUILD_TASK="bundleRelease"
else
  BUILD_TASK="assembleRelease"
fi

if [[ "$TARGET" == "all" ]]; then
  ARCHITECTURES="arm64-v8a,armeabi-v7a,x86,x86_64"
else
  ARCHITECTURES="$TARGET"
fi

echo "🚀 Building Android Release Files..."
echo "📱 App: $APP_NAME"
echo "📦 Version: $VERSION"
echo ""

if [[ "$BUILD_TASK" == "assembleRelease" ]]; then
  echo "🔨 Building APK..."
else
  echo "🔨 Building AAB..."
fi

$GRADLE_CMD "$BUILD_TASK" -PreactNativeArchitectures="$ARCHITECTURES"

OUTPUT_DIR="$ANDROID_DIR/app/build/outputs"
SAFE_APP_NAME=${APP_NAME// /_}
APK_SRC="$OUTPUT_DIR/apk/release/app-release.apk"
APK_DEST="$OUTPUT_DIR/apk/release/${SAFE_APP_NAME}-${VERSION}.apk"
BUNDLE_SRC="$OUTPUT_DIR/bundle/release/app-release.aab"
BUNDLE_DEST="$OUTPUT_DIR/bundle/release/${SAFE_APP_NAME}-${VERSION}.aab"

echo ""
echo "📁 Renaming files..."

if [[ "$BUILD_TASK" == "assembleRelease" && -f "$APK_SRC" ]]; then
  cp "$APK_SRC" "$APK_DEST"
  echo "✅ APK: $(basename "$APK_DEST")"
elif [[ "$BUILD_TASK" == "assembleRelease" ]]; then
  echo "⚠️ APK not found at $APK_SRC"
fi

if [[ "$BUILD_TASK" == "bundleRelease" && -f "$BUNDLE_SRC" ]]; then
  cp "$BUNDLE_SRC" "$BUNDLE_DEST"
  echo "✅ AAB: $(basename "$BUNDLE_DEST")"
elif [[ "$BUILD_TASK" == "bundleRelease" ]]; then
  echo "⚠️ AAB not found at $BUNDLE_SRC"
fi

echo ""
echo "🎉 Build completed successfully!"
echo "📋 Generated files:"
if [[ "$BUILD_TASK" == "assembleRelease" ]]; then
  echo "   APK: android/app/build/outputs/apk/release/${SAFE_APP_NAME}-${VERSION}.apk"
fi
if [[ "$BUILD_TASK" == "bundleRelease" ]]; then
  echo "   AAB: android/app/build/outputs/bundle/release/${SAFE_APP_NAME}-${VERSION}.aab"
fi
echo ""
echo "📤 Ready for distribution!"
