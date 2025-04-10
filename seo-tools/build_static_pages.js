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

const metaDescriptions = {
  'home.html': 'Tư vấn phòng sạch đạt chuẩn GMP, ISO. Thiết kế, thi công, bảo trì trọn gói bởi Tuvanphongsach.com - hơn 15 năm kinh nghiệm.',
  'gioi-thieu.html': 'Tuvanphongsach.com - Chuyên gia tư vấn phòng sạch với 15+ năm kinh nghiệm. Đội ngũ kỹ sư tận tâm, giải pháp tối ưu cho doanh nghiệp.',
  'lien-he.html': 'Liên hệ Tuvanphongsach.com để được tư vấn phòng sạch miễn phí. Hỗ trợ thiết kế, thi công, bảo trì đạt chuẩn GMP, ISO.',
  'dich-vu.html': 'Dịch vụ phòng sạch trọn gói: tư vấn, thiết kế, thi công, bảo trì đạt chuẩn GMP, ISO. Giải pháp tối ưu từ Tuvanphongsach.com.'
};

// Load partials
function loadPartials() {
  const header = fs.readFileSync(headerFile, 'utf8');
  const footer = fs.readFileSync(footerFile, 'utf8');
  return { header, footer };
}

// Tối ưu JPEG gốc
async function optimizeJpeg(inputPath) {
  const { dir, name, ext } = path.parse(inputPath);
  const outputPath = path.join(dir, `${name}-opt${ext}`);
  if (!fs.existsSync(inputPath)) {
    console.error(`[optimizeJpeg] File not found: ${inputPath}`);
    return null;
  }
  try {
    await sharp(inputPath)
      .jpeg({ quality: 70, mozjpeg: true })
      .toFile(outputPath);
    console.log(`[optimizeJpeg] Success: ${outputPath} created`);
    return outputPath.replace(rootDir, '').replace(/\\/g, '/');
  } catch (err) {
    console.error('[optimizeJpeg] Error:', err);
    return null;
  }
}

// Resize và chuyển ảnh sang WebP/AVIF
async function makeWebpAndAvif(inputPath, maxWidth, maxHeight, isIcon = false) {
  if (!fs.existsSync(inputPath)) {
    console.error(`[makeWebpAndAvif] File not found: ${inputPath}`);
    return { webp: null, avif: null };
  }
  const ext = path.extname(inputPath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    console.log(`[makeWebpAndAvif] Skipped: ${inputPath} (unsupported format: ${ext})`);
    return { webp: null, avif: null };
  }

  try {
    const { dir, name } = path.parse(inputPath);
    const webpPath = path.join(dir, `${name}.webp`);
    const avifPath = path.join(dir, `${name}.avif`);

    let sharpInstance = sharp(inputPath).withMetadata();
    if (maxWidth && maxHeight && !isIcon) {
      sharpInstance = sharpInstance.resize({ width: maxWidth, height: maxHeight, fit: 'inside' });
    }

    const webpQuality = isIcon ? 80 : 50;
    const avifQuality = isIcon ? 80 : 40;

    await sharpInstance.webp({ quality: webpQuality }).toFile(webpPath);
    await sharpInstance.avif({ quality: avifQuality }).toFile(avifPath);
    console.log(`[makeWebpAndAvif] Success: ${webpPath}, ${avifPath} created`);
    return {
      webp: webpPath.replace(rootDir, '').replace(/\\/g, '/'),
      avif: avifPath.replace(rootDir, '').replace(/\\/g, '/')
    };
  } catch (err) {
    console.error('[makeWebpAndAvif] Error:', err);
    return { webp: null, avif: null };
  }
}

// Convert <img> to <picture>
async function convertImages(html, pageName) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const imgs = $('img');
  console.log(`[convertImages] Found ${imgs.length} <img> tags in ${pageName}`);
  if (imgs.length === 0) return html;

  for (let i = 0; i < imgs.length; i++) {
    const el = imgs[i];
    const src = $(el).attr('src');
    if (!src) {
      console.log(`[convertImages] Skipping: <img> without src in ${pageName}`);
      continue;
    }
    console.log(`[convertImages] Processing: ${src} in ${pageName}`);
    const alt = $(el).attr('alt') || '';
    const realPath = path.join(rootDir, src);

    let maxWidth, maxHeight;
    const isIcon = src.includes('icons/');
    if (isIcon) {
      maxWidth = null;
      maxHeight = null;
    } else if (src.includes('about-us')) {
      maxWidth = 600;
      maxHeight = 400;
    } else if (src.includes('thiet-ke-phong-sach') || src.includes('thi-cong-phong-sach') || src.includes('bao-tri-phong-sach')) {
      maxWidth = 400;
      maxHeight = 300;
    } else if (pageName === 'gioi-thieu.html') {
      maxWidth = 800;
      maxHeight = 600;
    } else if (src.includes('tu-van-phong-sach')) {
      maxWidth = 1200;
      maxHeight = 675;
    } else {
      maxWidth = 1200;
      maxHeight = 800;
    }

    const { webp, avif } = await makeWebpAndAvif(realPath, maxWidth, maxHeight, isIcon);
    const optimizedJpeg = await optimizeJpeg(realPath);

    if (webp && avif) {
      const width = maxWidth || $(el).attr('width') || '';
      const height = maxHeight || $(el).attr('height') || '';
      const isBanner = src.includes('tu-van-phong-sach');
      const pictureHtml = `
<picture>
  <source srcset="${avif}" type="image/avif">
  <source srcset="${webp}" type="image/webp">
  <img src="${optimizedJpeg || src}" alt="${alt}" class="img-fluid${isBanner ? ' banner-img' : ''}" ${width ? `width="${width}"` : ''} ${height ? `height="${height}"` : ''} loading="lazy" fetchpriority="${isBanner ? 'high' : 'auto'}">
</picture>`;
      $(el).replaceWith(pictureHtml);
      console.log(`[convertImages] Converted ${src} to <picture> in ${pageName}`);
    }
  }
  return $.html();
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
    const styles = $raw('head style').html() || '';
    $raw('title, meta:not([name="charset"]), script[type="application/ld+json"]').remove();
    raw = $raw.html();

    let { header, footer } = loadPartials();

    const $doc = cheerio.load('<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"></head><body></body></html>', { decodeEntities: false });
    $doc('head').append(`
      <link rel="stylesheet" href="/style.css">
      <link rel="stylesheet" href="/assets/bootstrap/bootstrap.min.css">
    `);
    if (styles) {
      $doc('head').append(`<style>${styles}</style>`);
    }
    $doc('head').append(`<title>${h1Text}</title>`);

    $doc('body').prepend(header);
    $doc('body').append(raw);
    $doc('body').append(footer);

    let finalHtml = $doc.html();
    finalHtml = await convertImages(finalHtml, file);

    const outName = file === 'home.html' ? 'index.html' : file;
    const outPath = path.join(rootDir, outName);
    fs.writeFileSync(outPath, finalHtml, 'utf8');
    console.log(`✅ Build [${file}] => /${outName}`);
  }

  injectMeta();
  injectOpenGraph();
  injectBreadcrumbAuto();

  console.log('\n🎯 Hoàn tất build trang tĩnh!\n');
}

// Inject Meta
function injectMeta() {
  STATIC_FILES.forEach(file => {
    const outName = file === 'home.html' ? 'index.html' : file;
    const filePath = path.join(rootDir, outName);
    if (!fs.existsSync(filePath)) return;

    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    $('meta[name="viewport"]').remove();
    $('meta[name="description"]').remove();

    $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    const description = metaDescriptions[file] || 'Tuvanphongsach.com - Dịch vụ Tư Vấn Phòng Sạch đạt chuẩn GMP, ISO.';
    $('head').append(`<meta name="description" content="${description}">`);

    fs.writeFileSync(filePath, $.html(), 'utf8');
    console.log(`✅ [Meta] => ${outName}`);
  });
}

// Inject Open Graph
function injectOpenGraph() {
  STATIC_FILES.forEach(file => {
    const outName = file === 'home.html' ? 'index.html' : file;
    const filePath = path.join(rootDir, outName);
    if (!fs.existsSync(filePath)) return;

    let html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html, { decodeEntities: false });

    if ($('meta[property^="og:"]').length === 0) {
      const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1].trim() : 'Tuvanphongsach.com';
      const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
      const description = descMatch ? descMatch[1] : metaDescriptions[file] || 'Tuvanphongsach.com - Dịch vụ Tư Vấn Phòng Sạch.';
      const matchImg = html.match(/<img[^>]*src="([^"]*)"/);
      const img = matchImg ? matchImg[1] : defaultImage;
      const ogUrl = BASE_URL + '/' + outName;

      const ogTags = `
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${ogUrl}">`;
      $('head').append(ogTags);
    }

    fs.writeFileSync(filePath, $.html(), 'utf8');
    console.log(`✅ [OG] => ${outName}`);
  });
}

// Inject Breadcrumb
function injectBreadcrumbAuto() {
  STATIC_FILES.forEach(file => {
    const outName = file === 'home.html' ? 'index.html' : file;
    const filePath = path.join(rootDir, outName);
    if (!fs.existsSync(filePath)) return;

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
    fs.writeFileSync(filePath, $.html(), 'utf8');
    console.log(`✅ [Breadcrumb Auto] => ${outName}`);
  });
}

buildStaticPages().catch(err => console.error('❌ Lỗi build trang:', err));