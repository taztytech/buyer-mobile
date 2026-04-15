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
    Write-Host "[INFO] Loading environment file: $envFile" -ForegroundColor Cyan
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
# Set BABEL_ENV=production for release builds to remove console.log via Babel
# Using BABEL_ENV instead of NODE_ENV to avoid interfering with RN CLI bundling
$env:BABEL_ENV = 'production'

$gradleCmd = if ($IsWindows) { '.\gradlew.bat' } else { './gradlew' }
# Use flavor-specific build tasks: devRelease or prodRelease
$flavor = if ($Environment -eq 'prod') { 'Prod' } else { 'Dev' }
$buildTask = if ($Artifact -eq 'bundle') { "bundle${flavor}Release" } else { "assemble${flavor}Release" }

$architectures = if ($Target -eq 'all') { 'arm64-v8a,armeabi-v7a,x86,x86_64' } else { $Target }

Write-Host "[BUILD] Building Android Release Files..." -ForegroundColor Cyan
Write-Host "[INFO] App: $appName" -ForegroundColor Green
Write-Host "[INFO] Version: $version" -ForegroundColor Green
Write-Host ""
$buildLabel = if ($Artifact -eq 'bundle') { 'AAB' } else { 'APK' }
Write-Host "[BUILD] Building $buildLabel for $Environment environment..." -ForegroundColor Yellow
Write-Host "[INFO] Gradle task: $buildTask" -ForegroundColor Cyan

& $gradleCmd $buildTask "-PreactNativeArchitectures=$architectures"

$outputDir = Join-Path $androidDir 'app/build/outputs'
$safeAppName = $appName -replace ' ', '_'
$envSuffix = if ($Environment -eq 'prod') { 'prod' } else { 'dev' }
$apkSrc = Join-Path $outputDir "apk/$envSuffix/release/app-$envSuffix-release.apk"
$apkDest = Join-Path $outputDir "apk/$envSuffix/release/$safeAppName-$version-$envSuffix.apk"
$aabSrc = Join-Path $outputDir "bundle/$envSuffix/release/app-$envSuffix-release.aab"
$aabDest = Join-Path $outputDir "bundle/$envSuffix/release/$safeAppName-$version-$envSuffix.aab"

Write-Host ""
Write-Host "[INFO] Renaming files..." -ForegroundColor Cyan

if ($Artifact -eq 'apk') {
  if (Test-Path $apkSrc) {
    Copy-Item $apkSrc $apkDest -Force
    Write-Host "[SUCCESS] APK: $(Split-Path $apkDest -Leaf)" -ForegroundColor Green
  } else {
    Write-Warning "APK not found at $apkSrc"
  }
}

if ($Artifact -eq 'bundle') {
  if (Test-Path $aabSrc) {
    Copy-Item $aabSrc $aabDest -Force
    Write-Host "[SUCCESS] AAB: $(Split-Path $aabDest -Leaf)" -ForegroundColor Green
  } else {
    Write-Warning "AAB not found at $aabSrc"
  }
}

Write-Host ""
Write-Host "[SUCCESS] Build completed successfully!" -ForegroundColor Green
Write-Host "[INFO] Generated files:" -ForegroundColor Cyan
if ($Artifact -eq 'apk') {
  Write-Host "   APK: android/app/build/outputs/apk/$envSuffix/release/$safeAppName-$version-$envSuffix.apk"
}
if ($Artifact -eq 'bundle') {
  Write-Host "   AAB: android/app/build/outputs/bundle/$envSuffix/release/$safeAppName-$version-$envSuffix.aab"
}
Write-Host ""
Write-Host "[SUCCESS] Ready for distribution!" -ForegroundColor Green
