const fs = require('fs');
const path = require('path');

const domain = 'https://tuvanphongsach.com';
//+++++++++++++++++++++++Thêm site mới ở đây====================
const pages = [
  { url: '/', title: 'Trang chủ', priority: 1.0 },
  { url: '/contact.html', title: 'Liên hệ', priority: 0.8 },
  { url: '/camon.html', title: 'Cảm ơn', priority: 0.5 },
  { url: '/ahu.html', title: 'AHU - Thiết bị phòng sạch', priority: 0.9 }
];
//+++++++++++++++++++++++Thêm site mới ở đây==============================
// Tạo sitemap.xml
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${domain}${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
fs.writeFileSync('./sitemap.xml', sitemap);

// Tạo robots.txt
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml`;
fs.writeFileSync('./robots.txt', robots);

// Tạo Schema Breadcrumb
pages.forEach(page => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Trang chủ",
        "item": `${domain}/`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": page.title,
        "item": `${domain}${page.url}`
      }
    ]
  };
  const name = page.url === '/' ? 'home' : page.url.replace('/', '').replace('.html', '');
  fs.writeFileSync(`./schema-${name}.json`, JSON.stringify(schema, null, 2));
});

console.log('✅ Đã build sitemap, robots.txt, schema cho toàn bộ website!');
