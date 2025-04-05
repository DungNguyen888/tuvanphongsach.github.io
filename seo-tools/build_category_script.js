const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const contentDir = './category';
const postDir = './posts';
const outputFile = path.join(contentDir, 'index.html');

const defaultImage = '/image/default.jpg';

const getMeta = (html, selector) => {
  const $ = cheerio.load(html);
  return $(selector).attr('content') || '';
};

const getOGImage = ($) => {
  return $('meta[property="og:image"]').attr('content') || $('img').first().attr('src') || defaultImage;
};

const categories = {};

fs.readdirSync(postDir).forEach(file => {
  if (!file.endsWith('.html')) return;
  const filePath = path.join(postDir, file);
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html);

  const category = getMeta(html, 'meta[name="category"]');
  const title = getMeta(html, 'meta[name="title"]') || $('title').text();
  const description = getMeta(html, 'meta[name="description"]') || $('p').first().text();
  const image = getOGImage($);

  if (!categories[category]) categories[category] = [];
  categories[category].push({ title, description, image, file });
});

const buildCategoryIndex = () => {
  let html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Danh mục bài viết - Tư vấn Phòng Sạch</title>
  <meta name="description" content="Danh sách các danh mục bài viết trên tuvanphongsach.com">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Danh mục bài viết",
    "mainEntity": [
      ${Object.entries(categories).map(([cat, posts]) => `{
        "@type": "ItemList",
        "name": "${cat}",
        "itemListElement": [
          ${posts.map((p, i) => `{
            "@type": "ListItem",
            "position": ${i + 1},
            "url": "/posts/${p.file}",
            "name": "${p.title}"
          }`).join(',
')}
        ]
      }`).join(',
')}
    ]
  }
  </script>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <h1>Danh mục bài viết</h1>
  <div class="category-grid">
`;

  Object.entries(categories).forEach(([cat, posts]) => {
    html += `<section class="category-block">
      <h2>${cat}</h2>
      <div class="post-list">
        ${posts.map(p => `
        <a href="/posts/${p.file}" class="post-item">
          <img src="${p.image}" alt="${p.title}">
          <h3>${p.title}</h3>
          <p>${p.description}</p>
        </a>`).join('\n')}
      </div>
    </section>`;
  });

  html += `
  </div>
</body>
</html>`;

  fs.writeFileSync(outputFile, html);
  console.log('✅ Đã tạo category index tại:', outputFile);
};

buildCategoryIndex();
