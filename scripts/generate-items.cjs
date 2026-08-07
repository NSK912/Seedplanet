const fs = require('fs');
const path = require('path');

function updateItemScripts() {
  const itemsDir = path.resolve(__dirname, '../public/gamefile/items');
  const indexHtmlPath = path.resolve(__dirname, '../index.html');

  if (!fs.existsSync(itemsDir) || !fs.existsSync(indexHtmlPath)) {
    console.error(`[AutoLoadError] Directory not found: ${itemsDir} or ${indexHtmlPath}`);
    return;
  }

  // Read all .js files in public/js/items, except registry.js
  const files = fs.readdirSync(itemsDir)
    .filter(file => file.endsWith('.js') && file !== 'registry.js')
    .sort();

  const scriptTags = files.map(file => `    <script src="js/items/${file}"></script>`).join('\n');

  let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

  // We want to find the section to replace
  const startMarker = '<!-- ITEMS_AUTO_START -->';
  const endMarker = '<!-- ITEMS_AUTO_END -->';

  if (indexHtml.includes(startMarker) && indexHtml.includes(endMarker)) {
    const startIndex = indexHtml.indexOf(startMarker) + startMarker.length;
    const endIndex = indexHtml.indexOf(endMarker);
    indexHtml = indexHtml.substring(0, startIndex) + '\n' + scriptTags + '\n' + indexHtml.substring(endIndex);
  } else {
    // If markers don't exist yet, replace the existing manual list with the marked version
    const targetPattern = /<script src="js\/items\/registry\.js"><\/script>[\s\S]*?<script src="js\/npc\.js"><\/script>/;
    const replacement = `<script src="js/items/registry.js"></script>\n    <!-- ITEMS_AUTO_START -->\n${scriptTags}\n    <!-- ITEMS_AUTO_END -->\n    <script src="js/npc.js"></script>`;
    indexHtml = indexHtml.replace(targetPattern, replacement);
  }

  fs.writeFileSync(indexHtmlPath, indexHtml, 'utf8');
  console.log(`[AutoLoad] Successfully updated index.html with ${files.length} item scripts.`);
}

updateItemScripts();
