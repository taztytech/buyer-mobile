const { spawnSync } = require('child_process');
const path = require('path');

const [env = 'dev', artifact = 'apk', target = 'all'] = process.argv.slice(2);

// Set ENV_FILE based on environment
const envFile = env === 'prod' ? '.env.prod' : '.env.dev';

// Auto-bump versionCode for all production builds (APK and bundle)
const isProductionBuild = env === 'prod';

if (isProductionBuild) {
  const buildType = artifact === 'bundle' ? 'Play Store (AAB)' : 'Production (APK)';
  console.log(`📦 ${buildType} build detected - bumping versionCode...`);
  const bumpScript = path.resolve(__dirname, 'bump-android-version.js');
  const bumpResult = spawnSync('node', [bumpScript, 'code-only'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
  
  if (bumpResult.error) {
    console.error('❌ Failed to bump versionCode:', bumpResult.error.message);
    process.exit(1);
  }
  
  if (bumpResult.status !== 0) {
    console.error('❌ Version bump failed');
    process.exit(1);
  }
  
  console.log('');
}

const isWindows = process.platform === 'win32';
const scriptName = isWindows ? 'build-release.ps1' : 'build-release.sh';
const buildScriptPath = path.resolve(__dirname, scriptName);

const command = isWindows ? 'powershell.exe' : buildScriptPath;
const args = isWindows
  ? ['-ExecutionPolicy', 'Bypass', '-File', buildScriptPath, env, artifact, target]
  : [env, artifact, target];

console.log(`🔧 Building for environment: ${env}`);
console.log(`📄 Loading environment file: ${envFile}`);

const result = spawnSync(command, isWindows ? args : args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    ENV_FILE: envFile,
    APP_ENV: env,
    BUILD_ARTIFACT: artifact,
    BUILD_TARGET: target,
    // Set BABEL_ENV=production for release builds to remove console.log via Babel
    // Using BABEL_ENV instead of NODE_ENV to avoid interfering with RN CLI bundling
    BABEL_ENV: 'production',
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
