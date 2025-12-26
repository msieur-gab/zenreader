/**
 * ZenReader - Main Application
 * Coordinates all modules and handles initialization
 */

import * as storage from './storage.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { renderMarkdown } from './markdown.js';
import './components/article-card.js';

// ========================================
// Initialization
// ========================================

/**
 * Initialize the application
 */
async function init() {
  // Register service worker
  await registerServiceWorker();

  // Request persistent storage
  await storage.requestPersistentStorage();

  // Check for share target params
  handleShareTarget();

  // Load library
  await loadLibrary();

  // Attach event listeners
  attachEventListeners();

  // Setup online/offline detection
  setupNetworkDetection();

  // Setup scroll progress tracking
  setupScrollProgress();
}

/**
 * Register the service worker
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered:', registration.scope);
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
}

/**
 * Handle Web Share Target API
 * Check URL params for shared content
 */
function handleShareTarget() {
  const params = new URLSearchParams(window.location.search);
  const sharedUrl = params.get('url');
  const sharedTitle = params.get('title');
  const sharedText = params.get('text');

  // Check if we have shared content
  if (sharedUrl || sharedText) {
    // Extract URL from text if not directly provided
    const urlToSave = sharedUrl || api.extractUrlFromText(sharedText);

    if (urlToSave && api.isValidUrl(urlToSave)) {
      // Open modal with the shared URL
      ui.openAddModal({
        url: urlToSave,
        title: sharedTitle || ''
      });
    }

    // Clean URL without reloading
    window.history.replaceState({}, document.title, '/');
  }
}

// ========================================
// Library Operations
// ========================================

/**
 * Load and render the library
 */
async function loadLibrary() {
  try {
    const articles = await storage.getAllArticles();
    ui.renderLibrary(articles);
  } catch (error) {
    console.error('Failed to load library:', error);
  }
}

/**
 * Add a new article
 * @param {string} url - URL to extract and save
 */
async function addArticle(url) {
  ui.setAddLoading(true);

  try {
    // Extract article content
    const article = await api.extractArticle(url);

    // Save to storage
    await storage.addArticle(
      {
        title: article.title,
        url: article.url,
        author: article.author,
        siteName: article.siteName,
        excerpt: article.excerpt
      },
      article.markdown
    );

    // Refresh library
    await loadLibrary();

    // Close modal
    ui.closeAddModal();
  } catch (error) {
    console.error('Failed to add article:', error);
    ui.showAddError(error.message || 'Failed to extract article');
    ui.setAddLoading(false);
  }
}

/**
 * Open an article in the reader
 * @param {number} id - Article ID
 */
async function openArticle(id) {
  try {
    const article = await storage.getArticle(id);
    const html = renderMarkdown(article.content);
    ui.renderReader(article, html);
  } catch (error) {
    console.error('Failed to open article:', error);
  }
}

/**
 * Delete an article
 * @param {number} id - Article ID
 * @param {string} title - Article title for confirmation
 */
async function deleteArticle(id, title) {
  const confirmed = confirm(`Delete "${title}"?`);
  if (!confirmed) return;

  try {
    await storage.deleteArticle(id);

    // If in reader view, go back to library
    if (ui.state.currentArticleId === id) {
      ui.showLibrary();
    }

    // Refresh library
    await loadLibrary();
  } catch (error) {
    console.error('Failed to delete article:', error);
  }
}

// ========================================
// Event Listeners
// ========================================

/**
 * Attach all event listeners
 */
function attachEventListeners() {
  // Add button
  ui.elements.addBtn.addEventListener('click', () => {
    ui.openAddModal();
  });

  // Modal close buttons
  ui.elements.closeModalBtn.addEventListener('click', () => {
    ui.closeAddModal();
  });

  ui.elements.cancelAddBtn.addEventListener('click', () => {
    ui.closeAddModal();
  });

  // Close modal on backdrop click
  ui.elements.addModal.addEventListener('click', (e) => {
    if (e.target === ui.elements.addModal) {
      ui.closeAddModal();
    }
  });

  // Add form submission
  ui.elements.addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = ui.elements.urlInput.value.trim();
    if (url && api.isValidUrl(url)) {
      await addArticle(url);
    } else {
      ui.showAddError('Please enter a valid URL');
    }
  });

  // Back button
  ui.elements.backBtn.addEventListener('click', () => {
    ui.showLibrary();
  });

  // Delete article button (in reader)
  ui.elements.deleteArticleBtn.addEventListener('click', async () => {
    const id = ui.state.currentArticleId;
    const article = ui.state.articles.find((a) => a.id === id);
    if (article) {
      await deleteArticle(id, article.title);
    }
  });

  // Article card events (delegated)
  document.addEventListener('article-open', (e) => {
    openArticle(e.detail.id);
  });

  document.addEventListener('article-delete', (e) => {
    deleteArticle(e.detail.id, e.detail.title);
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    // Escape to go back or close modal
    if (e.key === 'Escape') {
      if (ui.elements.addModal.open) {
        ui.closeAddModal();
      } else if (ui.state.currentView === 'reader') {
        ui.showLibrary();
      }
    }
  });
}

// ========================================
// Network Detection
// ========================================

/**
 * Setup online/offline detection
 */
function setupNetworkDetection() {
  ui.setOnlineStatus(navigator.onLine);

  window.addEventListener('online', () => {
    ui.setOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    ui.setOnlineStatus(false);
  });
}

// ========================================
// Scroll Progress
// ========================================

/**
 * Setup scroll progress tracking for reader view
 */
function setupScrollProgress() {
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking && ui.state.currentView === 'reader') {
      window.requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

        ui.updateProgress(progress);

        // Save progress to storage
        if (ui.state.currentArticleId && progress > 0) {
          storage.updateProgress(ui.state.currentArticleId, Math.round(progress));

          // Mark as read when scrolled past 90%
          if (progress > 90) {
            storage.markAsRead(ui.state.currentArticleId);
          }
        }

        ticking = false;
      });
      ticking = true;
    }
  });
}

// ========================================
// Start Application
// ========================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
