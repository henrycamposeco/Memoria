import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'src', 'dashboard', 'public');
const distDir = path.join(process.cwd(), 'dist', 'dashboard', 'public');
const rootAssetsDir = path.join(process.cwd(), 'assets');
const distAssetsDir = path.join(process.cwd(), 'dist', 'assets');

function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Copying assets to dist...');

if (fs.existsSync(srcDir)) {
    copyDir(srcDir, distDir);
    console.log('Dashboard public assets copied.');
}

if (fs.existsSync(rootAssetsDir)) {
    copyDir(rootAssetsDir, distAssetsDir);
    console.log('Global assets copied to dist.');
}
