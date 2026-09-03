import fs from 'fs';
let code = fs.readFileSync('./public/gamefile/gameplay/player.js', 'utf8');
const match = code.match(/function generateCapsule[\s\S]*?return \{ vertices, normals, indices \};\n      \}/);
if (match) console.log(match[0]);
