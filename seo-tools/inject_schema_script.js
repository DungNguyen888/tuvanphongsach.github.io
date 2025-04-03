const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');
const outputDir = path.join(rootDir, 'seo-tools/generated');

fs.readdirSync(outputDir).forEach(file => {
  if (file.startsWith('schema-') && file.endsWith('.json')) {
    const htmlName = file.replace('schema-', '').replace('.json', '.html');
    const htmlPath = findHtmlFile(rootDir, htmlName);
    if (htmlPath) {
      const schema = fs.readFileSync(path.join(outputDir, file), 'utf8');
      let html = fs.readFileSync(htmlPath, 'utf8');
      if (!html.includes('application/ld+json')) {
        html = html.replace('</head>', `<script type="application/ld+json">${schema}</script>\n</head>`);
        fs.writeFileSync(htmlPath, html, 'utf8');
        console.log(`✅ Đã chèn Schema vào ${htmlName}`);
      }
    }
  }
});

function findHtmlFile(dir, fileName) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const result = findHtmlFile(filePath, fileName);
      if (result) return result;
    } else if (file === fileName) {
      return filePath;
    }
  }
  return null;
}
