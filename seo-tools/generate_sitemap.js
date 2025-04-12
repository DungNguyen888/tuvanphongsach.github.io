const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../');
const BASE_URL = 'https://tuvanphongsach.com';

const STATIC_FILES = ['home.html', 'gioi-thieu.html', 'lien-he.html', 'dich-vu.html'];
const EXCLUDED_FILES = ['asdfghjklpoiuytrewq.html']; // Các trang không muốn đưa vào sitemap

const categoryConfigs = [
  { dir: 'ahu', title: 'AHU - Phòng sạch' },
  { dir: 'fcu', title: 'FCU - Thiết bị phòng sạch' },
  { dir: 'chillers', title: 'Chillers - Giải pháp làm lạnh' },
  { dir: 'air-cooled', title: 'Air Cooled - Hệ thống lạnh' },
  { dir: 'tu-van-phong-sach', title: 'Tư vấn phòng sạch' }
];

const mainCategoryFile = path.join(rootDir, 'danh-muc.html');

function generateSitemap() {
  // Khởi tạo XML cho sitemap
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Hàm thêm URL vào sitemap
  const addUrl = (loc, lastmod, changefreq, priority) => {
    // Kiểm tra xem URL có chứa file bị loại trừ hay không
    if (EXCLUDED_FILES.some(excluded => loc.includes(excluded))) {
      console.log(`Skipped URL in sitemap: ${loc}`);
      return;
    }
    sitemap += '  <url>\n';
    sitemap += `    <loc>${loc}</loc>\n`;
    if (lastmod) sitemap += `    <lastmod>${lastmod}</lastmod>\n`;
    sitemap += `    <changefreq>${changefreq}</changefreq>\n`;
    sitemap += `    <priority>${priority}</priority>\n`;
    sitemap += '  </url>\n';
  };

  // Thêm trang chủ
  const homePath = path.join(rootDir, 'home.html');
  const homeLastmod = fs.existsSync(homePath)
    ? new Date(fs.statSync(homePath).mtime).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  addUrl(`${BASE_URL}/`, homeLastmod, 'daily', '1.0');

  // Thêm các trang tĩnh
  STATIC_FILES.forEach(file => {
    if (file === 'home.html') return; // Đã thêm trang chủ
    const filePath = path.join(rootDir, file);
    const lastmod = fs.existsSync(filePath)
      ? new Date(fs.statSync(filePath).mtime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const url = `${BASE_URL}/${file}`;
    addUrl(url, lastmod, 'weekly', '0.8');
  });

  // Thêm trang danh mục chính
  const mainCatLastmod = fs.existsSync(mainCategoryFile)
    ? new Date(fs.statSync(mainCategoryFile).mtime).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  addUrl(`${BASE_URL}/danh-muc.html`, mainCatLastmod, 'weekly', '0.9');

  // Thêm các danh mục và bài viết
  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) return;

    // Thêm trang danh mục
    const catIndexPath = path.join(dirPath, 'index.html');
    const catLastmod = fs.existsSync(catIndexPath)
      ? new Date(fs.statSync(catIndexPath).mtime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const catUrl = `${BASE_URL}/${cfg.dir}/`;
    addUrl(catUrl, catLastmod, 'weekly', '0.9');

    // Thêm các bài viết trong danh mục
    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.html') && f !== 'index.html');
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const lastmod = fs.existsSync(filePath)
        ? new Date(fs.statSync(filePath).mtime).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const url = `${BASE_URL}/${cfg.dir}/${file}`;
      addUrl(url, lastmod, 'weekly', '0.8');
    });
  });

  // Kết thúc XML
  sitemap += '</urlset>';

  // Lưu file sitemap
  const sitemapPath = path.join(rootDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemap, 'utf8');
  console.log(`✅ Generated sitemap: ${sitemapPath.replace(rootDir, '')}`);
}

function generateRobotsTxt() {
  // Nội dung robots.txt
  const robotsTxt = `
User-agent: *
Disallow: /assets/
Disallow: /image/
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`.trim();

  // Lưu file robots.txt
  const robotsPath = path.join(rootDir, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf8');
  console.log(`✅ Generated robots.txt: ${robotsPath.replace(rootDir, '')}`);
}

function main() {
  try {
    generateSitemap();
    generateRobotsTxt();
  } catch (err) {
    console.error('❌ Error generating files:', err);
  }
}

main();