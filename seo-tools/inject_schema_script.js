const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
  const htmlPath = path.join(rootDir, file);
  const baseName = path.basename(file, '.html');
  const schemaFile = path.join(rootDir, `schema-${baseName === 'index' ? 'home' : baseName}.json`);

  if (!fs.existsSync(schemaFile)) return;

  let content = fs.readFileSync(htmlPath, 'utf8');
  if (content.includes('application/ld+json')) return;

  const schemaContent = fs.readFileSync(schemaFile, 'utf8');
  const injected = `<script type="application/ld+json">${schemaContent.trim()}</script>\n`;
  content = content.replace('</body>', `${injected}</body>`);
  fs.writeFileSync(htmlPath, content, 'utf8');
  console.log(`✅ Chèn schema vào: ${file}`);
});
