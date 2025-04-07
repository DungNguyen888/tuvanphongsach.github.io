// seo-tools/build_articles.js

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const sharp = require('sharp'); // npm install sharp

const rootDir = path.resolve(__dirname, '../');
const pagesDir = path.join(rootDir, 'pages');
const partialsDir = path.join(rootDir, 'partials');

const categoryDir = path.join(rootDir, 'category');
const tagDir = path.join(rootDir, 'tags');
const categoryIndexFile = path.join(categoryDir, 'index.html');
const tagIndexFile = path.join(tagDir, 'index.html');
const mainCategoryFile = path.join(rootDir, 'danh-muc.html');
const generatedSchemaDir = path.join(rootDir, 'seo-tools/generated');

// Cấu hình danh mục
const categoryConfigs = [
  { dir: 'ahu', title: 'AHU - Phòng sạch' },
  { dir: 'fcu', title: 'FCU - Thiết bị phòng sạch' },
  { dir: 'chillers', title: 'Chillers - Giải pháp làm lạnh' },
  { dir: 'air-cooled', title: 'Air Cooled - Hệ thống lạnh' },
  { dir: 'tu-van-phong-sach', title: 'Tư vấn phòng sạch' }
];
const categoryMap = {};
categoryConfigs.forEach(cfg => {
  categoryMap[cfg.dir] = cfg.title;
});

// 4 file tĩnh => KHÔNG build ở đây
const STATIC_FILES = ['home.html','gioi-thieu.html','lien-he.html','dich-vu.html'];

let categoriesData = {};
let tagsData = {};

const defaultImage = '/image/default.jpg';

// =================================
// 1) GHÉP header/footer CHO BÀI VIẾT
function loadPartials() {
  const header = fs.readFileSync(path.join(partialsDir, 'header.html'),'utf8');
  const footer = fs.readFileSync(path.join(partialsDir, 'footer.html'),'utf8');
  return { header, footer };
}

async function makeWebp(inputPath) {
  if (!fs.existsSync(inputPath)) return null;
  const ext = path.extname(inputPath).toLowerCase();
  if (!['.jpg','.jpeg','.png'].includes(ext)) return null;
  try {
    const {dir, name} = path.parse(inputPath);
    const webpPath = path.join(dir, `${name}.webp`);
    await sharp(inputPath)
      .withMetadata()
      .webp({ quality: 80 })
      .toFile(webpPath);
    return webpPath.replace(rootDir, '').replace(/\\/g, '/');
  } catch(err){
    console.error('Lỗi makeWebp:', err);
    return null;
  }
}

async function convertImages(html) {
  const $ = cheerio.load(html,{ decodeEntities: false });
  const imgs = $('img');
  if (imgs.length===0) return html;

  for(let i=0; i<imgs.length; i++){
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

async function buildArticles() {
  const { header, footer } = loadPartials();
  if (!fs.existsSync(pagesDir)) {
    console.log('❌ pages/ ko tồn tại');
    return;
  }

  // Lấy tất cả file .html trong pages/
  const allFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
  // Lọc bỏ 4 file tĩnh
  const articleFiles = allFiles.filter(f => !STATIC_FILES.includes(f));

  for(const file of articleFiles){
    const filePath = path.join(pagesDir, file);
    let raw = fs.readFileSync(filePath,'utf8');

    const $ = cheerio.load(raw, { decodeEntities: false });
    const h1 = $('h1').first().text().trim() || 'Untitled Article';
    if (!raw.includes('<title>')) {
      raw = `<title>${h1}</title>\n` + raw;
    }

    let finalHtml = header + '\n' + raw + '\n' + footer;
    finalHtml = await convertImages(finalHtml);

    // Lấy category => folder
    const cat = $('meta[name="category"]').attr('content') || 'misc';
    const outDir = path.join(rootDir, cat);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    const outPath = path.join(outDir, file);
    fs.writeFileSync(outPath, finalHtml, 'utf8');
    console.log(`✅ Build Article [${file}] => /${cat}/${file}`);
  }
}

// =================================
// 2) gatherCategoryAndTags => quét data
function gatherCategoryAndTags() {
  categoriesData = {};
  tagsData = {};

  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html'));
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const html = fs.readFileSync(filePath,'utf8');
      const $ = cheerio.load(html,{ decodeEntities: false });

      const catName = $('meta[name="category"]').attr('content') || cfg.dir;
      const title = $('title').text().trim() || cfg.title;
      const description = $('meta[name="description"]').attr('content')
        || $('p').first().text().trim()
        || 'Bài viết phòng sạch';
      let image = $('meta[property="og:image"]').attr('content')
        || $('img').first().attr('src')
        || defaultImage;

      const tagStr = $('meta[name="tags"]').attr('content') || '';
      const tagList = tagStr.split(',').map(t => t.trim()).filter(Boolean);

      const url = `/${cfg.dir}/${file}`;

      if (!categoriesData[catName]) categoriesData[catName] = [];
      categoriesData[catName].push({ title, description, image, url });

      tagList.forEach(tag => {
        if(!tagsData[tag]) tagsData[tag]=[];
        tagsData[tag].push({ title, description, image, url });
      });
    });
  });
}

function injectBreadcrumbAuto(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Đệ quy, tiếp tục duyệt subfolder
      injectBreadcrumbAuto(filePath);
    } else if (file.endsWith('.html')) {

      // Bỏ qua partials, header.html, footer.html, ...
      if (file === 'header.html' || file === 'footer.html') return;

      // Đọc nội dung
      let html = fs.readFileSync(filePath, 'utf8');

      // Nếu file này *đã* có BreadcrumbList => skip
      if (html.includes('"@type": "BreadcrumbList"')) {
        console.log(`❎ Bỏ qua (đã có breadcrumb): ${filePath.replace(rootDir, '')}`);
        return;
      }

      // Tạo list itemListElement
      // Mặc định: item #1 = "Trang chủ"
      let itemList = [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Trang chủ",
          "item": "https://tuvanphongsach.com/"
        }
      ];

      // Lấy relative path
      // E.g: "/ahu/ahu-bai1.html"
      let relative = filePath.replace(rootDir, '').replace(/\\/g, '/');
      if (relative.startsWith('/')) relative = relative.substring(1);

      // Tách thành mảng
      // e.g: ["ahu", "ahu-bai1.html"]
      const parts = relative.split('/');

      // Lưu ý:
      //  - Nếu file = index.html (root) => breadcrumb = 1 item (Trang chủ).
      //  - Nếu file = gioi-thieu.html => => "Trang chủ" + "Giới thiệu".
      //  - v.v.
      // Tạo link dần dần
      let currentUrl = "https://tuvanphongsach.com";
      for (let i = 0; i < parts.length; i++) {
        let slug = parts[i];
        // Bỏ qua "index.html" ở root => skip
        if (slug === 'index.html') continue;

        // Kiểm tra có .html ko => last part
        const isLastPart = (i === parts.length - 1 && slug.endsWith('.html'));

        // Tạo link
        currentUrl += '/' + slug;
        
        if (isLastPart) {
          // Lấy <title> trong file => name
          const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
          let lastName = slug.replace('.html','');
          if (titleMatch) {
            lastName = titleMatch[1].trim();
          }

          itemList.push({
            "@type": "ListItem",
            "position": itemList.length + 1,
            "name": lastName,
            "item": currentUrl
          });

        } else {
          // folder => e.g: "ahu"
          let displayName = slug;
          // Map sang categoryMap => "AHU - Phòng sạch"
          if (categoryMap[slug]) {
            displayName = categoryMap[slug];
          }
          // Thêm item
          itemList.push({
            "@type": "ListItem",
            "position": itemList.length + 1,
            "name": displayName,
            "item": currentUrl + '/'
          });
        }
      }

      // Tạo object JSON-LD
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

      // Chèn snippet
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${snippet}\n</body>`);
      } else {
        // fallback
        html += snippet;
      }

      fs.writeFileSync(filePath, html, 'utf8');
      console.log(`✅ [Breadcrumb] => ${filePath.replace(rootDir, '')}`);
    }
  });
}

// 3) buildSubCategoryIndexes, buildCategoryTagsIndex, buildMainCategoryFile
function buildSubCategoryIndexes() {
  // Tạo index.html trong mỗi thư mục (ahu, fcu, ...)
  // ... (y hệt code cũ)
}
function buildCategoryTagsIndex() {
  // Tạo category/index.html, tags/index.html
  // ...
}
function buildMainCategoryFile() {
  // Tạo danh-muc.html
  // ...
}

// 4) injectMeta, injectOpenGraph, injectSchema
function injectMeta(folder) {
  // ...
}
function injectOpenGraph(folder) {
  // ...
}
function injectSchema(folder) {
  // ...
}

// 5) injectRelatedPosts
function injectRelatedPosts() {
  // ...
}

// 6) buildAll
async function buildAllArticles() {
  // 1) Ghép bài viết
  await buildArticles();

  // 2) gather => build index
  gatherCategoryAndTags();
  buildSubCategoryIndexes();
  buildCategoryTagsIndex();
  buildMainCategoryFile();

  // 3) chèn meta, og, schema
  injectMeta(rootDir);
  injectOpenGraph(rootDir);
  injectSchema(rootDir);

  // 4) bài viết liên quan
  injectRelatedPosts();

  injectBreadcrumbAuto(rootDir); 

  console.log('\n🎯 Hoàn tất build bài viết + danh mục!\n');
}

buildAllArticles().catch(err=>console.error(err));
