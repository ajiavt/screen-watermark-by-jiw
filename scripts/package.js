const path = require('path');
const packager = require('@electron/packager');

function getArg(name) {
  const prefix = `--${name}=`;
  const entry = process.argv.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function normalizePlatform(platform) {
  if (!platform) return process.platform;
  if (platform === 'mac' || platform === 'macos') return 'darwin';
  if (platform === 'windows') return 'win32';
  return platform;
}

async function main() {
  const out = getArg('out') || 'release-builds';
  const platform = normalizePlatform(getArg('platform'));
  const arch = getArg('arch') || process.arch;
  const name = getArg('name') || 'screen-watermark';

  const appDir = path.resolve(__dirname, '..');

  // Some Node/lib combinations can end the process early if downstream libraries
  // don't hold a strong event-loop handle during long async work. Keep a small
  // timer alive until packaging finishes.
  const keepAlive = setInterval(() => {}, 1000);

  const appPaths = await packager({
    dir: appDir,
    out,
    name,
    overwrite: true,
    prune: true,
    platform,
    arch,
  });

  clearInterval(keepAlive);

  for (const appPath of appPaths) {
    console.log(`Packaged: ${appPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
