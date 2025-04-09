const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '../');
const pagesDir = path.join(rootDir, 'pages');
const partialsDir = path.join(rootDir, 'partials');

// 4 file tĩnh => skip
const STATIC_FILES = ['home.html','gioi-thieu.html','lien-he.html','dich-vu.html'];

// Cấu hình danh mục
const categoryConfigs = [
  { dir: 'ahu', title: 'AHU - Phòng sạch' },
  { dir: 'fcu', title: 'FCU - Thiết bị phòng sạch' },
  { dir: 'chillers', title: 'Chillers - Giải pháp làm lạnh' },
  { dir: 'air-cooled', title: 'Air Cooled - Hệ thống lạnh' },
  { dir: 'tu-van-phong-sach', title: 'Tư vấn phòng sạch' }
];

const categoryDir = path.join(rootDir, 'category');
const tagDir = path.join(rootDir, 'tags');
const categoryIndexFile = path.join(categoryDir, 'index.html');
const tagIndexFile = path.join(tagDir, 'index.html');
const mainCategoryFile = path.join(rootDir, 'danh-muc.html');
const generatedSchemaDir = path.join(rootDir, 'seo-tools/generated');

let categoriesData = {};
let tagsData = {};

const defaultImage = '/image/default.jpg';
const BASE_URL = 'https://tuvanphongsach.com';

//-----------------------------------------
// 0) Thu thập metadata từ /pages trước khi build
//-----------------------------------------
function gatherRawArticles() {
  const rawData = {};
  if (!fs.existsSync(pagesDir)) return rawData;
  const files = fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.html') && !STATIC_FILES.includes(f));
  files.forEach(file => {
    const html = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    const $ = cheerio.load(html);
    const title = $('h1').first().text().trim() || 'Untitled';
    const tags = ($('meta[name="tags"]').attr('content') || '')
      .split(',').map(t => t.trim()).filter(Boolean);
    const category = $('meta[name="category"]').attr('content') || 'misc';
    const url = `/${category}/${file}`;
    rawData[file] = { title, tags, url };
  });
  return rawData;
}

//-----------------------------------------
// 1) load partials
//-----------------------------------------
function loadPartials() {
  const header = fs.readFileSync(path.join(partialsDir, 'header.html'),'utf8');
  const footer = fs.readFileSync(path.join(partialsDir, 'footer.html'),'utf8');
  return { header, footer };
}

//-----------------------------------------
// 2) Tạo webp + convertImages
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
    console.error('[makeWebp error]:', err);
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

    const realPath = path.join(rootDir, src);
    try {
      const metadata = await sharp(realPath).metadata();
      if (metadata.width && metadata.height) {
        if (!$(el).attr('width')) $(el).attr('width', metadata.width);
        if (!$(el).attr('height')) $(el).attr('height', metadata.height);
      }
    } catch(err) {
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

//-----------------------------------------
// 3) buildArticles => ghép header/footer, thêm Related, skip file tĩnh
//-----------------------------------------
async function buildArticles(rawData) {
  let { header, footer } = loadPartials();
  if (!fs.existsSync(pagesDir)) {
    console.log('❌ pages/ không tồn tại');
    return;
  }

  const allFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'));
  const articleFiles = allFiles.filter(f => !STATIC_FILES.includes(f));

  for (const file of articleFiles) {
    const filePath = path.join(pagesDir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(raw, { decodeEntities: false });

    // Lấy giá trị category trước khi xóa meta
    const cat = $('meta[name="category"]').attr('content') || 'misc';

    // Trích xuất meta tags cần chuyển lên head
    const metaCategory = $('meta[name="category"]').toString();
    const metaDescription = $('meta[name="description"]').toString();
    const metaTags = $('meta[name="tags"]').toString();

    // Xóa các meta tags khỏi nội dung bài viết
    $('meta[name="category"]').remove();
    $('meta[name="description"]').remove();
    $('meta[name="tags"]').remove();

    // Lấy tiêu đề bài viết từ thẻ <h1>
    const h1Title = $('h1').first().text().trim() || 'Untitled Article';

    // Cập nhật header: <title> và chèn meta tags
    header = header.replace(/<title>.*<\/title>/, `<title>${h1Title}</title>`);
    const combinedMeta = metaCategory + "\n" + metaDescription + "\n" + metaTags;
    header = header.replace('</head>', combinedMeta + "\n</head>");

    // Sinh phần "Bài viết liên quan"
    const thisTags = rawData[file].tags;
    const related = Object.values(rawData)
      .filter(r => r.url !== rawData[file].url && r.tags.some(t => thisTags.includes(t)))
      .slice(0, 5);
    let relatedHtml = '<section class="related-articles"><h2>Bài viết liên quan</h2><ul>';
    related.forEach(r => {
      relatedHtml += `<li><a href="${r.url}">${r.title}</a></li>`;
    });
    relatedHtml += '</ul></section>';

    // Bọc nội dung và chèn related
    let content = `<main class="article-content">\n${$.html()}\n${relatedHtml}\n</main>`;

    // Ghép header, nội dung bài viết và footer
    let finalHtml = header + "\n" + content + "\n" + footer;

    // Tối ưu ảnh nếu cần
    finalHtml = await convertImages(finalHtml);

    // Lưu bài viết vào thư mục theo category
    const outDir = path.join(rootDir, cat);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    const outPath = path.join(outDir, file);
    fs.writeFileSync(outPath, finalHtml, 'utf8');
    console.log(`✅ Build [${file}] => /${cat}/${file}`);
  }
}
//-----------------------------------------
// 4) gatherCategoryAndTags => quét data => categoriesData, tagsData
//-----------------------------------------
function gatherCategoryAndTags() {
  categoriesData = {};
  tagsData = {};

  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) return;

    fs.readdirSync(dirPath).forEach(file => {
      if (!file.endsWith('.html')) return;
      const filePath = path.join(dirPath, file);
      const html = fs.readFileSync(filePath,'utf8');
      const $ = cheerio.load(html,{ decodeEntities:false });

      const catName = $('meta[name="category"]').attr('content') || cfg.dir;
      const title = $('title').text().trim() || cfg.title;
      const desc = $('meta[name="description"]').attr('content') 
        || $('p').first().text().trim()
        || 'Bài viết phòng sạch';
      let image = $('meta[property="og:image"]').attr('content')
        || $('img').first().attr('src')
        || defaultImage;

      const tagStr = $('meta[name="tags"]').attr('content') || '';
      const tagList = tagStr.split(',').map(t=>t.trim()).filter(Boolean);

      const url = `/${cfg.dir}/${file}`;

      if(!categoriesData[catName]) categoriesData[catName] = [];
      categoriesData[catName].push({ title, description: desc, image, url });

      tagList.forEach(tag => {
        if(!tagsData[tag]) tagsData[tag] = [];
        tagsData[tag].push({ title, description: desc, image, url });
      });
    });
  });
}

//-----------------------------------------
// 5) buildSubCategoryIndexes, buildCategoryTagsIndex, buildMainCategoryFile
//-----------------------------------------
function buildSubCategoryIndexes() {
  const { header, footer } = loadPartials();
  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) return;

    let content = header + "\n" +
      `<section class="py-5">
        <div class="container">
          <h1 class="mb-4 text-center">${cfg.title}</h1>
          <div class="row">`;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html') && f !== 'index.html');
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const rawHtml = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(rawHtml, { decodeEntities: false });
      
      // Lấy phần nội dung bài viết, nếu không có thì lấy body bỏ header, footer
      let articleContent = $('main.article-content');
      if (articleContent.length === 0) {
         articleContent = $('body').clone();
         articleContent.find('header, footer').remove();
      }
      
      const t = $('title').text().trim() || file;
      const d = $('meta[name="description"]').attr('content') || '';
      // Lấy ảnh từ meta og:image hoặc ảnh đầu tiên không chứa "logo"
      let img = articleContent.find('meta[property="og:image"]').attr('content') ||
                articleContent.find('img').filter(function() {
                  const src = $(this).attr('src') || '';
                  return !src.toLowerCase().includes('logo');
                }).first().attr('src') ||
                defaultImage;

      // Sử dụng Bootstrap để hiển thị 3 cột trên mỗi hàng (col-lg-4 cho màn hình lớn, col-md-6 cho màn hình trung)
      content += `
        <div class="col-lg-4 col-md-6 mb-4">
          <a href="./${file}" class="text-decoration-none text-dark">
            <div class="card h-100">
              <img src="${img}" class="card-img-top" alt="${t}">
              <div class="card-body">
                <h5 class="card-title">${t}</h5>
                <p class="card-text">${d}</p>
              </div>
            </div>
          </a>
        </div>`;
    });

    content += `
          </div>
        </div>
      </section>` + "\n" + footer;

    // Áp dụng hàm convertImages cập nhật để chuyển đổi ảnh sang AVIF/WebP (resize nếu cần)
    convertImages(content).then(finalHtml => {
      fs.writeFileSync(path.join(dirPath, 'index.html'), finalHtml, 'utf8');
      console.log(`✅ Danh mục: ${cfg.dir}/index.html`);
    }).catch(err => {
      console.error('❌ Lỗi chuyển đổi ảnh:', err);
    });
  });
}
function buildMainCategoryFile() {
  const { header, footer } = loadPartials();
  let content = header + "\n" +
    `<section class="py-5">
      <div class="container">
        <h1 class="mb-4 text-center">Danh mục bài viết</h1>
        <div class="row">`;

  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) return;

    let img = defaultImage;
    const indexPath = path.join(dirPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      const rawHtml = fs.readFileSync(indexPath, 'utf8');
      const $ = cheerio.load(rawHtml, { decodeEntities: false });
      
      // Lấy phần nội dung bài viết, nếu không có thì loại bỏ header/footer
      let articleContent = $('main.article-content');
      if (articleContent.length === 0) {
         articleContent = $('body').clone();
         articleContent.find('header, footer').remove();
      }
      
      const firstImg = articleContent.find('meta[property="og:image"]').attr('content') ||
                       articleContent.find('img').filter(function() {
                         const src = $(this).attr('src') || '';
                         return !src.toLowerCase().includes('logo');
                       }).first().attr('src');
      if (firstImg) img = firstImg;
    }

    // Hiển thị danh mục theo dạng 3 cột trên mỗi hàng
    content += `
      <div class="col-lg-4 col-md-6 mb-4">
        <a href="/${cfg.dir}/" class="text-decoration-none text-dark">
          <div class="card h-100">
            <img src="${img}" class="card-img-top" alt="${cfg.title}">
            <div class="card-body">
              <h5 class="card-title">${cfg.title}</h5>
            </div>
          </div>
        </a>
      </div>`;
  });

  content += `
        </div>
      </div>
    </section>` + "\n" + footer;

  // Áp dụng chuyển đổi ảnh cập nhật cho trang danh mục chính nếu cần
  convertImages(content).then(finalHtml => {
    fs.writeFileSync(mainCategoryFile, finalHtml, 'utf8');
    console.log('✅ Tạo trang danh mục chính: danh-muc.html');
  }).catch(err => {
    console.error('❌ Lỗi chuyển đổi ảnh:', err);
  });
}


function buildIndexPage(items, outputFile, pageTitle, schemaType) {
  let html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${pageTitle}</title>
  <meta name="description" content="Danh sách ${pageTitle.toLowerCase()}">
  <link rel="stylesheet" href="/style.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "${schemaType}",
    "name": "${pageTitle}",
    "mainEntity": [
      ${Object.entries(items).map(([key, posts]) => `{
        "@type": "ItemList",
        "name": "${key}",
        "itemListElement": [
          ${posts.map((p, i) => `{
            "@type": "ListItem",
            "position": ${i+1},
            "url": "${p.url}",
            "name": "${p.title}"
          }`).join(',\n')}
        ]
      }`).join(',\n')}
    ]
  }
  </script>
</head>
<body>
  <h1>${pageTitle}</h1>
  <div class="category-grid">`;

  Object.entries(items).forEach(([key, posts]) => {
    html += `<section class="category-block">
      <h2>${key}</h2>
      <div class="post-list">`;
    posts.forEach(p => {
      html += `
        <a href="${p.url}" class="post-item">
          <img src="${p.image}" alt="${p.title}">
          <h3>${p.title}</h3>
          <p>${p.description}</p>
        </a>`;
    });
    html += `</div></section>`;
  });

  html += `
  </div>
</body>
</html>`;

  fs.writeFileSync(outputFile, html,'utf8');
  console.log(`✅ ${pageTitle} => ${outputFile.replace(rootDir,'')}`);
}

function buildCategoryTagsIndex() {
  if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir);
  if (!fs.existsSync(tagDir)) fs.mkdirSync(tagDir);

  buildIndexPage(categoriesData, categoryIndexFile, 'Danh mục bài viết', 'CollectionPage');
  buildIndexPage(tagsData, tagIndexFile, 'Thẻ bài viết', 'CollectionPage');
}

function buildMainCategoryFile() {
  let content = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Danh mục bài viết</title>
  <meta name="description" content="Tổng hợp danh mục phòng sạch">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <a class="navbar-brand" href="/">Tuvanphongsach.com</a>
    </div>
  </nav>
  <section class="py-5">
    <div class="container">
      <h1 class="mb-4 text-center">Danh mục bài viết</h1>
      <div class="row">`;

  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) return;

    let img = defaultImage;
    const indexPath = path.join(dirPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath,'utf8');
      const $ = cheerio.load(html);
      const firstImg = $('img').first().attr('src');
      if(firstImg) img = firstImg;
    }

    content += `
        <div class="col-md-4 mb-4">
          <a href="/${cfg.dir}/" class="text-decoration-none text-dark">
            <div class="card h-100">
              <img src="${img}" class="card-img-top" alt="${cfg.title}">
              <div class="card-body">
                <h5 class="card-title">${cfg.title}</h5>
              </div>
            </div>
          </a>
        </div>`;
  });

  content += `
      </div>
    </div>
  </section>
</body>
</html>`;

  fs.writeFileSync(mainCategoryFile, content,'utf8');
  console.log('✅ Tạo trang danh mục chính: danh-muc.html');
}

//-----------------------------------------
// 6) Chèn Meta, OG, Schema
//-----------------------------------------
function injectMeta(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder,file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      injectMeta(filePath);
    } else if (file.endsWith('.html')) {
      let html = fs.readFileSync(filePath,'utf8');
      if (!html.includes('name="viewport"')) {
        const metaInsert = `
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Tuvanphongsach.com - Giải pháp phòng sạch">`;
        html = html.replace(/<head([^>]*)>/i, `<head$1>${metaInsert}`);
        fs.writeFileSync(filePath, html,'utf8');
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
        const title = titleMatch? titleMatch[1].trim():'Tuvanphongsach.com';
        const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
        const desc = descMatch? descMatch[1]:'';
        const matchImg = html.match(/<img[^>]*src="([^"]*)"/);
        const img = matchImg? matchImg[1] : defaultImage;
        const rel = filePath.replace(rootDir,'').replace(/\\/g,'/');
        const ogUrl = BASE_URL + rel;
        const ogTags = `
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${ogUrl}">`;
        html = html.replace('</head>', ogTags + '\n</head>');
        fs.writeFileSync(filePath, html,'utf8');
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
      const schemaPath = path.join(generatedSchemaDir, schemaFileName);
      if (fs.existsSync(schemaPath) && !html.includes('application/ld+json')) {
        const schemaContent = fs.readFileSync(schemaPath,'utf8');
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
// 7) injectBreadcrumbAuto => parse slug
//-----------------------------------------
//-----------------------------------------
// 7) injectBreadcrumbAuto => parse slug, chèn vào <head>
//-----------------------------------------
function injectBreadcrumbAuto(folder) {
  const files = fs.readdirSync(folder);
  files.forEach(file => {
    const filePath = path.join(folder, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      injectBreadcrumbAuto(filePath);
      return;
    }
    if (!file.endsWith('.html')) return;
    if (file === 'header.html' || file === 'footer.html') return;

    let html = fs.readFileSync(filePath, 'utf8');
    if (html.includes('"@type": "BreadcrumbList"')) return;

    // Always item#1: Trang chủ
    const itemList = [{
      "@type": "ListItem",
      "position": 1,
      "name": "Trang chủ",
      "item": BASE_URL + "/"
    }];

    // Tạo đường dẫn tương đối và phân tách slug
    let rel = filePath.replace(rootDir, '').replace(/\\/g, '/');
    if (rel.startsWith('/')) rel = rel.slice(1);
    const parts = rel.split('/');

    parts.forEach((slug, i) => {
      if (slug === 'index.html') return;
      // Build currentUrl
      const currentUrl = BASE_URL + '/' + parts.slice(0, i + 1).join('/');
      const isLast = (i === parts.length - 1 && slug.endsWith('.html'));
      let name;
      if (isLast) {
        // Lấy tên từ <title>
        const match = html.match(/<title>([\s\S]*?)<\/title>/);
        name = match ? match[1].trim() : slug.replace('.html', '');
      } else {
        // Thư mục: tìm trong categoryConfigs
        const found = categoryConfigs.find(c => c.dir === slug);
        name = found ? found.title : slug;
      }
      itemList.push({
        "@type": "ListItem",
        "position": itemList.length + 1,
        "name": name,
        "item": isLast ? currentUrl : currentUrl + '/'
      });
    });

    const breadcrumbJSON = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": itemList
    };
    const snippet = `
<script type="application/ld+json">
${JSON.stringify(breadcrumbJSON, null, 2)}
</script>`;

    // Chèn trước </head>, nếu không có head thì prepend
    if (html.includes('</head>')) {
      html = html.replace('</head>', snippet + '\n</head>');
    } else {
      html = snippet + '\n' + html;
    }

    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ [Breadcrumb Auto] => ${filePath.replace(rootDir, '')}`);
  });
}

//-----------------------------------------
// 8) buildAllArticles
//-----------------------------------------
async function buildAllArticles() {
  // 0) Thu thập metadata
  const rawData = gatherRawArticles();

  // 1) build articles (có Related)
  await buildArticles(rawData);

  // 2) gather => build subcat => build cat/tags => build main
  gatherCategoryAndTags();
  buildSubCategoryIndexes();
  buildCategoryTagsIndex();
  buildMainCategoryFile();

  // 3) chèn meta, OG, schema
  injectMeta(rootDir);
  injectOpenGraph(rootDir);
  injectSchema(rootDir);

  // 4) breadcrumb
  injectBreadcrumbAuto(rootDir);

  console.log('\n🎯 Hoàn tất build bài viết + SEO + breadcrumb!\n');
}

// RUN
buildAllArticles().catch(err => console.error(err));
