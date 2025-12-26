/**
 * ZenReader - Main Application
 * Coordinates all modules and handles initialization
 */

import * as storage from './storage.js';
import * as api from './api.js';
import * as ui from './ui.js';
import { initElements } from './ui.js';
import { renderMarkdown } from './markdown.js';
import { initGestures, destroyGestures } from './gestures.js';
import './components/article-card.js';

// ========================================
// Initialization
// ========================================

/**
 * Initialize the application
 */
async function init() {
  // Initialize DOM element references
  initElements();

  // Register service worker
  await registerServiceWorker();

  // Request persistent storage
  await storage.requestPersistentStorage();

  // Load settings
  await loadSettings();

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

  // Setup gestures for reader view
  setupGestures();
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
  ui.setAddLoading(true, 10);
  ui.updateAddProgress(10, 'Fetching article...');

  try {
    // Extract article content
    ui.updateAddProgress(30, 'Extracting content...');
    const article = await api.extractArticle(url);

    // Save to storage
    ui.updateAddProgress(70, 'Saving article...');
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

    // Complete
    ui.updateAddProgress(100, 'Done!');

    // Refresh library
    await loadLibrary();

    // Close modal after brief delay to show completion
    setTimeout(() => {
      ui.closeAddModal();
    }, 300);
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
 * Export an article as markdown
 * @param {number} id - Article ID
 */
async function exportArticle(id) {
  try {
    const article = await storage.getArticle(id);

    // Create markdown content with frontmatter
    const frontmatter = [
      '---',
      `title: "${article.title.replace(/"/g, '\\"')}"`,
      article.author ? `author: "${article.author}"` : null,
      article.siteName ? `source: "${article.siteName}"` : null,
      `url: "${article.url}"`,
      `saved: "${new Date(article.addedAt).toISOString()}"`,
      '---',
      ''
    ].filter(Boolean).join('\n');

    const markdown = frontmatter + article.content;

    // Create blob and download
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${article.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export article:', error);
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

  // Export article button (in reader)
  ui.elements.exportArticleBtn.addEventListener('click', async () => {
    const id = ui.state.currentArticleId;
    if (id) {
      await exportArticle(id);
    }
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
      if (ui.elements.settingsModal.open) {
        ui.closeSettingsModal();
      } else if (ui.elements.addModal.open) {
        ui.closeAddModal();
      } else if (ui.state.currentView === 'reader') {
        ui.showLibrary();
      }
    }
  });

  // Settings button
  ui.elements.settingsBtn.addEventListener('click', () => {
    ui.openSettingsModal();
  });

  // Close settings button
  ui.elements.closeSettingsBtn.addEventListener('click', () => {
    ui.closeSettingsModal();
  });

  // Close settings on backdrop click
  ui.elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === ui.elements.settingsModal) {
      ui.closeSettingsModal();
    }
  });

  // Theme buttons
  ui.elements.themeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.setTheme(btn.dataset.theme);
      saveSettings();
    });
  });

  // Font family buttons
  ui.elements.fontButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.setFontFamily(btn.dataset.font);
      saveSettings();
    });
  });

  // Font size slider
  ui.elements.fontSizeSlider.addEventListener('input', (e) => {
    ui.setFontSize(parseInt(e.target.value, 10));
  });

  ui.elements.fontSizeSlider.addEventListener('change', () => {
    saveSettings();
  });

  // Line height slider
  ui.elements.lineHeightSlider.addEventListener('input', (e) => {
    ui.setLineHeight(parseInt(e.target.value, 10));
  });

  ui.elements.lineHeightSlider.addEventListener('change', () => {
    saveSettings();
  });

  // Settings footer button (reader view)
  ui.elements.settingsFooterBtn?.addEventListener('click', () => {
    ui.openSettingsSheet();
  });

  // Settings sheet backdrop click to close
  ui.elements.settingsSheetBackdrop?.addEventListener('click', () => {
    ui.closeSettingsSheet();
  });

  // Sheet theme buttons
  ui.elements.sheetThemeButtons?.forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.setTheme(btn.dataset.theme);
      saveSettings();
    });
  });

  // Sheet font buttons
  ui.elements.sheetFontButtons?.forEach((btn) => {
    btn.addEventListener('click', () => {
      ui.setFontFamily(btn.dataset.font);
      saveSettings();
    });
  });

  // Sheet font size slider
  ui.elements.sheetFontSizeSlider?.addEventListener('input', (e) => {
    ui.setFontSize(parseInt(e.target.value, 10));
  });

  ui.elements.sheetFontSizeSlider?.addEventListener('change', () => {
    saveSettings();
  });

  // Sheet line height slider
  ui.elements.sheetLineHeightSlider?.addEventListener('input', (e) => {
    ui.setLineHeight(parseInt(e.target.value, 10));
  });

  ui.elements.sheetLineHeightSlider?.addEventListener('change', () => {
    saveSettings();
  });
}

// ========================================
// Settings
// ========================================

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    const savedSettings = await storage.getSetting('readerSettings');
    ui.loadSettings(savedSettings);
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  try {
    await storage.setSetting('readerSettings', ui.state.settings);
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
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
// Gestures
// ========================================

/**
 * Setup gesture handling for reader view
 */
function setupGestures() {
  initGestures(ui.elements.readerContent, {
    onTap: () => {
      // Only toggle UI if sheet is closed
      if (!ui.state.settingsSheetOpen) {
        ui.toggleUI();
      }
    },
    onSwipeUp: () => {
      ui.hideUI();
    },
    onSwipeDown: () => {
      // If sheet is open, close it. Otherwise show UI.
      if (ui.state.settingsSheetOpen) {
        ui.closeSettingsSheet();
      } else {
        ui.showUI();
      }
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
