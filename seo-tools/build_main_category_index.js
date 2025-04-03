const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');
const outputFile = path.join(rootDir, 'danh-muc.html');

const categories = [
  { dir: 'ahu', title: 'AHU - Phòng sạch' },
  { dir: 'fcu', title: 'FCU - Thiết bị phòng sạch' },
  { dir: 'chillers', title: 'Chillers - Giải pháp làm lạnh' },
  { dir: 'air-cooled', title: 'Air Cooled - Hệ thống lạnh' },
  { dir: 'tu-van-phong-sach', title: 'Tư vấn phòng sạch' }
];

let content = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Danh mục bài viết - Tuvanphongsach.com</title>
  <meta name="description" content="Tổng hợp các danh mục tư vấn, thiết bị phòng sạch tại Tuvanphongsach.com">
  <link href="/assets/css/style.css" rel="stylesheet">
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <a class="navbar-brand" href="/">Tuvanphongsach.com</a>
    </div>
  </nav>
  <section class="py-5">
    <div class="container">
      <h1 class="mb-4 text-center">Danh mục bài viết</h1>
      <div class="row">`;

categories.forEach(category => {
  const dirPath = path.join(rootDir, category.dir);
  if (!fs.existsSync(dirPath)) return;

  let img = '/image/default.jpg';
  const indexPath = path.join(dirPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    img = (html.match(/<img[^>]*src="([^"]*)"/) || [])[1] || img;
  }

  content += `
        <div class="col-md-4 mb-4">
          <a href="/${category.dir}/" class="text-decoration-none text-dark">
            <div class="card h-100">
              <img src="${img}" class="card-img-top" alt="${category.title}">
              <div class="card-body">
                <h5 class="card-title">${category.title}</h5>
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

fs.writeFileSync(outputFile, content, 'utf8');
console.log('✅ Đã tạo trang danh mục chính: danh-muc.html');
