/**
 * ZenKeeper - Main Application
 * Entry point that coordinates all modules
 */

// Import modules
import './components/article-card.js';
import * as storage from './storage.js';
import * as ui from './ui.js';
import * as articleReader from './reader-article.js';
import { initGestures, updateCallbacks } from './gestures.js';

// Track current article for download
let currentArticleTitle = null;

// ========================================
// Application State
// ========================================

let currentArticleId = null;

// ========================================
// API Functions
// ========================================

/**
 * Extract article content from URL using Netlify function
 * @param {string} url - Article URL
 * @returns {Promise<Object>} Extracted article data
 */
async function extractArticle(url) {
  const response = await fetch('/.netlify/functions/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to extract article' }));
    throw new Error(error.error || 'Failed to extract article');
  }

  return response.json();
}

// ========================================
// Library Functions
// ========================================

/**
 * Load and display all articles in the library
 */
async function loadLibrary() {
  try {
    const articles = await storage.getAllArticles();
    const grid = ui.elements.articleGrid;

    // Clear existing cards
    grid.innerHTML = '';

    if (articles.length === 0) {
      ui.elements.emptyState.hidden = false;
      return;
    }

    ui.elements.emptyState.hidden = true;

    // Create article cards
    articles.forEach(article => {
      const card = document.createElement('article-card');
      card.setAttribute('article-id', article.id);
      card.setAttribute('title', article.title);
      if (article.author) card.setAttribute('author', article.author);
      if (article.siteName) card.setAttribute('site-name', article.siteName);
      if (article.excerpt) card.setAttribute('excerpt', article.excerpt);
      card.setAttribute('word-count', article.wordCount || 0);
      card.setAttribute('progress', article.progress || 0);
      grid.appendChild(card);
    });
  } catch (error) {
    console.error('Error loading library:', error);
  }
}

/**
 * Handle URL form submission
 * @param {Event} e - Submit event
 */
async function handleUrlSubmit(e) {
  e.preventDefault();

  const urlInput = ui.elements.urlInput;
  const url = urlInput.value.trim();

  if (!url) return;

  // Validate URL
  try {
    new URL(url);
  } catch {
    ui.showToast('Please enter a valid URL');
    return;
  }

  try {
    ui.setLoading('Fetching article...', 10);

    // Check if article already exists
    const existing = await storage.findArticleByUrl(url);
    if (existing) {
      ui.setLoading('Opening saved article...', 50);
      await openArticle(existing.id);
      urlInput.value = '';
      return;
    }

    ui.setLoading('Extracting content...', 30);

    // Extract article from URL
    const articleData = await extractArticle(url);

    ui.setLoading('Saving article...', 70);

    // Save to storage
    const articleId = await storage.addArticle(articleData);

    ui.setLoading('Opening article...', 90);

    // Clear input
    urlInput.value = '';

    // Open the article
    await openArticle(articleId);

  } catch (error) {
    console.error('Error adding article:', error);
    ui.setError('Failed to add article: ' + error.message);
  }
}

/**
 * Open an article for reading
 * @param {number} articleId - Article ID
 */
async function openArticle(articleId) {
  try {
    ui.setLoading('Loading article...', 10);

    // Get article from storage
    const article = await storage.getArticle(articleId);
    currentArticleId = articleId;
    currentArticleTitle = article.title;

    ui.setLoading('Rendering content...', 50);

    // Get saved progress
    const progress = await storage.getProgress(articleId);

    // Initialize reader with markdown content
    const result = await articleReader.initArticle(article.markdown, {
      scrollPosition: progress?.percentage,
      onNavigate: handleNavigation
    });

    // Apply saved theme and font size
    articleReader.setTheme(ui.state.theme);
    articleReader.setFontSize(ui.state.fontSize);

    ui.setLoading('Loading bookmarks...', 80);

    // Get bookmarks
    const bookmarks = await storage.getBookmarks(articleId);

    // Update UI state with headings for TOC
    ui.setReading({
      metadata: {
        title: article.title,
        author: article.author,
        siteName: article.siteName,
        url: article.url
      },
      headings: result.headings || [],
      bookmarks,
      totalPages: 100,
      currentPage: progress?.percentage || 0,
      currentArticleId: articleId
    });

    // Setup gestures
    setupReaderGestures();

  } catch (error) {
    console.error('Error opening article:', error);
    ui.setError('Failed to open article: ' + error.message);
  }
}

/**
 * Handle navigation events from reader
 * @param {Object} data - Navigation data
 */
async function handleNavigation(data) {
  if (!currentArticleId) return;

  // Save progress
  await storage.saveProgress(currentArticleId, {
    scrollPosition: data.scrollPosition,
    percentage: data.percentage
  });

  // Update UI
  ui.updatePageInfo(data.percentage, 100);
}

/**
 * Delete an article
 * @param {number} articleId - Article ID
 * @param {string} title - Article title
 */
async function deleteArticle(articleId, title) {
  const confirmed = await ui.showConfirmDialog(
    'Delete Article',
    `Are you sure you want to delete "${title}"? This cannot be undone.`,
    'Delete'
  );

  if (confirmed) {
    try {
      await storage.deleteArticle(articleId);
      await loadLibrary();
    } catch (error) {
      console.error('Error deleting article:', error);
    }
  }
}

/**
 * Go back to library from reader
 */
function backToLibrary() {
  articleReader.destroy();
  currentArticleId = null;
  currentArticleTitle = null;
  ui.showLibrary();
  loadLibrary();
}

/**
 * Download current article as markdown
 */
async function downloadCurrentArticle() {
  if (!currentArticleId || !currentArticleTitle) return;
  try {
    await storage.downloadArticle(currentArticleId, currentArticleTitle);
    ui.showToast('Article downloaded');
  } catch (error) {
    console.error('Download error:', error);
    ui.showToast('Failed to download article');
  }
}

/**
 * Handle TOC item click
 * @param {string} headingId - The heading ID to scroll to
 */
function goToHeading(headingId) {
  articleReader.scrollToHeading(headingId);
  ui.updateState({ sidebarOpen: false });
}

// ========================================
// Reader Functions
// ========================================

/**
 * Setup gesture callbacks for reader
 */
function setupReaderGestures() {
  updateCallbacks({
    onSwipeLeft: () => articleReader.next(),
    onSwipeRight: () => articleReader.prev()
  });
}

/**
 * Toggle bookmark at current position
 */
async function toggleBookmark() {
  if (!currentArticleId) return;

  const scrollPosition = articleReader.getCurrentPosition();

  // Check if already bookmarked
  const existing = await storage.findBookmark(currentArticleId, scrollPosition);

  if (existing) {
    await storage.deleteBookmark(existing.id);
  } else {
    await storage.addBookmark(currentArticleId, scrollPosition);
  }

  // Refresh bookmarks
  const bookmarks = await storage.getBookmarks(currentArticleId);
  ui.updateState({ bookmarks });
}

/**
 * Navigate to bookmark
 * @param {Object} bookmark - Bookmark data
 */
function goToBookmark(bookmark) {
  articleReader.scrollTo(bookmark.scrollPosition);
  ui.updateState({ sidebarOpen: false });
}

/**
 * Delete bookmark
 * @param {number} bookmarkId - Bookmark ID
 */
async function deleteBookmarkById(bookmarkId) {
  await storage.deleteBookmark(bookmarkId);
  const bookmarks = await storage.getBookmarks(currentArticleId);
  ui.updateState({ bookmarks });
}

/**
 * Change font size
 * @param {number} delta - Change amount
 */
function changeFontSize(delta) {
  ui.changeFontSize(delta);
  articleReader.setFontSize(ui.state.fontSize);
}

// ========================================
// Theme Handling
// ========================================

/**
 * Handle theme change
 */
function handleThemeChange() {
  ui.toggleTheme();

  // Update reader theme if active
  if (ui.state.bookState === 'reading') {
    articleReader.setTheme(ui.state.theme);
  }
}

// ========================================
// Share Target Handler
// ========================================

/**
 * Handle shared URLs (Web Share Target API)
 */
async function handleShareTarget() {
  const params = new URLSearchParams(window.location.search);
  const sharedUrl = params.get('url') || params.get('text');

  if (sharedUrl) {
    // Extract URL from text if needed
    const urlMatch = sharedUrl.match(/https?:\/\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : sharedUrl;

    // Set URL in input and submit
    if (ui.elements.urlInput) {
      ui.elements.urlInput.value = url;
      // Clear URL params
      window.history.replaceState({}, '', '/');
      // Submit the form
      handleUrlSubmit(new Event('submit'));
    }
  }
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
  // URL form submit
  ui.elements.urlForm?.addEventListener('submit', handleUrlSubmit);

  // Theme toggles
  ui.elements.themeToggleLib?.addEventListener('click', handleThemeChange);
  ui.elements.themeToggle?.addEventListener('click', handleThemeChange);

  // Back to library
  ui.elements.backToLibrary?.addEventListener('click', backToLibrary);

  // Sidebar toggle
  ui.elements.sidebarToggle?.addEventListener('click', ui.toggleSidebar);

  // Font size controls
  ui.elements.fontDecrease?.addEventListener('click', () => changeFontSize(-10));
  ui.elements.fontIncrease?.addEventListener('click', () => changeFontSize(10));

  // Bookmark button
  ui.elements.bookmarkBtn?.addEventListener('click', toggleBookmark);

  // Download button
  ui.elements.downloadBtn?.addEventListener('click', downloadCurrentArticle);

  // TOC list events (delegated)
  ui.elements.tocList?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (li?.dataset.headingId) {
      goToHeading(li.dataset.headingId);
    }
  });

  // Page navigation (scroll by viewport)
  ui.elements.prevPage?.addEventListener('click', () => articleReader.prev());
  ui.elements.nextPage?.addEventListener('click', () => articleReader.next());

  // Retry button
  ui.elements.retryBtn?.addEventListener('click', () => {
    if (currentArticleId) {
      openArticle(currentArticleId);
    } else {
      backToLibrary();
    }
  });

  // Article card events (delegated)
  document.addEventListener('article-open', (e) => {
    openArticle(e.detail.id);
  });

  document.addEventListener('article-delete', (e) => {
    deleteArticle(e.detail.id, e.detail.title);
  });

  // Bookmark list events (delegated)
  ui.elements.bookmarkList?.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;

    const deleteBtn = e.target.closest('button');
    if (deleteBtn) {
      deleteBookmarkById(parseInt(li.dataset.id, 10));
    } else if (li.dataset.position) {
      goToBookmark({
        scrollPosition: parseFloat(li.dataset.position)
      });
    }
  });

  // Open source link
  ui.elements.sourceLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = e.target.href;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  });
}

// ========================================
// Initialization
// ========================================

async function init() {
  console.log('ZenKeeper initializing...');

  // Initialize UI
  ui.initUI();

  // Request persistent storage
  try {
    await storage.requestPersistentStorage();
  } catch (error) {
    console.warn('Persistent storage not available');
  }

  // Setup event listeners
  setupEventListeners();

  // Initialize gestures
  initGestures();

  // Load library
  await loadLibrary();

  // Handle shared URLs
  handleShareTarget();

  console.log('ZenKeeper ready!');
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// Start app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
