const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');

function scanAndInject(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      scanAndInject(filePath);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(filePath, 'utf8');

      // Kiểm tra đã có og:image chưa
      if (!html.includes('property="og:image"')) {
        // Tìm ảnh đầu tiên
        let img = (html.match(/<meta property="og:image" content="(.*?)"/) || [])[1];
        if (!img) {
          img = (html.match(/<img[^>]*src="([^"]*)"/) || [])[1] || '/image/default.jpg';
        }

        const title = (html.match(/<title>(.*?)<\/title>/) || [])[1] || 'Tuvanphongsach.com';
        const description = (html.match(/<meta name="description" content="(.*?)"/) || [])[1] || '';

        const ogTags = `
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="https://tuvanphongsach.com${filePath.replace(rootDir, '').replace(/\\/g, '/')}">`;

        html = html.replace('</head>', `${ogTags}\n</head>`);
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`✅ Đã chèn OpenGraph vào ${file}`);
      }
    }
  });
}

scanAndInject(rootDir);
