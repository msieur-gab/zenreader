/**
 * ZenKeeper - Storage Module
 * Uses Dexie.js for metadata and OPFS for article content
 */

// Initialize Dexie database
const db = new Dexie('ZenKeeperDB');

db.version(1).stores({
  articles: '++id, title, author, siteName, url, wordCount, addedAt, lastReadAt',
  bookmarks: '++id, articleId, scrollPosition, label, createdAt',
  highlights: '++id, articleId, startOffset, endOffset, color, createdAt',
  readingProgress: 'articleId'
});

// ========================================
// OPFS (Origin Private File System) Helpers
// ========================================

/**
 * Get the articles directory handle from OPFS
 * @param {boolean} create - Whether to create the directory if it doesn't exist
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
async function getArticlesDirectory(create = false) {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('articles', { create });
}

/**
 * Save article content to OPFS
 * @param {number} id - Article ID
 * @param {string} content - HTML content
 */
async function saveArticleContent(id, content) {
  const articlesDir = await getArticlesDirectory(true);
  const fileName = `${id}.html`;
  const fileHandle = await articlesDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

/**
 * Get article content from OPFS
 * @param {number} id - Article ID
 * @returns {Promise<string>}
 */
async function getArticleContent(id) {
  try {
    const articlesDir = await getArticlesDirectory();
    const fileName = `${id}.html`;
    const fileHandle = await articlesDir.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return file.text();
  } catch (error) {
    console.error('Error reading article content:', error);
    throw new Error('Article content not found');
  }
}

/**
 * Delete article content from OPFS
 * @param {number} id - Article ID
 */
async function deleteArticleContent(id) {
  try {
    const articlesDir = await getArticlesDirectory();
    const fileName = `${id}.html`;
    await articlesDir.removeEntry(fileName);
  } catch (error) {
    console.warn('Could not delete article content:', error);
  }
}

// ========================================
// Article Operations
// ========================================

/**
 * Add a new article to the library
 * @param {Object} articleData - Article data from extraction
 * @returns {Promise<number>} The new article ID
 */
export async function addArticle(articleData) {
  // Add metadata to database
  const id = await db.articles.add({
    title: articleData.title || 'Untitled',
    author: articleData.author || null,
    siteName: articleData.siteName || null,
    url: articleData.url,
    excerpt: articleData.excerpt || null,
    wordCount: articleData.wordCount || 0,
    publishedTime: articleData.publishedTime || null,
    addedAt: Date.now(),
    lastReadAt: null
  });

  // Save content to OPFS
  await saveArticleContent(id, articleData.content);

  return id;
}

/**
 * Get all articles from the library
 * @returns {Promise<Array>} Array of article metadata
 */
export async function getAllArticles() {
  const articles = await db.articles.orderBy('addedAt').reverse().toArray();

  // Get progress for each article
  const articlesWithProgress = await Promise.all(
    articles.map(async (article) => {
      const progress = await getProgress(article.id);
      return {
        ...article,
        progress: progress ? progress.percentage : 0
      };
    })
  );

  return articlesWithProgress;
}

/**
 * Get a single article with its content
 * @param {number} id - Article ID
 * @returns {Promise<Object>} Article metadata and content
 */
export async function getArticle(id) {
  const article = await db.articles.get(id);
  if (!article) {
    throw new Error('Article not found');
  }

  const content = await getArticleContent(id);

  // Update last read time
  await db.articles.update(id, { lastReadAt: Date.now() });

  return { ...article, content };
}

/**
 * Update article metadata
 * @param {number} id - Article ID
 * @param {Object} updates - Fields to update
 */
export async function updateArticle(id, updates) {
  await db.articles.update(id, updates);
}

/**
 * Delete an article from the library
 * @param {number} id - Article ID
 */
export async function deleteArticle(id) {
  const article = await db.articles.get(id);
  if (!article) return;

  // Delete content from OPFS
  await deleteArticleContent(id);

  // Delete from database
  await db.articles.delete(id);

  // Delete associated bookmarks, highlights, and progress
  await db.bookmarks.where('articleId').equals(id).delete();
  await db.highlights.where('articleId').equals(id).delete();
  await db.readingProgress.delete(id);
}

/**
 * Check if article already exists by URL
 * @param {string} url - Article URL
 * @returns {Promise<Object|null>} Existing article or null
 */
export async function findArticleByUrl(url) {
  return db.articles.where('url').equals(url).first();
}

// ========================================
// Bookmark Operations
// ========================================

/**
 * Add a bookmark
 * @param {number} articleId - Article ID
 * @param {number} scrollPosition - Scroll position (percentage)
 * @param {string} label - Optional label
 * @returns {Promise<number>} Bookmark ID
 */
export async function addBookmark(articleId, scrollPosition, label = '') {
  return db.bookmarks.add({
    articleId,
    scrollPosition,
    label: label || `${Math.round(scrollPosition)}%`,
    createdAt: Date.now()
  });
}

/**
 * Get all bookmarks for an article
 * @param {number} articleId - Article ID
 * @returns {Promise<Array>} Array of bookmarks
 */
export async function getBookmarks(articleId) {
  return db.bookmarks.where('articleId').equals(articleId).toArray();
}

/**
 * Delete a bookmark
 * @param {number} id - Bookmark ID
 */
export async function deleteBookmark(id) {
  await db.bookmarks.delete(id);
}

/**
 * Check if a position is bookmarked
 * @param {number} articleId - Article ID
 * @param {number} scrollPosition - Position to check (with tolerance)
 * @returns {Promise<Object|null>} Bookmark if exists, null otherwise
 */
export async function findBookmark(articleId, scrollPosition) {
  const bookmarks = await getBookmarks(articleId);
  // Find bookmark within 2% tolerance
  return bookmarks.find(b => Math.abs(b.scrollPosition - scrollPosition) < 2) || null;
}

// ========================================
// Highlight Operations
// ========================================

/**
 * Add a highlight
 * @param {number} articleId - Article ID
 * @param {Object} range - Selection range info
 * @param {string} text - Selected text
 * @param {string} color - Highlight color
 * @returns {Promise<number>} Highlight ID
 */
export async function addHighlight(articleId, range, text, color = '#ffeb3b') {
  return db.highlights.add({
    articleId,
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    startContainer: range.startContainer,
    endContainer: range.endContainer,
    text: text.substring(0, 500),
    color,
    createdAt: Date.now()
  });
}

/**
 * Get all highlights for an article
 * @param {number} articleId - Article ID
 * @returns {Promise<Array>} Array of highlights
 */
export async function getHighlights(articleId) {
  return db.highlights.where('articleId').equals(articleId).toArray();
}

/**
 * Update a highlight
 * @param {number} id - Highlight ID
 * @param {Object} updates - Fields to update
 */
export async function updateHighlight(id, updates) {
  await db.highlights.update(id, updates);
}

/**
 * Delete a highlight
 * @param {number} id - Highlight ID
 */
export async function deleteHighlight(id) {
  await db.highlights.delete(id);
}

// ========================================
// Reading Progress Operations
// ========================================

/**
 * Save reading progress
 * @param {number} articleId - Article ID
 * @param {Object} progress - Progress data
 */
export async function saveProgress(articleId, progress) {
  await db.readingProgress.put({
    articleId,
    scrollPosition: progress.scrollPosition || 0,
    percentage: progress.percentage || 0,
    updatedAt: Date.now()
  });
}

/**
 * Get reading progress for an article
 * @param {number} articleId - Article ID
 * @returns {Promise<Object|null>} Progress data or null
 */
export async function getProgress(articleId) {
  return db.readingProgress.get(articleId);
}

// ========================================
// Storage Info
// ========================================

/**
 * Get storage usage info
 * @returns {Promise<Object>} Storage usage information
 */
export async function getStorageInfo() {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage,
      quota: estimate.quota,
      percentage: Math.round((estimate.usage / estimate.quota) * 100)
    };
  }
  return null;
}

/**
 * Request persistent storage
 * @returns {Promise<boolean>} Whether persistent storage was granted
 */
export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist();
  }
  return false;
}

// Export database instance for advanced operations
export { db };
