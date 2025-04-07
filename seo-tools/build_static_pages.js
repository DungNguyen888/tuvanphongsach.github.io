// seo-tools/build_static_pages.js

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const sharp = require('sharp'); // npm install sharp

const rootDir = path.resolve(__dirname, '../');
const pagesDir = path.join(rootDir, 'pages');
const partialsDir = path.join(rootDir, 'partials');

const headerFile = path.join(partialsDir, 'header.html');
const footerFile = path.join(partialsDir, 'footer.html');

// 4 file tĩnh
const STATIC_FILES = ['home.html','gioi-thieu.html','lien-he.html','dich-vu.html'];

// Load
function loadPartials() {
  const header = fs.readFileSync(headerFile, 'utf8');
  const footer = fs.readFileSync(footerFile, 'utf8');
  return { header, footer };
}
const pageMap = {
  'index.html': 'Trang chủ',
  'gioi-thieu.html': 'Giới thiệu',
  'lien-he.html': 'Liên hệ',
  'dich-vu.html': 'Dịch vụ'
};
const BASE_URL = 'https://tuvanphongsach.com';
function injectBreadcrumbAuto(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Đệ quy folder
      injectBreadcrumbAuto(filePath);
    } else if (file.endsWith('.html')) {

      // Bỏ qua header.html, footer.html 
      if (file === 'header.html' || file === 'footer.html') return;

      let html = fs.readFileSync(filePath, 'utf8');

      // Nếu file này đã có breadcrumb => skip
      if (html.includes('"@type": "BreadcrumbList"')) {
        console.log(`❎ Bỏ qua (đã có breadcrumb): ${filePath.replace(rootDir, '')}`);
        return;
      }

      // Xác định file. e.g: "index.html"
      // Tạo itemList
      const itemList = [];

      // Luôn item #1 = Trang chủ
      itemList.push({
        "@type": "ListItem",
        "position": 1,
        "name": "Trang chủ",
        "item": BASE_URL + "/" // e.g: https://tuvanphongsach.com/
      });

      // Xử lý file. e.g: "index.html", "gioi-thieu.html"
      if (pageMap[file]) {
        // file = "index.html" => "Trang chủ"? 
        // Nếu "index.html" => breadcrumb 1 item => skip
        if (file === 'index.html') {
          // index.html => Trang chủ => Chỉ 1 item => xong
          // optional: cắt bớt? 
          // Hoặc hiển thị 2 item (Trang chủ > Trang chủ)? Thường skip.
          console.log(`⚠ Trang chủ, skip chèn breadcrumb? ${filePath.replace(rootDir, '')}`);
          return;
        } else {
          // file = "gioi-thieu.html", "lien-he.html", "dich-vu.html"
          const itemName = pageMap[file]; // "Giới thiệu", "Liên hệ", ...
          itemList.push({
            "@type": "ListItem",
            "position": 2,
            "name": itemName,
            "item": BASE_URL + "/" + file
          });
        }
      } else {
        // File ko trong pageMap => skip hoặc handle
        // e.g. "test.html" => ...
        console.log(`❌ Ko trong pageMap => skip: ${file}`);
        return;
      }

      // Tạo breadcrumb JSON
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

      // Chèn snippet trước </body>
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${snippet}\n</body>`);
      } else {
        html += snippet;
      }

      fs.writeFileSync(filePath, html, 'utf8');
      console.log(`✅ [Breadcrumb Tĩnh] => ${filePath.replace(rootDir, '')}`);
    }
  });
}

// Tạo webp
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
    console.error('Lỗi makeWebp:', err);
    return null;
  }
}

// Chuyển <img> => <picture>
async function convertImages(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const imgs = $('img');
  if (imgs.length===0) return html;

  for(let i=0;i<imgs.length;i++){
    const el = imgs[i];
    const src = $(el).attr('src');
    if (!src) continue;
    const alt = $(el).attr('alt') || '';
    const realPath = path.join(rootDir, src);
    const webpRel = await makeWebp(realPath);
    if (webpRel) {
      const pictureHtml = `
<picture>
  <source srcset="${webpRel}" type="image/webp">
  <img src="${src}" alt="${alt}">
</picture>
`;
      $(el).replaceWith(pictureHtml);
    }
  }
  return $.html();
}

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
    const $ = cheerio.load(raw,{ decodeEntities:false });
    const h1 = $('h1').first().text().trim() || 'Untitled';

    if (!raw.includes('<title>')) {
      raw = `<title>${h1}</title>\n` + raw;
    }

    let finalHtml = header + '\n' + raw + '\n' + footer;
    finalHtml = await convertImages(finalHtml);

    // Mapping
    let outName;
    switch(file){
      case 'home.html': outName='index.html'; break;
      case 'gioi-thieu.html': outName='gioi-thieu.html'; break;
      case 'lien-he.html': outName='lien-he.html'; break;
      case 'dich-vu.html': outName='dich-vu.html'; break;
    }
    const outPath = path.join(rootDir, outName);
    fs.writeFileSync(outPath, finalHtml,'utf8');
    injectBreadcrumbAuto(rootDir);
    console.log(`✅ Build [${file}] => /${outName}`);
  }
}

buildStaticPages().catch(err=>console.error(err));
