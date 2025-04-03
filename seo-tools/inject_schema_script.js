const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');
const outputDir = path.join(rootDir, 'seo-tools/generated');

function injectSchema(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      injectSchema(filePath);
    } else if (file.endsWith('.html')) {
      const html = fs.readFileSync(filePath, 'utf8');
      const schemaFileName = `schema-${filePath.replace(rootDir, '').replace(/\//g, '-').replace('.html', '')}.json`;
      const schemaFilePath = path.join(outputDir, schemaFileName);

      if (fs.existsSync(schemaFilePath) && !html.includes('application/ld+json')) {
        const schema = fs.readFileSync(schemaFilePath, 'utf8');
        const newHtml = html.replace('</head>', `<script type="application/ld+json">${schema}</script>\n</head>`);
        fs.writeFileSync(filePath, newHtml, 'utf8');
        console.log(`✅ Đã chèn Schema vào ${filePath.replace(rootDir, '')}`);
      }
    }
  });
}

injectSchema(rootDir);
console.log('🎯 Hoàn tất inject schema!');
