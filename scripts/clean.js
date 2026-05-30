const fs = require('fs');
const path = require('path');

const targets = ['release-builds', 'dist'];

for (const target of targets) {
  const targetPath = path.join(__dirname, '..', target);
  fs.rmSync(targetPath, { recursive: true, force: true });
}

console.log(`Cleaned: ${targets.join(', ')}`);
