import fs from 'fs';
let code = fs.readFileSync('./public/gamefile/Engine/shaders.js', 'utf8');

// Change face UV division from 0.24 to 0.28
code = code.replace(/vec2 uv = vec2\(vLocalPos\.x, vLocalPos\.y - 0\.43\) \/ 0\.24;/g, 'vec2 uv = vec2(vLocalPos.x, vLocalPos.y - 0.43) / 0.35;'); // use larger divisor to match wider face

fs.writeFileSync('./public/gamefile/Engine/shaders.js', code);
console.log("Updated face UV");
