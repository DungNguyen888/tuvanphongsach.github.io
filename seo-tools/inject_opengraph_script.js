const fs = require('fs');
const path = require('path');

const domain = 'https://tuvanphongsach.com';
const defaultImage = `${domain}/image/og-image.jpg`;

const rootDir = path.resolve(__dirname, '../');
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
  const htmlPath = path.join(rootDir, file);
  let content = fs.readFileSync(htmlPath, 'utf8');

  if (content.includes('property="og:title"')) return;

  const title = (content.match(/<title>(.*?)<\/title>/) || [])[1] || 'Tuvanphongsach.com';
  const desc = (content.match(/<meta name="description" content="(.*?)"/) || [])[1] || '';

  const ogTags = `
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${defaultImage}">
  <meta property="og:url" content="${domain}/${file}">
  <meta property="og:type" content="website">`;

  content = content.replace('</head>', `${ogTags}\n</head>`);
  fs.writeFileSync(htmlPath, content, 'utf8');
  console.log(`✅ Chèn Open Graph: ${file}`);
});
