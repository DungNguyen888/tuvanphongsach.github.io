// File: seo-tools/build_static_pages.js
//------------------------------------------------------------
// Xây trang tĩnh: home.html, gioi-thieu.html, lien-he.html, dich-vu.html
// => Tạo index.html, gioi-thieu.html, lien-he.html, dich-vu.html ở root
// => Tối ưu ảnh (bao gồm cả ảnh nền), chèn meta, OG, schema, breadcrumb
//------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const sharp = require('sharp'); // npm i sharp

//------------------------------------------------------------
// CẤU HÌNH
//------------------------------------------------------------
const rootDir = path.resolve(__dirname, '../');
const pagesDir = path.join(rootDir, 'pages');
const partialsDir = path.join(rootDir, 'partials');

const headerFile = path.join(partialsDir, 'header.html');
const footerFile = path.join(partialsDir, 'footer.html');

// 4 file tĩnh
const STATIC_FILES = ['home.html', 'gioi-thieu.html', 'lien-he.html', 'dich-vu.html'];

// Domain
const BASE_URL = 'https://tuvanphongsach.com';
const defaultImage = '/image/default.jpg';

//-----------------------------------------
// 1) Load partials
//-----------------------------------------
function loadPartials() {
  const header = fs.readFileSync(headerFile, 'utf8');
  const footer = fs.readFileSync(footerFile, 'utf8');
  return { header, footer };
}

//-----------------------------------------
// 2) Tạo WebP & Chuyển <img> => <picture>
//-----------------------------------------
async function makeWebp(inputPath) {
  if (!fs.existsSync(inputPath)) return null;
  const ext = path.extname(inputPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return null;

  try {
    const { dir, name } = path.parse(inputPath);
    const webpPath = path.join(dir, `${name}.webp`);
    await sharp(inputPath)
      .withMetadata()
      .webp({ quality: 80 })  // Có thể điều chỉnh chất lượng nếu cần
      .toFile(webpPath);
    return webpPath.replace(rootDir, '').replace(/\\/g, '/');
  } catch (err) {
    console.error('[makeWebp] error:', err);
    return null;
  }
}

async function convertImages(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const imgs = $('img');
  if (imgs.length === 0) return html;

  for (let i = 0; i < imgs.length; i++) {
    const el = imgs[i];
    const src = $(el).attr('src');
    if (!src) continue;
    const alt = $(el).attr('alt') || '';

    // Xác định đường dẫn thật của ảnh
    const realPath = path.join(rootDir, src);

    // Nếu ảnh chưa có width/height, lấy thông tin từ file ảnh
    try {
      const metadata = await sharp(realPath).metadata();
      if (metadata.width && metadata.height) {
        if (!$(el).attr('width')) $(el).attr('width', metadata.width);
        if (!$(el).attr('height')) $(el).attr('height', metadata.height);
      }
    } catch (err) {
      console.error('Error reading image metadata:', err);
    }

    // Tạo file WebP nếu có thể
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

//-----------------------------------------
// 3) Xử lý ảnh nền (background images)
//-----------------------------------------
async function convertBackgroundImages(html) {
  // Tìm các thuộc tính inline có background-image
  const regex = /background-image:\s*url\(['"]?([^'")]+)['"]?\)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const originalStyle = match[0];
    const imageUrl = match[1];
    const realPath = path.join(rootDir, imageUrl);
    const webpRel = await makeWebp(realPath);
    if (webpRel) {
      // Thay thế URL ảnh nền bằng phiên bản WebP
      const newStyle = originalStyle.replace(imageUrl, webpRel);
      html = html.replace(originalStyle, newStyle);
    }
  }
  return html;
}

//-----------------------------------------
// 4) Chèn Meta, OG, Schema (giữ nguyên phần này)
//-----------------------------------------
function injectMeta(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      injectMeta(filePath);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(filePath, 'utf8');
      if (!html.includes('name="viewport"')) {
        const metaInsert = `
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Tuvanphongsach.com - Dịch vụ Tư Vấn Phòng Sạch">`;
        html = html.replace(/<head([^>]*)>/i, `<head$1>${metaInsert}`);
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`✅ [Meta] => ${filePath.replace(rootDir, '')}`);
      }
    }
  });
}

function injectOpenGraph(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      injectOpenGraph(filePath);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(filePath, 'utf8');
      if (!html.includes('property="og:image"')) {
        const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].trim() : 'Tuvanphongsach.com';
        const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
        const description = descMatch ? descMatch[1] : '';
        const matchImg = html.match(/<img[^>]*src="([^"]*)"/);
        const img = matchImg ? matchImg[1] : defaultImage;
        const rel = filePath.replace(rootDir, '').replace(/\\/g, '/');
        const ogUrl = BASE_URL + rel;

        const ogTags = `
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${ogUrl}">`;
        html = html.replace('</head>', ogTags + '\n</head>');
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`✅ [OG] => ${rel}`);
      }
    }
  });
}

function injectSchema(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      injectSchema(filePath);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(filePath, 'utf8');
      const schemaFileName = `schema-${filePath.replace(rootDir, '').replace(/\\/g, '-').replace('.html', '')}.json`;
      const schemaFilePath = path.join(rootDir, 'seo-tools', 'generated', schemaFileName);
      if (fs.existsSync(schemaFilePath) && !html.includes('application/ld+json')) {
        const schemaContent = fs.readFileSync(schemaFilePath, 'utf8');
        const snippet = `<script type="application/ld+json">${schemaContent}</script>`;
        html = html.includes('</head>') ? html.replace('</head>', snippet + '\n</head>') : html + snippet;
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`✅ [Schema] => ${filePath.replace(rootDir, '')}`);
      }
    }
  });
}

//-----------------------------------------
// 5) Tạo Breadcrumb JSON-LD cho các trang tĩnh
//-----------------------------------------
const pageMap = {
  'index.html': 'Trang chủ',
  'gioi-thieu.html': 'Giới thiệu',
  'lien-he.html': 'Liên hệ',
  'dich-vu.html': 'Dịch vụ'
};

function injectBreadcrumbAuto(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return;
    if (!file.endsWith('.html')) return;
    if (file === 'header.html' || file === 'footer.html') return;

    let html = fs.readFileSync(filePath, 'utf8');
    // Nếu đã có Breadcrumb thì bỏ qua
    if (html.includes('"@type": "BreadcrumbList"')) return;

    // Xây mảng itemListElement
    const itemList = [{
      "@type": "ListItem",
      "position": 1,
      "name": "Trang chủ",
      "item": BASE_URL + "/"
    }];
    if (pageMap[file] && file !== 'index.html') {
      itemList.push({
        "@type": "ListItem",
        "position": 2,
        "name": pageMap[file],
        "item": BASE_URL + "/" + file
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
</script>
`;

    // Chèn trước thẻ </head>
    if (html.includes('</head>')) {
      html = html.replace('</head>', snippet + '\n</head>');
    } else {
      // Nếu không tìm thấy head, append lên đầu
      html = snippet + html;
    }

    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ [Breadcrumb Tĩnh] => ${filePath.replace(rootDir, '')}`);
  });
}
//-----------------------------------------
// 6) Build Static Pages (bao gồm xử lý ảnh <img> và ảnh nền)
//-----------------------------------------
async function buildStaticPages() {
  const { header, footer } = loadPartials();
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
    // Lấy H1 để tạo <title> nếu chưa có
    const $ = cheerio.load(raw, { decodeEntities: false });
    const h1 = $('h1').first().text().trim() || 'Untitled';
    if (!raw.includes('<title>')) {
      raw = `<title>${h1}</title>\n` + raw;
    }
    // Ghép header, nội dung và footer
    let finalHtml = header + '\n' + raw + '\n' + footer;
    // Xử lý ảnh <img>
    finalHtml = await convertImages(finalHtml);
    // Xử lý ảnh nền trong inline style
    finalHtml = await convertBackgroundImages(finalHtml);

    // Xác định tên file đầu ra
    let outName;
    switch (file) {
      case 'home.html':
        outName = 'index.html';
        break;
      case 'gioi-thieu.html':
      case 'lien-he.html':
      case 'dich-vu.html':
        outName = file;
        break;
    }
    const outPath = path.join(rootDir, outName);
    fs.writeFileSync(outPath, finalHtml, 'utf8');
    console.log(`✅ Build [${file}] => /${outName}`);
  }

  // Chèn Meta, OG, Schema và Breadcrumb
  injectMeta(rootDir);
  injectOpenGraph(rootDir);
  injectSchema(rootDir);
  injectBreadcrumbAuto(rootDir);

  console.log('\n🎯 Hoàn tất build trang tĩnh + SEO + Breadcrumb!\n');
}

buildStaticPages().catch(err => console.error('❌ Lỗi build trang:', err));
