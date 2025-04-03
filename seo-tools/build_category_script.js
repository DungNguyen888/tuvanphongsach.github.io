const fs = require('fs');
const path = require('path');

const categoryDirs = [
  { dir: 'ahu', title: 'AHU - Phòng sạch' },
  { dir: 'fcu', title: 'FCU - Thiết bị phòng sạch' },
  { dir: 'chillers', title: 'Chillers - Giải pháp làm lạnh' },
  { dir: 'air-cooled', title: 'Air Cooled - Hệ thống lạnh' },
  { dir: 'tu-van-phong-sach', title: 'Tư vấn phòng sạch' }
];

const rootDir = path.resolve(__dirname, '../');

categoryDirs.forEach(category => {
  const dirPath = path.join(rootDir, category.dir);
  if (!fs.existsSync(dirPath)) return;

  let content = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${category.title}</title>
  <meta name="description" content="Danh mục ${category.title} - Tuvanphongsach.com">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <a class="navbar-brand" href="/">Tuvanphongsach.com</a>
    </div>
  </nav>
  <section class="py-5">
    <div class="container">
      <h1 class="mb-4 text-center">${category.title}</h1>
      <div class="row">`;

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html') && f !== 'index.html');

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    let html = fs.readFileSync(filePath, 'utf8');

    const title = (html.match(/<title>(.*?)<\/title>/) || [])[1] || file;
    const desc = (html.match(/<meta name="description" content="(.*?)"/) || [])[1] || '';
    let img = (html.match(/<meta property="og:image" content="(.*?)"/) || [])[1];

    if (!img) {
      img = (html.match(/<img[^>]*src="([^"]*)"/) || [])[1];
    }

    if (!img) {
      console.warn(`⚠️ Bài viết thiếu hình ảnh: ${filePath}`);
      img = '/image/default.jpg'; // fallback
    }

    content += `
        <div class="col-md-4 mb-4">
          <a href="./${file}" class="text-decoration-none text-dark">
            <div class="card h-100">
              <img src="${img}" class="card-img-top" alt="${title}">
              <div class="card-body">
                <h5 class="card-title">${title}</h5>
                <p class="card-text">${desc}</p>
              </div>
            </div>
          </a>
        </div>`;
  });

  content += `
      </div>
    </div>
  </section>
  <footer class="text-center mt-4">
    <div class="container py-3">
      &copy; 2025 Tuvanphongsach.com - Chuyên gia giải pháp phòng sạch
    </div>
  </footer>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(dirPath, 'index.html'), content, 'utf8');
  console.log(`✅ Đã tạo danh mục: ${category.dir}/index.html`);
});

console.log('\n🎯 Hoàn tất build danh mục!');
