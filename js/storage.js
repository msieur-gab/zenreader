/**
 * ZenReader - Storage Module
 * Uses Dexie.js for metadata and OPFS for markdown files
 */

// Initialize Dexie database
const db = new Dexie('ZenReaderDB');

db.version(1).stores({
  articles: '++id, title, url, siteName, addedAt, readAt, isRead',
  settings: 'key'
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
 * @param {string} markdown - Article content as markdown
 */
async function saveArticleContent(id, markdown) {
  const dir = await getArticlesDirectory(true);
  const fileName = `${id}.md`;
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(markdown);
  await writable.close();
}

/**
 * Get article content from OPFS
 * @param {number} id - Article ID
 * @returns {Promise<string>} Article markdown content
 */
async function getArticleContent(id) {
  try {
    const dir = await getArticlesDirectory();
    const fileName = `${id}.md`;
    const fileHandle = await dir.getFileHandle(fileName);
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
    const dir = await getArticlesDirectory();
    const fileName = `${id}.md`;
    await dir.removeEntry(fileName);
  } catch (error) {
    console.warn('Could not delete article content:', error);
  }
}

// ========================================
// Article Operations
// ========================================

/**
 * Add a new article to the library
 * @param {Object} metadata - Article metadata
 * @param {string} markdown - Article content as markdown
 * @returns {Promise<number>} The new article ID
 */
export async function addArticle(metadata, markdown) {
  // Calculate word count and reading time
  const wordCount = markdown.split(/\s+/).length;
  const estimatedReadTime = Math.ceil(wordCount / 200); // 200 WPM

  // Add metadata to database
  const id = await db.articles.add({
    title: metadata.title || 'Untitled',
    url: metadata.url,
    author: metadata.author || null,
    siteName: metadata.siteName || null,
    excerpt: metadata.excerpt || '',
    wordCount,
    estimatedReadTime,
    addedAt: Date.now(),
    readAt: null,
    isRead: false,
    progress: 0
  });

  // Save content to OPFS
  await saveArticleContent(id, markdown);

  return id;
}

/**
 * Get all articles from the library
 * @returns {Promise<Array>} Array of article metadata
 */
export async function getAllArticles() {
  return db.articles.orderBy('addedAt').reverse().toArray();
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
  await db.articles.update(id, { readAt: Date.now() });

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
}

/**
 * Mark article as read
 * @param {number} id - Article ID
 */
export async function markAsRead(id) {
  await db.articles.update(id, {
    isRead: true,
    readAt: Date.now()
  });
}

/**
 * Update reading progress
 * @param {number} id - Article ID
 * @param {number} progress - Progress percentage (0-100)
 */
export async function updateProgress(id, progress) {
  await db.articles.update(id, { progress });
}

// ========================================
// Settings Operations
// ========================================

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @param {*} defaultValue - Default value if not found
 * @returns {Promise<*>} Setting value
 */
export async function getSetting(key, defaultValue = null) {
  const setting = await db.settings.get(key);
  return setting ? setting.value : defaultValue;
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {*} value - Setting value
 */
export async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

// ========================================
// Storage Info
// ========================================

/**
 * Get storage usage info
 * @returns {Promise<Object|null>} Storage usage information
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
