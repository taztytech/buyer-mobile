#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT=${1:-dev}
ARTIFACT=${2:-apk}
TARGET=${3:-all}

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"

# Load environment file if ENV_FILE is set
if [[ -n "$ENV_FILE" ]]; then
  ENV_FILE_PATH="$PROJECT_ROOT/$ENV_FILE"
  if [[ -f "$ENV_FILE_PATH" ]]; then
    echo "📄 Loading environment file: $ENV_FILE_PATH"
    set -a
    source "$ENV_FILE_PATH"
    set +a
  else
    echo "⚠️  Environment file not found: $ENV_FILE_PATH"
  fi
fi

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

# Use flavor-specific build tasks: devRelease or prodRelease
if [[ "$ENVIRONMENT" == "prod" ]]; then
  FLAVOR="Prod"
else
  FLAVOR="Dev"
fi

if [[ "$ARTIFACT" == "bundle" ]]; then
  BUILD_TASK="bundle${FLAVOR}Release"
else
  BUILD_TASK="assemble${FLAVOR}Release"
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

BUILD_LABEL="APK"
if [[ "$ARTIFACT" == "bundle" ]]; then
  BUILD_LABEL="AAB"
fi
echo "🔨 Building $BUILD_LABEL for $ENVIRONMENT environment..."
echo "📋 Gradle task: $BUILD_TASK"

$GRADLE_CMD "$BUILD_TASK" -PreactNativeArchitectures="$ARCHITECTURES"

OUTPUT_DIR="$ANDROID_DIR/app/build/outputs"
SAFE_APP_NAME=${APP_NAME// /_}
ENV_SUFFIX="$ENVIRONMENT"
APK_SRC="$OUTPUT_DIR/apk/${ENV_SUFFIX}/release/app-${ENV_SUFFIX}-release.apk"
APK_DEST="$OUTPUT_DIR/apk/${ENV_SUFFIX}/release/${SAFE_APP_NAME}-${VERSION}-${ENV_SUFFIX}.apk"
BUNDLE_SRC="$OUTPUT_DIR/bundle/${ENV_SUFFIX}/release/app-${ENV_SUFFIX}-release.aab"
BUNDLE_DEST="$OUTPUT_DIR/bundle/${ENV_SUFFIX}/release/${SAFE_APP_NAME}-${VERSION}-${ENV_SUFFIX}.aab"

echo ""
echo "📁 Renaming files..."

if [[ "$ARTIFACT" == "apk" ]]; then
  if [[ -f "$APK_SRC" ]]; then
    cp "$APK_SRC" "$APK_DEST"
    echo "✅ APK: $(basename "$APK_DEST")"
  else
    echo "⚠️  APK not found at $APK_SRC"
  fi
fi

if [[ "$ARTIFACT" == "bundle" ]]; then
  if [[ -f "$BUNDLE_SRC" ]]; then
    cp "$BUNDLE_SRC" "$BUNDLE_DEST"
    echo "✅ AAB: $(basename "$BUNDLE_DEST")"
  else
    echo "⚠️  AAB not found at $BUNDLE_SRC"
  fi
fi

echo ""
echo "🎉 Build completed successfully!"
echo "📋 Generated files:"
if [[ "$ARTIFACT" == "apk" ]]; then
  echo "   APK: android/app/build/outputs/apk/${ENV_SUFFIX}/release/${SAFE_APP_NAME}-${VERSION}-${ENV_SUFFIX}.apk"
fi
if [[ "$ARTIFACT" == "bundle" ]]; then
  echo "   AAB: android/app/build/outputs/bundle/${ENV_SUFFIX}/release/${SAFE_APP_NAME}-${VERSION}-${ENV_SUFFIX}.aab"
fi
echo ""
echo "📤 Ready for distribution!"
