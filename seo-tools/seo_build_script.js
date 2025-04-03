const fs = require('fs');
const path = require('path');

const domain = 'https://tuvanphongsach.com';
const pages = [
  { url: '/', title: 'Trang chủ', priority: 1.0 },
  { url: '/contact.html', title: 'Liên hệ', priority: 0.8 },
  { url: '/camon.html', title: 'Cảm ơn', priority: 0.5 }
];

// Sitemap
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${domain}${p.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
fs.writeFileSync(path.resolve(__dirname, '../sitemap.xml'), sitemap);

// Robots
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml`;
fs.writeFileSync(path.resolve(__dirname, '../robots.txt'), robots);

// Schema Breadcrumb
pages.forEach(p => {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Trang chủ",
        "item": `${domain}/index.html`
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": p.title,
        "item": `${domain}${p.url}`
      }
    ]
  };
  const fileName = p.url === '/' ? 'home' : p.url.replace('/', '').replace('.html', '');
fs.writeFileSync(path.resolve(__dirname, `../schema-${fileName}.json`), JSON.stringify(schema, null, 2));
});

console.log('✅ Đã build sitemap, robots.txt & schema!');
