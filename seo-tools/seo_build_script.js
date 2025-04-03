const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');
const outputDir = path.join(rootDir, 'seo-tools/generated');

// Tạo thư mục output nếu chưa có
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

let sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
let robots = `User-agent: *\nAllow: /\nSitemap: https://tuvanphongsach.com/sitemap.xml\n`;

const htmlFiles = [];

function scanFolder(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanFolder(filePath);
    } else if (file.endsWith('.html')) {
      const relativePath = filePath.replace(rootDir, '').replace(/\\/g, '/');
      htmlFiles.push({ path: relativePath, fullPath: filePath });
    }
  });
}

scanFolder(rootDir);

// Tạo schema & sitemap
htmlFiles.forEach(file => {
  const url = file.path.replace('/index.html', '/');
  const htmlContent = fs.readFileSync(file.fullPath, 'utf8');

  const title = (htmlContent.match(/<title>(.*?)<\/title>/) || [])[1] || 'Trang';
  const priority = url === '/' ? 1.0 : 0.8;

  // Schema
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "url": `https://tuvanphongsach.com${url}`
  };

  const schemaFileName = `schema-${file.path.replace(/\//g, '-').replace('.html', '')}.json`;
  const schemaFilePath = path.join(outputDir, schemaFileName);
  fs.writeFileSync(schemaFilePath, JSON.stringify(schema, null, 2), 'utf8');

  // Sitemap
  sitemap += `<url><loc>https://tuvanphongsach.com${url}</loc><priority>${priority}</priority></url>\n`;
});

sitemap += '</urlset>';
fs.writeFileSync(path.join(rootDir, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(rootDir, 'robots.txt'), robots, 'utf8');

console.log('✅ Đã tạo sitemap.xml, robots.txt và schema đầy đủ cho toàn bộ site');
