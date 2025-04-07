// File: seo-tools/build_static_pages.js
//------------------------------------------------------------
// Xây trang tĩnh: home.html, gioi-thieu.html, lien-he.html, dich-vu.html
// => Tạo index.html, gioi-thieu.html, lien-he.html, dich-vu.html ở root
// => Tối ưu ảnh, chèn meta, OG, schema, breadcrumb
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
const STATIC_FILES = ['home.html','gioi-thieu.html','lien-he.html','dich-vu.html'];

// Domain
const BASE_URL = 'https://tuvanphongsach.com';
const defaultImage = '/image/default.jpg';

//-----------------------------------------
// 1) Load partial
//-----------------------------------------
function loadPartials() {
  const header = fs.readFileSync(headerFile, 'utf8');
  const footer = fs.readFileSync(footerFile, 'utf8');
  return { header, footer };
}

//-----------------------------------------
// 2) Tạo webp & Chuyển <img> => <picture>
//-----------------------------------------
async function makeWebp(inputPath) {
  if (!fs.existsSync(inputPath)) return null;
  const ext = path.extname(inputPath).toLowerCase();
  if (!['.jpg','.jpeg','.png'].includes(ext)) return null;

  try {
    const { dir, name } = path.parse(inputPath);
    const webpPath = path.join(dir, `${name}.webp`);
    await sharp(inputPath)
      .withMetadata()
      .webp({ quality: 80 })
      .toFile(webpPath);
    return webpPath.replace(rootDir, '').replace(/\\/g, '/');
  } catch(err) {
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
    
    // Nếu ảnh chưa có width/height, thử lấy thông tin từ file ảnh
    try {
      const metadata = await sharp(realPath).metadata();
      if (metadata.width && metadata.height) {
        // Chỉ thiết lập nếu các thuộc tính này chưa có
        if (!$(el).attr('width')) $(el).attr('width', metadata.width);
        if (!$(el).attr('height')) $(el).attr('height', metadata.height);
      }
    } catch(err) {
      console.error('Error reading image metadata:', err);
    }
    
    // Tạo file webp nếu có thể
    const webpRel = await makeWebp(realPath);
    if (webpRel) {
      // Lấy lại width và height đã thêm (nếu có)
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
// 3) Chèn Meta (nếu thiếu), OG (nếu thiếu), Schema (nếu file .json),
//    - Dưới đây code sẵn sàng
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

      // Check viewport, description
      if (!html.includes('name="viewport"')) {
        const metaInsert = `
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Tuvanphongsach.com - Dịch vụ Tư Vấn Phòng Sạch">`;
        html = html.replace(/<head([^>]*)>/i, `<head$1>${metaInsert}`);
        fs.writeFileSync(filePath, html, 'utf8');
        console.log(`✅ [Meta] => ${filePath.replace(rootDir,'')}`);
      }
    }
  });
}
function injectOpenGraph(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder,file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      injectOpenGraph(filePath);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(filePath,'utf8');
      if (!html.includes('property="og:image"')) {
        // Tìm <title>
        const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].trim() : 'Tuvanphongsach.com';
        const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
        const description = descMatch ? descMatch[1] : '';
        // Tìm ảnh
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
    const filePath = path.join(folder,file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      injectSchema(filePath);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(filePath,'utf8');
      const schemaFileName = `schema-${filePath.replace(rootDir,'').replace(/\\/g,'-').replace('.html','')}.json`;
      const schemaFilePath = path.join(rootDir,'seo-tools','generated',schemaFileName);
      if (fs.existsSync(schemaFilePath) && !html.includes('application/ld+json')) {
        const schemaContent = fs.readFileSync(schemaFilePath,'utf8');
        const snippet = `<script type="application/ld+json">${schemaContent}</script>`;
        if (html.includes('</head>')) {
          html = html.replace('</head>', snippet + '\n</head>');
        } else {
          html += snippet;
        }
        fs.writeFileSync(filePath, html,'utf8');
        console.log(`✅ [Schema] => ${filePath.replace(rootDir,'')}`);
      }
    }
  });
}

//-----------------------------------------
// 4) Tạo Breadcrumb JSON-LD cho 4 file tĩnh
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
    const filePath = path.join(folder,file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      injectBreadcrumbAuto(filePath);
    } else if (file.endsWith('.html')) {
      if (file==='header.html' || file==='footer.html') return;
      let html = fs.readFileSync(filePath,'utf8');
      if (html.includes('"@type": "BreadcrumbList"')) return;
      // itemList
      const itemList = [{
        "@type": "ListItem",
        "position": 1,
        "name": "Trang chủ",
        "item": BASE_URL + "/"
      }];
      if (pageMap[file]) {
        if (file !== 'index.html') {
          itemList.push({
            "@type": "ListItem",
            "position": 2,
            "name": pageMap[file],
            "item": BASE_URL + "/" + file
          });
        } else {
          // index.html => skip (1 item)
        }
      } else {
        return;
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
      if (html.includes('</body>')) {
        html = html.replace('</body>', snippet + '\n</body>');
      } else {
        html += snippet;
      }
      fs.writeFileSync(filePath, html,'utf8');
      console.log(`✅ [Breadcrumb Tĩnh] => ${filePath.replace(rootDir,'')}`);
    }
  });
}

//-----------------------------------------
// 5) buildStaticPages
//-----------------------------------------
async function buildStaticPages() {
  const { header, footer } = loadPartials();
  if (!fs.existsSync(pagesDir)) {
    console.log('❌ pages/ ko tồn tại');
    return;
  }

  for(const file of STATIC_FILES) {
    const filePath = path.join(pagesDir, file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ Ko thấy ${file}`);
      continue;
    }
    let raw = fs.readFileSync(filePath, 'utf8');
    // Lấy H1 => <title> (nếu thiếu)
    const $ = cheerio.load(raw, { decodeEntities: false });
    const h1 = $('h1').first().text().trim() || 'Untitled';

    if (!raw.includes('<title>')) {
      raw = `<title>${h1}</title>\n` + raw;
    }

    // GHÉP header + raw + footer
    let finalHtml = header + '\n' + raw + '\n' + footer;

    // Chuyển <img> => <picture>
    finalHtml = await convertImages(finalHtml);

    // outName
    let outName;
    switch(file) {
      case 'home.html':
        outName='index.html';
        break;
      case 'gioi-thieu.html':
      case 'lien-he.html':
      case 'dich-vu.html':
        outName=file;
        break;
    }
    const outPath = path.join(rootDir, outName);
    fs.writeFileSync(outPath, finalHtml,'utf8');
    console.log(`✅ Build [${file}] => /${outName}`);
  }

  // chèn meta, og, schema
  injectMeta(rootDir);
  injectOpenGraph(rootDir);
  injectSchema(rootDir);
  // breadcrumb
  injectBreadcrumbAuto(rootDir);

  console.log('\n🎯 Hoàn tất build trang tĩnh + SEO + breadcrumb!\n');
}

//-----------------------------------------
// CHẠY
//-----------------------------------------
buildStaticPages().catch(err => console.error(err));
