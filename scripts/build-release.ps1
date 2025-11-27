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

$appName = if ($env:APP_NAME) { $env:APP_NAME } else { 'Tazty Buyer' }
Push-Location $projectRoot
$version = node -p "require('./package.json').version"
Pop-Location

Set-Location $androidDir

$env:APP_ENV = $Environment
$env:BUILD_ARTIFACT = $Artifact
$env:BUILD_TARGET = $Target

$gradleCmd = if ($IsWindows) { '.\gradlew.bat' } else { './gradlew' }
$buildTask = if ($Artifact -eq 'bundle') { 'bundleRelease' } else { 'assembleRelease' }

$architectures = if ($Target -eq 'all') { 'arm64-v8a,armeabi-v7a,x86,x86_64' } else { $Target }

Write-Host "🚀 Building Android Release Files..."
Write-Host "📱 App: $appName"
Write-Host "📦 Version: $version"
Write-Host ""
$buildLabel = if ($buildTask -eq 'assembleRelease') { 'APK' } else { 'AAB' }
Write-Host "🔨 Building $buildLabel..."

& $gradleCmd $buildTask "-PreactNativeArchitectures=$architectures"

$outputDir = Join-Path $androidDir 'app/build/outputs'
$safeAppName = $appName -replace ' ', '_'
$apkSrc = Join-Path $outputDir 'apk/release/app-release.apk'
$apkDest = Join-Path $outputDir "apk/release/$safeAppName-$version.apk"
$aabSrc = Join-Path $outputDir 'bundle/release/app-release.aab'
$aabDest = Join-Path $outputDir "bundle/release/$safeAppName-$version.aab"

Write-Host ""
Write-Host "📁 Renaming files..."

if ($buildTask -eq 'assembleRelease') {
  if (Test-Path $apkSrc) {
    Copy-Item $apkSrc $apkDest -Force
    Write-Host "✅ APK: $(Split-Path $apkDest -Leaf)"
  } else {
    Write-Warning "APK not found at $apkSrc"
  }
}

if ($buildTask -eq 'bundleRelease') {
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
if ($buildTask -eq 'assembleRelease') {
  Write-Host "   APK: android/app/build/outputs/apk/release/$safeAppName-$version.apk"
}
if ($buildTask -eq 'bundleRelease') {
  Write-Host "   AAB: android/app/build/outputs/bundle/release/$safeAppName-$version.aab"
}
Write-Host ""
Write-Host "📤 Ready for distribution!"
