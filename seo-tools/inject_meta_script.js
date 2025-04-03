const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');

function scanAndInjectMeta(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanAndInjectMeta(filePath);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(filePath, 'utf8');

      // Nếu chưa có meta charset, description, viewport → chèn
      if (!html.includes('name="viewport"')) {
        const metaTags = `
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Tuvanphongsach.com - Giải pháp phòng sạch chuyên nghiệp">`;
        html = html.replace('<head>', `<head>${metaTags}`);
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`✅ Đã chèn meta description & viewport vào ${file}`);
      }
    }
  });
}

scanAndInjectMeta(rootDir);
