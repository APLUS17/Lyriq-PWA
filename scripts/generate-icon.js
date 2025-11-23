import fs from 'fs';
import path from 'path';

// Valid 1x1 red pixel PNG
const base64Icon = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const buffer = Buffer.from(base64Icon, 'base64');
// Write to all 3 files directly to avoid sips if it fails, though sips is better for resizing.
// We'll just write the same 1x1 pixel to all of them for now to unblock. 
// Ideally we'd resize, but for a placeholder this is fine.
// Wait, actually, let's try to write a larger valid PNG if possible, but 1x1 is safe.
// I will write 1x1 to all of them.
fs.writeFileSync(path.join(process.cwd(), 'public', 'icon-512.png'), buffer);
fs.writeFileSync(path.join(process.cwd(), 'public', 'icon-192.png'), buffer);
fs.writeFileSync(path.join(process.cwd(), 'public', 'icon-180.png'), buffer);
console.log('Created placeholder icons');
