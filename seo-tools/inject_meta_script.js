const fs = require('fs');
const path = require('path');

const metaTags = `
  <link rel="manifest" href="manifest.json">
  <link rel="icon" href="image/favicon-32.png" sizes="32x32">
  <link rel="icon" href="image/favicon-192.png" sizes="192x192">`;

const rootDir = path.resolve(__dirname, '../');
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
  const htmlPath = path.join(rootDir, file);
  let content = fs.readFileSync(htmlPath, 'utf8');
  if (content.includes('rel="manifest"')) return;

  content = content.replace('</head>', `${metaTags}\n</head>`);
  fs.writeFileSync(htmlPath, content, 'utf8');
  console.log(`✅ Chèn manifest & favicon: ${file}`);
});
