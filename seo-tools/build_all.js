const { buildAllArticles } = require('./build_article');
const { buildStaticPages } = require('./build_static');
const { generateSitemap } = require('./build_sitemap');

async function buildAll() {
  try {
    console.log('🚀 Bắt đầu build toàn bộ dự án...');
    
    // Build các bài viết
    console.log('📝 Build bài viết...');
    await buildAllArticles();
    
    // Build các trang tĩnh
    console.log('📄 Build trang tĩnh...');
    await buildStaticPages();
    
    // Tạo sitemap
    console.log('🗺️ Tạo sitemap...');
    await generateSitemap();
    
    console.log('🎉 Hoàn tất build toàn bộ dự án!');
  } catch (err) {
    console.error('❌ Lỗi khi build:', err);
  }
}

buildAll();