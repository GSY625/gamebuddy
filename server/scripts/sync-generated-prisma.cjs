const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'src', 'generated', 'prisma');
const targetDir = path.join(__dirname, '..', 'dist', 'generated', 'prisma');

if (!fs.existsSync(sourceDir)) {
  console.warn(`[sync-generated-prisma] skipped: source not found at ${sourceDir}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });

console.log(`[sync-generated-prisma] copied Prisma client to ${targetDir}`);
