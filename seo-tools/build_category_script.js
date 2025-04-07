
// seo-tools/build_category_script.js

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const rootDir = path.resolve(__dirname, '../');
const categoriesDir = rootDir;
const outputFileName = 'index.html';

// Lấy danh sách danh mục
function getCategories() {
  return fs.readdirSync(categoriesDir).filter(dir => {
    const fullPath = path.join(categoriesDir, dir);
    return fs.statSync(fullPath).isDirectory() && fs.existsSync(path.join(fullPath, outputFileName));
  });
}

// Lấy thông tin bài viết trong 1 danh mục
function getArticlesInCategory(categoryPath) {
  const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.html') && f !== 'index.html');
  const articles = [];

  files.forEach(file => {
    const filePath = path.join(categoryPath, file);
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim();
    const description = $('meta[name="description"]').attr('content') || $('p').first().text().trim();
    const ogImage = $('meta[property="og:image"]').attr('content');
    const firstImg = $('img').first().attr('src');
    const thumb = ogImage || firstImg || '/image/default.jpg';

    articles.push({
      title,
      description,
      thumb,
      link: './' + file
    });
  });

  return articles;
}

// Tạo HTML danh sách bài viết (3 cột mỗi hàng)
function generateHTML(category, articles) {
  let rows = '';
  for (let i = 0; i < articles.length; i += 3) {
    rows += '<div class="row mb-4">';
    for (let j = i; j < i + 3 && j < articles.length; j++) {
      const { title, description, thumb, link } = articles[j];
      rows += `
<div class="col-md-4">
  <div class="card h-100 shadow-sm">
    <img src="${thumb}" class="card-img-top" alt="${title}">
    <div class="card-body">
      <h5 class="card-title">${title}</h5>
      <p class="card-text">${description}</p>
      <a href="${link}" class="btn btn-primary btn-sm">Xem chi tiết</a>
    </div>
  </div>
</div>
      `;
    }
    rows += '</div>';
  }

  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${category}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Danh mục bài viết về ${category}">
  <link rel="stylesheet" href="/assets/bootstrap/bootstrap.min.css">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div class="container my-5">
    <h1 class="mb-4 text-center">${category}</h1>
    ${rows}
  </div>
</body>
</html>`;
}

// Main
function buildCategoryPages() {
  const categories = getCategories();

  categories.forEach(category => {
    const categoryPath = path.join(categoriesDir, category);
    const articles = getArticlesInCategory(categoryPath);
    if (articles.length === 0) return;

    const html = generateHTML(category, articles);
    const outPath = path.join(categoryPath, outputFileName);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`✅ Đã build danh mục: ${category}/index.html`);
  });
}

buildCategoryPages();
