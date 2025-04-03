const fs = require('fs');
const path = require('path');

// Thư mục web gốc (chứa index.html, contact.html...)
const rootDir = path.resolve(__dirname, '../');

// Lấy danh sách file HTML
const htmlFiles = fs.readdirSync(rootDir).filter(file => file.endsWith('.html'));

htmlFiles.forEach(file => {
  const htmlPath = path.join(rootDir, file);
  const baseName = path.basename(file, '.html');
  const schemaFile = path.join(rootDir, `schema-${baseName}.json`);

  // Kiểm tra schema tương ứng
  if (!fs.existsSync(schemaFile)) {
    console.log(`⚠️  Không tìm thấy schema cho ${file}`);
    return;
  }

  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  // Nếu đã có Schema thì bỏ qua
  if (htmlContent.includes('application/ld+json')) {
    console.log(`✅ ${file} đã có Schema`);
    return;
  }

  const schemaContent = fs.readFileSync(schemaFile, 'utf8');

  const injectedSchema = `
  <script type="application/ld+json">
  ${schemaContent.trim()}
  </script>\n`;

  // Chèn trước </body>
  const updatedHtml = htmlContent.replace('</body>', `${injectedSchema}</body>`);
  fs.writeFileSync(htmlPath, updatedHtml, 'utf8');

  console.log(`✅ Đã chèn schema vào: ${file}`);
});

console.log('\n🎉 Hoàn tất chèn Schema cho tất cả file HTML!');
