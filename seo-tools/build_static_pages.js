// File: seo-tools/build_static_pages.js
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '../');
const pagesDir = path.join(rootDir, 'pages');
const partialsDir = path.join(rootDir, 'partials');

const headerFile = path.join(partialsDir, 'header.html');
const footerFile = path.join(partialsDir, 'footer.html');

const STATIC_FILES = ['home.html', 'gioi-thieu.html', 'lien-he.html', 'dich-vu.html'];
const BASE_URL = 'https://tuvanphongsach.com';
const defaultImage = '/image/default.jpg';

// Load partials
function loadPartials() {
  const header = fs.readFileSync(headerFile, 'utf8');
  const footer = fs.readFileSync(footerFile, 'utf8');
  return { header, footer };
}

// Xử lý ảnh WebP
async function makeWebp(inputPath) {
  if (!fs.existsSync(inputPath)) return null;
  const ext = path.extname(inputPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return null;

  try {
    const { dir, name } = path.parse(inputPath);
    const webpPath = path.join(dir, `${name}.webp`);
    await sharp(inputPath)
      .withMetadata()
      .webp({ quality: 80 })
      .toFile(webpPath);
    return webpPath.replace(rootDir, '').replace(/\\/g, '/');
  } catch (err) {
    console.error('[makeWebp] error:', err);
    return null;
  }
}

// Convert <img> to <picture>
async function convertImages(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const imgs = $('img');
  if (imgs.length === 0) return html;

  for (let i = 0; i < imgs.length; i++) {
    const el = imgs[i];
    const src = $(el).attr('src');
    if (!src) continue;
    const alt = $(el).attr('alt') || '';
    const realPath = path.join(rootDir, src);

    try {
      const metadata = await sharp(realPath).metadata();
      if (metadata.width && metadata.height) {
        if (!$(el).attr('width')) $(el).attr('width', metadata.width);
        if (!$(el).attr('height')) $(el).attr('height', metadata.height);
      }
    } catch (err) {
      console.error('Error reading image metadata:', err);
    }

    const webpRel = await makeWebp(realPath);
    if (webpRel) {
      const width = $(el).attr('width') || '';
      const height = $(el).attr('height') || '';
      const pictureHtml = `
<picture>
  <source srcset="${webpRel}" type="image/webp">
  <img src="${src}" alt="${alt}" class="img-fluid" ${width ? `width="${width}"` : ''} ${height ? `height="${height}"` : ''}>
</picture>`;
      $(el).replaceWith(pictureHtml);
    }
  }
  return $.html();
}

// Convert background images
async function convertBackgroundImages(html) {
  const regex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const originalStyle = match[0];
    const imageUrl = match[1];
    const realPath = path.join(rootDir, imageUrl);
    const webpRel = await makeWebp(realPath);
    if (webpRel) {
      const newStyle = originalStyle.replace(imageUrl, webpRel);
      html = html.replace(originalStyle, newStyle);
    }
  }
  return html;
}

// Inject Meta (chỉ áp dụng cho STATIC_FILES)
function injectMeta() {
  STATIC_FILES.forEach(file => {
    const outName = file === 'home.html' ? 'index.html' : file;
    const filePath = path.join(rootDir, outName);
    if (!fs.existsSync(filePath)) return;

    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    // Xóa các meta cũ nếu có
    $('meta[name="viewport"], meta[name="description"]').remove();

    const metaInsert = `
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Tuvanphongsach.com - Dịch vụ Tư Vấn Phòng Sạch">`;
    $('head').append(metaInsert);

    html = $.html();
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ [Meta] => ${outName}`);
  });
}

// Inject Open Graph (chỉ áp dụng cho STATIC_FILES)
function injectOpenGraph() {
  STATIC_FILES.forEach(file => {
    const outName = file === 'home.html' ? 'index.html' : file;
    const filePath = path.join(rootDir, outName);
    if (!fs.existsSync(filePath)) return;

    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    // Xóa OG cũ nếu có
    $('meta[property^="og:"]').remove();

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Tuvanphongsach.com';
    const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
    const description = descMatch ? descMatch[1] : '';
    const matchImg = html.match(/<img[^>]*src="([^"]*)"/);
    const img = matchImg ? matchImg[1] : defaultImage;
    const ogUrl = BASE_URL + '/' + outName;

    const ogTags = `
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${ogUrl}">`;
    $('head').append(ogTags);

    html = $.html();
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ [OG] => ${outName}`);
  });
}

// Inject Schema (chỉ áp dụng cho STATIC_FILES)
function injectSchema() {
  STATIC_FILES.forEach(file => {
    const outName = file === 'home.html' ? 'index.html' : file;
    const filePath = path.join(rootDir, outName);
    if (!fs.existsSync(filePath)) return;

    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    // Xóa schema cũ nếu có
    $('script[type="application/ld+json"]').remove();

    const schemaFileName = `schema-${outName.replace('.html', '')}.json`;
    const schemaFilePath = path.join(rootDir, 'seo-tools', 'generated', schemaFileName);
    if (fs.existsSync(schemaFilePath)) {
      const schemaContent = fs.readFileSync(schemaFilePath, 'utf8');
      const snippet = `<script type="application/ld+json">${schemaContent}</script>`;
      $('head').append(snippet);
      html = $.html();
      fs.writeFileSync(filePath, html, 'utf8');
      console.log(`✅ [Schema] => ${outName}`);
    }
  });
}

// Inject Breadcrumb (chỉ áp dụng cho STATIC_FILES)
function injectBreadcrumbAuto() {
  STATIC_FILES.forEach(file => {
    const outName = file === 'home.html' ? 'index.html' : file;
    const filePath = path.join(rootDir, outName);
    if (!fs.existsSync(filePath)) return;

    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    // Xóa breadcrumb cũ nếu có
    $('script[type="application/ld+json"]').filter((i, el) => {
      return $(el).html().includes('"BreadcrumbList"');
    }).remove();

    const itemList = [{
      "@type": "ListItem",
      "position": 1,
      "name": "Trang chủ",
      "item": BASE_URL + "/"
    }];

    if (outName !== 'index.html') {
      const name = $('title').text().trim() || outName.replace('.html', '');
      itemList.push({
        "@type": "ListItem",
        "position": 2,
        "name": name,
        "item": BASE_URL + '/' + outName
      });
    }

    const breadcrumbJSON = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": itemList
    };
    const snippet = `
<script type="application/ld+json">
${JSON.stringify(breadcrumbJSON, null, 2)}
</script>`;

    $('head').prepend(snippet);
    html = $.html();
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ [Breadcrumb Auto] => ${outName}`);
  });
}

// Build Static Pages
async function buildStaticPages() {
  if (!fs.existsSync(pagesDir)) {
    console.log('❌ Thư mục pages/ không tồn tại');
    return;
  }

  for (const file of STATIC_FILES) {
    const filePath = path.join(pagesDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Không tìm thấy ${file}`);
      continue;
    }
    let raw = fs.readFileSync(filePath, 'utf8');
    const $raw = cheerio.load(raw, { decodeEntities: false });
    const h1Text = $raw('h1').first().text().trim() || 'Untitled';
    $raw('title, meta, script[type="application/ld+json"]').remove();
    raw = $raw.html();

    let { header, footer } = loadPartials();

    const $doc = cheerio.load('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"></head><body></body></html>', { decodeEntities: false });
    $doc('head').append(`
      <link rel="stylesheet" href="/style.css">
      <link rel="stylesheet" href="/assets/bootstrap/bootstrap.min.css">
    `);
    $doc('head').append(`<title>${h1Text}</title>`);
    $doc('body').append(header); // Menu từ header.html
    $doc('body').append(raw);
    $doc('body').append(footer);

    let finalHtml = $doc.html();
    finalHtml = await convertImages(finalHtml);
    finalHtml = await convertBackgroundImages(finalHtml);

    const outName = file === 'home.html' ? 'index.html' : file;
    const outPath = path.join(rootDir, outName);
    fs.writeFileSync(outPath, finalHtml, 'utf8');
    console.log(`✅ Build [${file}] => /${outName}`);
  }

  injectMeta();
  injectOpenGraph();
  injectSchema();
  injectBreadcrumbAuto();

  console.log('\n🎯 Hoàn tất build trang tĩnh + SEO + Breadcrumb!\n');
}

buildStaticPages().catch(err => console.error('❌ Lỗi build trang:', err));