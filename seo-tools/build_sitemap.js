const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const rootDir = path.resolve(__dirname, '../');
const pagesDir = path.join(rootDir, 'pages');
const BASE_URL = 'https://tuvanphongsach.com';

const STATIC_FILES = ['home.html', 'gioi-thieu.html', 'lien-he.html', 'dich-vu.html'];
const categoryConfigs = [
  { dir: 'ahu', title: 'AHU - Phòng sạch' },
  { dir: 'fcu', title: 'FCU - Thiết bị phòng sạch' },
  { dir: 'chillers', title: 'Chillers - Giải pháp làm lạnh' },
  { dir: 'air-cooled', title: 'Air Cooled - Hệ thống lạnh' },
  { dir: 'tu-van-phong-sach', title: 'Tư vấn phòng sạch' }
];

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function gatherArticles() {
  const articles = [];
  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) return;

    fs.readdirSync(dirPath).forEach(file => {
      if (!file.endsWith('.html') || file === 'index.html') return;
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      articles.push({
        url: `${BASE_URL}/${cfg.dir}/${file}`,
        lastmod: formatDate(stats.mtime),
        image: getImageFromFile(filePath)
      });
    });
  });
  return articles;
}

function getImageFromFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  const img = $('img').first().attr('src') || '/image/default.jpg';
  return img.startsWith('/') ? `${BASE_URL}${img}` : `${BASE_URL}/${img}`;
}

function generateSitemap() {
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Trang tĩnh
  STATIC_FILES.forEach(file => {
    const outName = file === 'home.html' ? 'index.html' : file;
    const filePath = path.join(rootDir, outName);
    if (!fs.existsSync(filePath)) return;

    const stats = fs.statSync(filePath);
    const url = file === 'home.html' ? BASE_URL + '/' : `${BASE_URL}/${file}`;
    const priority = file === 'home.html' ? '1.0' : '0.8';
    const changefreq = file === 'home.html' ? 'daily' : 'weekly';

    sitemap += `  <url>\n`;
    sitemap += `    <loc>${url}</loc>\n`;
    sitemap += `    <lastmod>${formatDate(stats.mtime)}</lastmod>\n`;
    sitemap += `    <changefreq>${changefreq}</changefreq>\n`;
    sitemap += `    <priority>${priority}</priority>\n`;
    sitemap += `  </url>\n`;
  });

  // Trang danh mục chính
  const mainCategoryFile = path.join(rootDir, 'danh-muc.html');
  if (fs.existsSync(mainCategoryFile)) {
    const stats = fs.statSync(mainCategoryFile);
    sitemap += `  <url>\n`;
    sitemap += `    <loc>${BASE_URL}/danh-muc.html</loc>\n`;
    sitemap += `    <lastmod>${formatDate(stats.mtime)}</lastmod>\n`;
    sitemap += `    <changefreq>weekly</changefreq>\n`;
    sitemap += `    <priority>0.9</priority>\n`;
    sitemap += `  </url>\n`;
  }

  // Trang danh mục
  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir, 'index.html');
    if (!fs.existsSync(dirPath)) return;

    const stats = fs.statSync(dirPath);
    sitemap += `  <url>\n`;
    sitemap += `    <loc>${BASE_URL}/${cfg.dir}/</loc>\n`;
    sitemap += `    <lastmod>${formatDate(stats.mtime)}</lastmod>\n`;
    sitemap += `    <changefreq>weekly</changefreq>\n`;
    sitemap += `    <priority>0.9</priority>\n`;
    if (cfg.dir === 'ahu') {
      sitemap += `    <image:image>\n`;
      sitemap += `      <image:loc>${BASE_URL}/image/ahu/tu-van-phong-sach-small.webp</image:loc>\n`;
      sitemap += `      <image:title>Hình ảnh AHU Phòng Sạch</image:title>\n`;
      sitemap += `    </image:image>\n`;
    }
    sitemap += `  </url>\n`;
  });

  // Bài viết chi tiết
  const articles = gatherArticles();
  articles.forEach(article => {
    sitemap += `  <url>\n`;
    sitemap += `    <loc>${article.url}</loc>\n`;
    sitemap += `    <lastmod>${article.lastmod}</lastmod>\n`;
    sitemap += `    <changefreq>weekly</changefreq>\n`;
    sitemap += `    <priority>0.8</priority>\n`;
    sitemap += `    <image:image>\n`;
    sitemap += `      <image:loc>${article.image}</image:loc>\n`;
    sitemap += `      <image:title>Hình ảnh bài viết phòng sạch</image:title>\n`;
    sitemap += `    </image:image>\n`;
    sitemap += `  </url>\n`;
  });

  sitemap += `</urlset>`;

  const outPath = path.join(rootDir, 'sitemap.xml');
  fs.writeFileSync(outPath, sitemap, 'utf8');
  console.log('✅ Tạo sitemap.xml thành công');
}

module.exports = { generateSitemap };