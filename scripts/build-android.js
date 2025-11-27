const { spawnSync } = require('child_process');
const path = require('path');

const [env = 'dev', artifact = 'apk', target = 'all'] = process.argv.slice(2);

const isWindows = process.platform === 'win32';
const scriptName = isWindows ? 'build-release.ps1' : 'build-release.sh';
const buildScriptPath = path.resolve(__dirname, scriptName);

const command = isWindows ? 'powershell.exe' : buildScriptPath;
const args = isWindows
  ? ['-ExecutionPolicy', 'Bypass', '-File', buildScriptPath, env, artifact, target]
  : [env, artifact, target];

const result = spawnSync(command, isWindows ? args : args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    APP_ENV: env,
    BUILD_ARTIFACT: artifact,
    BUILD_TARGET: target,
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
