param(
  [string]$Environment = 'dev',
  [string]$Artifact = 'apk',
  [string]$Target = 'all'
)

$projectRoot = (Resolve-Path "$PSScriptRoot\..\").Path
$androidDir = Join-Path $projectRoot 'android'

if (-not (Test-Path $androidDir)) {
  Write-Error "Android directory not found at $androidDir"
  exit 1
}

# Load environment file if ENV_FILE is set
if ($env:ENV_FILE) {
  $envFile = Join-Path $projectRoot $env:ENV_FILE
  if (Test-Path $envFile) {
    Write-Host "📄 Loading environment file: $envFile" -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
      }
    }
  } else {
    Write-Warning "Environment file not found: $envFile"
  }
}

$appName = if ($env:APP_NAME) { $env:APP_NAME } else { 'Tazty Buyer' }
Push-Location $projectRoot
$version = node -p "require('./package.json').version"
Pop-Location

Set-Location $androidDir

$env:APP_ENV = $Environment
$env:BUILD_ARTIFACT = $Artifact
$env:BUILD_TARGET = $Target

$gradleCmd = if ($IsWindows) { '.\gradlew.bat' } else { './gradlew' }
# Use flavor-specific build tasks: devRelease or prodRelease
$flavor = if ($Environment -eq 'prod') { 'Prod' } else { 'Dev' }
$buildTask = if ($Artifact -eq 'bundle') { "bundle${flavor}Release" } else { "assemble${flavor}Release" }

$architectures = if ($Target -eq 'all') { 'arm64-v8a,armeabi-v7a,x86,x86_64' } else { $Target }

Write-Host "🚀 Building Android Release Files..."
Write-Host "📱 App: $appName"
Write-Host "📦 Version: $version"
Write-Host ""
$buildLabel = if ($Artifact -eq 'bundle') { 'AAB' } else { 'APK' }
Write-Host "🔨 Building $buildLabel for $Environment environment..."
Write-Host "📋 Gradle task: $buildTask"

& $gradleCmd $buildTask "-PreactNativeArchitectures=$architectures"

$outputDir = Join-Path $androidDir 'app/build/outputs'
$safeAppName = $appName -replace ' ', '_'
$envSuffix = if ($Environment -eq 'prod') { 'prod' } else { 'dev' }
$apkSrc = Join-Path $outputDir "apk/$envSuffix/release/app-$envSuffix-release.apk"
$apkDest = Join-Path $outputDir "apk/$envSuffix/release/$safeAppName-$version-$envSuffix.apk"
$aabSrc = Join-Path $outputDir "bundle/$envSuffix/release/app-$envSuffix-release.aab"
$aabDest = Join-Path $outputDir "bundle/$envSuffix/release/$safeAppName-$version-$envSuffix.aab"

Write-Host ""
Write-Host "📁 Renaming files..."

if ($Artifact -eq 'apk') {
  if (Test-Path $apkSrc) {
    Copy-Item $apkSrc $apkDest -Force
    Write-Host "✅ APK: $(Split-Path $apkDest -Leaf)"
  } else {
    Write-Warning "APK not found at $apkSrc"
  }
}

if ($Artifact -eq 'bundle') {
  if (Test-Path $aabSrc) {
    Copy-Item $aabSrc $aabDest -Force
    Write-Host "✅ AAB: $(Split-Path $aabDest -Leaf)"
  } else {
    Write-Warning "AAB not found at $aabSrc"
  }
}

Write-Host ""
Write-Host "🎉 Build completed successfully!"
Write-Host "📋 Generated files:"
if ($Artifact -eq 'apk') {
  Write-Host "   APK: android/app/build/outputs/apk/$envSuffix/release/$safeAppName-$version-$envSuffix.apk"
}
if ($Artifact -eq 'bundle') {
  Write-Host "   AAB: android/app/build/outputs/bundle/$envSuffix/release/$safeAppName-$version-$envSuffix.aab"
}
Write-Host ""
Write-Host "📤 Ready for distribution!"
