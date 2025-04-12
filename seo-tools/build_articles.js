const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const sharp = require('sharp');

const rootDir = path.resolve(__dirname, '../');
const pagesDir = path.join(rootDir, 'pages');
const partialsDir = path.join(rootDir, 'partials');

const STATIC_FILES = ['home.html', 'gioi-thieu.html', 'lien-he.html', 'dich-vu.html'];

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

let categoriesData = {};
let tagsData = {};

const defaultImage = '/image/default.jpg';
const BASE_URL = 'https://tuvanphongsach.com';

const ARTICLE_RELATED_FILES = [];

function gatherRawArticles() {
  const rawData = {};
  if (!fs.existsSync(pagesDir)) return rawData;
  const files = fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.html') && !STATIC_FILES.includes(f));
  files.forEach(file => {
    const html = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });
    const title = $('h1').first().text().trim() || 'Untitled';
    const tags = ($('meta[name="tags"]').attr('content') || '')
      .split(',').map(t => t.trim()).filter(Boolean);
    const category = $('meta[name="category"]').attr('content') || 'misc';
    const url = `/${category}/${file}`;
    const image = $('img').first().attr('src') || defaultImage;
    rawData[file] = { title, tags, url, category, image };
  });
  return rawData;
}

function loadPartials() {
  const header = fs.readFileSync(path.join(partialsDir, 'header.html'), 'utf8');
  const footer = fs.readFileSync(path.join(partialsDir, 'footer.html'), 'utf8');
  return { header, footer };
}

async function makeWebpAndAvif(inputPath, maxWidth) {
  if (!fs.existsSync(inputPath)) {
    console.error(`[makeWebpAndAvif] File không tồn tại: ${inputPath}`);
    return { webp: null, avif: null };
  }
  const ext = path.extname(inputPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return { webp: null, avif: null };

  try {
    const { dir, name } = path.parse(inputPath);
    const webpPath = path.join(dir, `${name}.webp`);
    const avifPath = path.join(dir, `${name}.avif`);

    let sharpInstance = sharp(inputPath).withMetadata();
    if (maxWidth) {
      sharpInstance = sharpInstance.resize({ width: maxWidth, fit: 'inside', withoutEnlargement: true });
    }

    await sharpInstance.webp({ quality: 90 }).toFile(webpPath);
    await sharpInstance.avif({ quality: 70 }).toFile(avifPath);
    console.log(`[makeWebpAndAvif] Thành công: ${webpPath}, ${avifPath}`);

    // Lấy kích thước của ảnh đã thu nhỏ
    const { width, height } = await sharp(webpPath).metadata();
    return {
      webp: webpPath.replace(rootDir, '').replace(/\\/g, '/'),
      avif: avifPath.replace(rootDir, '').replace(/\\/g, '/'),
      width,
      height
    };
  } catch (err) {
    console.error('[makeWebpAndAvif] Lỗi:', err);
    return { webp: null, avif: null };
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

    // Chiều rộng tối đa cho ảnh bài viết (trừ logo)
    const maxWidth = src.includes('logo') ? null : src.includes('AHU-la-gi.jpg') ? 1000 : 800;

    const { webp, avif, width, height } = await makeWebpAndAvif(realPath, maxWidth);
    if (webp && avif && width && height) {
      const pictureHtml = `
<picture class="article-image">
  <source srcset="${avif}" type="image/avif">
  <source srcset="${webp}" type="image/webp">
  <img src="${src}" alt="${alt}" class="img-fluid rounded" width="${width}" height="${height}" loading="lazy" style="max-width: 100%; height: auto;">
</picture>`;
      // Bọc trong image-container nếu chưa có
      $(el).parent().hasClass('image-container') 
        ? $(el).replaceWith(pictureHtml) 
        : $(el).wrap('<div class="image-container text-center my-4"></div>').replaceWith(pictureHtml);
    } else {
      // Dự phòng nếu chuyển đổi WebP/AVIF thất bại
      const fallbackWidth = maxWidth || 800;
      const fallbackHeight = 'auto';
      $(el).attr('width', fallbackWidth);
      $(el).attr('style', 'max-width: 100%; height: auto;');
      $(el).addClass('img-fluid rounded');
      if (!$(el).parent().hasClass('image-container')) {
        $(el).wrap('<div class="image-container text-center my-4"></div>');
      }
    }
  }
  return $.html();
}

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

    const h1Title = $('h1').first().text().trim() || 'Untitled Article';
    const heroImage = $('img').first().prop('outerHTML') || '';
    $('img').first().remove();
    $('h1').first().remove();

    $('title, meta:not([name="category"]):not([name="tags"]), script[type="application/ld+json"]').remove();

    const thisTags = rawData[file].tags;
    const related = Object.values(rawData)
      .filter(r => r.url !== rawData[file].url && r.tags.some(t => thisTags.includes(t)))
      .slice(0, 5);
    let relatedHtml = '<section class="related-articles"><h2 class="section-title">Bài viết liên quan</h2><div class="row">';
    related.forEach(r => {
      relatedHtml += `
        <div class="col-md-4 mb-3">
          <a href="${r.url}" class="related-card">
            <div class="card">
              <div class="card-body">
                <h3 class="card-title">${r.title}</h3>
              </div>
            </div>
          </a>
        </div>`;
    });
    relatedHtml += '</div></section>';

    const $doc = cheerio.load('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"></head><body></body></html>', { decodeEntities: false });
    
    $doc('head').append(`
      <link rel="stylesheet" href="/style.css">
      <link rel="stylesheet" href="/assets/bootstrap/bootstrap.min.css">
    `);
    $doc('head').append(`<title>${h1Title}</title>`);

    const heroSection = `
      <section class="hero-section">
        <div class="container">
          <div class="row align-items-center">
            <div class="col-md-6">
              <h1 class="hero-title">${h1Title}</h1>
            </div>
            <div class="col-md-6 text-center">
              ${heroImage ? `<div class="hero-image-wrapper">${heroImage}</div>` : '<p>Không có hình ảnh</p>'}
            </div>
          </div>
        </div>
      </section>`;

    $doc('body').append(header);
    $doc('body').append(heroSection);
    $doc('body').append(`<main class="article-content container my-5">\n${$.html()}\n${relatedHtml}\n</main>`);
    $doc('body').append(footer);

    let finalHtml = $doc.html();
    finalHtml = await convertImages(finalHtml);

    const cat = rawData[file].category;
    const outDir = path.join(rootDir, cat);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    const outPath = path.join(outDir, file);
    fs.writeFileSync(outPath, finalHtml, 'utf8');
    ARTICLE_RELATED_FILES.push(outPath);
    console.log(`✅ Build [${file}] => /${cat}/${file}`);
  }
}

function gatherCategoryAndTags() {
  categoriesData = {};
  tagsData = {};

  categoryConfigs.forEach(cfg => {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) return;

    fs.readdirSync(dirPath).forEach(file => {
      if (!file.endsWith('.html')) return;
      const filePath = path.join(dirPath, file);
      const html = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(html, { decodeEntities: false });

      const catName = cfg.dir;
      const title = $('title').text().trim() || cfg.title;
      const desc = $('p').first().text().trim() || 'Bài viết phòng sạch';
      let image = $('img').first().attr('src') || defaultImage;

      const tagStr = $('meta[name="tags"]').attr('content') || '';
      const tagList = tagStr.split(',').map(t => t.trim()).filter(Boolean);

      const url = `/${cfg.dir}/${file}`;

      if (!categoriesData[catName]) categoriesData[catName] = [];
      categoriesData[catName].push({ title, description: desc, image, url });

      tagList.forEach(tag => {
        if (!tagsData[tag]) tagsData[tag] = [];
        tagsData[tag].push({ title, description: desc, image, url });
      });
    });
  });
}

async function buildSubCategoryIndexes() {
  let { header, footer } = loadPartials();
  const rawData = gatherRawArticles();

  for (const cfg of categoryConfigs) {
    const dirPath = path.join(rootDir, cfg.dir);
    if (!fs.existsSync(dirPath)) continue;

    const $doc = cheerio.load('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"></head><body></body></html>', { decodeEntities: false });
    
    $doc('head').append(`
      <link rel="stylesheet" href="/style.css">
      <link rel="stylesheet" href="/assets/bootstrap/bootstrap.min.css">
    `);
    $doc('head').append(`<title>${cfg.title}</title>`);

    let content = `
      <section class="category-hero">
        <div class="container">
          <h1 class="category-title">${cfg.title}</h1>
        </div>
      </section>
      <section class="category-content py-5">
        <div class="container">
          <div class="row">`;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.html') && f !== 'index.html');
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const rawHtml = fs.readFileSync(filePath, 'utf8');
      const $ = cheerio.load(rawHtml, { decodeEntities: false });

      const t = $('title').text().trim() || file;
      const d = $('p').first().text().trim() || '';
      const img = rawData[file]?.image || defaultImage;

      // Tạo phiên bản nhỏ hơn cho ảnh
      const imgPath = path.join(rootDir, img);
      const imgBase = img.replace(/\.[^/.]+$/, ''); // Bỏ đuôi file
      const smallAvif = `${imgBase}-small.avif`;
      const smallWebp = `${imgBase}-small.webp`;
      if (fs.existsSync(imgPath)) {
        await sharp(imgPath).resize({ width: 400, height: 300 }).avif({ quality: 60 }).toFile(path.join(rootDir, smallAvif));
        await sharp(imgPath).resize({ width: 400, height: 300 }).webp({ quality: 80 }).toFile(path.join(rootDir, smallWebp));
      }

      content += `
        <div class="col-lg-4 col-md-6 mb-4">
          <a href="./${file}" class="category-card">
            <div class="card h-100">
              <picture>
                <source media="(max-width: 768px)" srcset="${smallAvif}" type="image/avif">
                <source media="(max-width: 768px)" srcset="${smallWebp}" type="image/webp">
                <source srcset="${imgBase}.avif" type="image/avif">
                <source srcset="${imgBase}.webp" type="image/webp">
                <img src="${img}" class="card-img-top" alt="${t}" loading="lazy">
              </picture>
              <div class="card-body">
                <h2 class="card-title">${t}</h2>
                <p class="card-text">${d.slice(0, 100)}...</p>
              </div>
            </div>
          </a>
        </div>`;
    }

    content += `
          </div>
        </div>
      </section>`;

    $doc('body').append(header);
    $doc('body').append(content);
    $doc('body').append(footer);

    let finalHtml = $doc.html();
    finalHtml = await convertImages(finalHtml);

    const outPath = path.join(dirPath, 'index.html');
    fs.writeFileSync(outPath, finalHtml, 'utf8');
    ARTICLE_RELATED_FILES.push(outPath);
    console.log(`✅ Danh mục: ${cfg.dir}/index.html`);
  }
}

async function buildMainCategoryFile() {
  let { header, footer } = loadPartials();

  const $doc = cheerio.load('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"></head><body></body></html>', { decodeEntities: false });
  $doc('head').append(`
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="/assets/bootstrap/bootstrap.min.css">
  `);
  $doc('head').append(`<title>Danh mục bài viết</title>`);

  let content = `
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
      const rawHtml = fs.readFileSync(indexPath, 'utf8');
      const $ = cheerio.load(rawHtml, { decodeEntities: false });
      const firstImg = $('img').filter(function() {
        return !($(this).attr('src') || '').toLowerCase().includes('logo');
      }).first().attr('src');
      if (firstImg) img = firstImg;
    }

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
    </section>`;

  $doc('body').append(header);
  $doc('body').append(content);
  $doc('body').append(footer);

  let finalHtml = $doc.html();
  finalHtml = await convertImages(finalHtml);

  fs.writeFileSync(mainCategoryFile, finalHtml, 'utf8');
  ARTICLE_RELATED_FILES.push(mainCategoryFile);
  console.log('✅ Tạo trang danh mục chính: danh-muc.html');
}

async function buildIndexPage(items, outputFile, pageTitle) {
  const $doc = cheerio.load('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"></head><body></body></html>', { decodeEntities: false });
  let { header, footer } = loadPartials();
  
  $doc('head').append(`
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="/assets/bootstrap/bootstrap.min.css">
  `);
  $doc('head').append(`<title>${pageTitle}</title>`);

  let html = `
    <section class="py-5">
      <div class="container">
        <h1 class="section-title">${pageTitle}</h1>
        <div class="category-grid">`;

  Object.entries(items).forEach(([key, posts]) => {
    html += `<section class="category-block">
      <h2>${key}</h2>
      <div class="row">`;
    posts.forEach(p => {
      html += `
        <div class="col-md-4 mb-4">
          <a href="${p.url}" class="category-card">
            <div class="card h-100">
              <img src="${p.image}" class="card-img-top" alt="${p.title}">
              <div class="card-body">
                <h3 class="card-title">${p.title}</h3>
                <p class="card-text">${p.description.slice(0, 100)}...</p>
              </div>
            </div>
          </a>
        </div>`;
    });
    html += `</div></section>`;
  });

  html += `</div></div></section>`;

  $doc('body').append(header);
  $doc('body').append(html);
  $doc('body').append(footer);

  let finalHtml = $doc.html();
  finalHtml = await convertImages(finalHtml);

  fs.writeFileSync(outputFile, finalHtml, 'utf8');
  ARTICLE_RELATED_FILES.push(outputFile);
  console.log(`✅ ${pageTitle} => ${outputFile.replace(rootDir, '')}`);
}

async function buildCategoryTagsIndex() {
  if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir);
  if (!fs.existsSync(tagDir)) fs.mkdirSync(tagDir);

  await buildIndexPage(categoriesData, categoryIndexFile, 'Danh mục bài viết');
  await buildIndexPage(tagsData, tagIndexFile, 'Thẻ bài viết');
}

function injectMeta() {
  ARTICLE_RELATED_FILES.forEach(filePath => {
    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    $('meta[name="viewport"], meta[name="description"]').remove();

    const metaInsert = `
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Tuvanphongsach.com - Giải pháp phòng sạch">`;
    $('head').prepend(metaInsert);

    fs.writeFileSync(filePath, $.html(), 'utf8');
    console.log(`✅ [Meta] => ${filePath.replace(rootDir, '')}`);
  });
}

function injectOpenGraph() {
  ARTICLE_RELATED_FILES.forEach(filePath => {
    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    $('meta[property^="og:"]').remove();

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : 'Tuvanphongsach.com';
    const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
    const desc = descMatch ? descMatch[1] : '';
    const matchImg = html.match(/<img[^>]*src="([^"]*)"/);
    const img = matchImg ? matchImg[1] : defaultImage;
    const rel = filePath.replace(rootDir, '').replace(/\\/g, '/');
    const ogUrl = BASE_URL + rel;

    const ogTags = `
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${ogUrl}">`;
    $('head').append(ogTags);

    fs.writeFileSync(filePath, $.html(), 'utf8');
    console.log(`✅ [OG] => ${rel}`);
  });
}

function injectBreadcrumbAuto() {
  ARTICLE_RELATED_FILES.forEach(filePath => {
    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    $('script[type="application/ld+json"]').filter((i, el) => {
      return $(el).html().includes('"BreadcrumbList"');
    }).remove();

    const itemList = [{
      "@type": "ListItem",
      "position": 1,
      "name": "Trang chủ",
      "item": BASE_URL + "/"
    }];

    let rel = filePath.replace(rootDir, '').replace(/\\/g, '/');
    if (rel.startsWith('/')) rel = rel.slice(1);
    const parts = rel.split('/');

    parts.forEach((slug, i) => {
      if (slug === 'index.html' && parts.length === 2) return;
      const currentUrl = BASE_URL + '/' + parts.slice(0, i + 1).join('/');
      const isLast = (i === parts.length - 1 && slug.endsWith('.html'));
      let name;
      if (isLast) {
        const match = html.match(/<title>([\s\S]*?)<\/title>/);
        name = match ? match[1].trim() : slug.replace('.html', '');
      } else {
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

    $('head').prepend(snippet);
    fs.writeFileSync(filePath, $.html(), 'utf8');
    console.log(`✅ [Breadcrumb Auto] => ${filePath.replace(rootDir, '')}`);
  });
}

async function buildAllArticles() {
  ARTICLE_RELATED_FILES.length = 0;

  const rawData = gatherRawArticles();
  await buildArticles(rawData);
  gatherCategoryAndTags();
  await buildSubCategoryIndexes();
  await buildCategoryTagsIndex();
  await buildMainCategoryFile();

  injectMeta();
  injectOpenGraph();
  injectBreadcrumbAuto();

  console.log('\n🎯 Hoàn tất build bài viết!\n');
}

buildAllArticles().catch(err => console.error(err));