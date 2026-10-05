import fs from 'node:fs';
import { CBOR } from '../42/formats/data/CBOR.js';
const b = fs.readFileSync('files.cbor');
const index = CBOR.decode(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
fs.writeFileSync('file-index.json', JSON.stringify(index));
console.log(Object.keys(index));
console.log(JSON.stringify(index).slice(0, 1800));
let files = 0, links = 0;
function walk(x) { for (const v of Object.values(x)) { if (v && typeof v === 'object' && !Array.isArray(v)) walk(v); else { files++; if (typeof v === 'string') links++; } } }
walk(index);
console.log({files, links});
