/**
 * ZenReader - UI Module
 * State management and DOM updates
 */

// ========================================
// DOM Element References
// ========================================

// Elements container - initialized after DOM ready
export const elements = {};

/**
 * Initialize DOM element references
 * Must be called after DOM is ready
 */
export function initElements() {
  // Views
  elements.libraryView = document.getElementById('library-view');
  elements.readerView = document.getElementById('reader-view');

  // Library
  elements.articleGrid = document.getElementById('article-grid');
  elements.emptyState = document.getElementById('empty-state');

  // Library header
  elements.themeToggleBtn = document.getElementById('theme-toggle-btn');
  elements.addBtn = document.getElementById('add-btn');

  // Reader header
  elements.readerHeader = document.getElementById('reader-header');
  elements.backBtn = document.getElementById('back-btn');
  elements.readerTitle = document.getElementById('reader-title');
  elements.readerSite = document.getElementById('reader-site');
  elements.settingsBtn = document.getElementById('settings-btn');
  elements.exportBtn = document.getElementById('export-btn');
  elements.deleteBtn = document.getElementById('delete-btn');

  // Reader content
  elements.readerContent = document.getElementById('reader-content');
  elements.readerProgress = document.getElementById('reader-progress');
  elements.progressFill = document.querySelector('.progress-bar__fill');

  // Sidebar (settings)
  elements.sidebar = document.getElementById('sidebar');
  elements.sidebarBackdrop = document.getElementById('sidebar-backdrop');
  elements.closeSidebarBtn = document.getElementById('close-sidebar-btn');

  // Sidebar controls
  elements.themeButtons = document.querySelectorAll('.sidebar .theme-btn');
  elements.fontButtons = document.querySelectorAll('.sidebar .font-btn');
  elements.fontSizeSlider = document.getElementById('font-size-slider');
  elements.fontSizeValue = document.getElementById('font-size-value');
  elements.lineHeightSlider = document.getElementById('line-height-slider');
  elements.lineHeightValue = document.getElementById('line-height-value');

  // Add Modal
  elements.addModal = document.getElementById('add-modal');
  elements.addForm = document.getElementById('add-form');
  elements.urlInput = document.getElementById('url-input');
  elements.statusText = document.getElementById('status-text');
  elements.addProgress = document.getElementById('add-progress');
  elements.addProgressFill = document.querySelector('.add-progress__fill');
  elements.addError = document.getElementById('add-error');
  elements.closeModalBtn = document.getElementById('close-modal-btn');
  elements.cancelBtn = document.getElementById('cancel-btn');
  elements.saveBtn = document.getElementById('save-btn');

  // Offline indicator
  elements.offlineIndicator = document.getElementById('offline-indicator');
}

// ========================================
// State
// ========================================

export const state = {
  currentView: 'library',
  currentArticleId: null,
  articles: [],
  isLoading: false,
  isOnline: navigator.onLine,
  uiHidden: false,
  sidebarOpen: false,
  settings: {
    theme: 'light',
    fontSize: 100,
    fontFamily: 'serif',
    lineHeight: 180
  }
};

// ========================================
// View Management
// ========================================

/**
 * Show the library view
 */
export function showLibrary() {
  state.currentView = 'library';
  state.currentArticleId = null;

  // Reset reader state
  state.uiHidden = false;
  state.sidebarOpen = false;
  elements.readerHeader?.classList.remove('reader__header--hidden');
  elements.sidebar?.classList.remove('sidebar--open');
  elements.sidebarBackdrop?.classList.remove('sidebar__backdrop--visible');

  elements.libraryView.hidden = false;
  elements.readerView.hidden = true;

  // Reset progress bar
  updateProgress(0);
}

/**
 * Show the reader view
 */
export function showReader() {
  state.currentView = 'reader';

  elements.libraryView.hidden = true;
  elements.readerView.hidden = false;

  // Scroll to top
  window.scrollTo(0, 0);
}

// ========================================
// Library Rendering
// ========================================

/**
 * Render the article grid
 * @param {Array} articles - Array of article metadata
 */
export function renderLibrary(articles) {
  state.articles = articles;

  // Clear existing cards
  elements.articleGrid.innerHTML = '';

  if (articles.length === 0) {
    elements.emptyState.hidden = false;
    return;
  }

  elements.emptyState.hidden = true;

  // Create article cards
  articles.forEach((article) => {
    const card = document.createElement('article-card');
    card.setAttribute('article-id', article.id);
    card.setAttribute('title', article.title);
    card.setAttribute('site', article.siteName || '');
    card.setAttribute('read-time', article.estimatedReadTime || '?');
    card.setAttribute('is-read', article.isRead ? 'true' : 'false');
    card.setAttribute('excerpt', article.excerpt || '');
    card.setAttribute('saved-at', article.addedAt || '');
    elements.articleGrid.appendChild(card);
  });
}

// ========================================
// Reader Rendering
// ========================================

/**
 * Render article in reader view
 * @param {Object} article - Article with content
 * @param {string} renderedHtml - Rendered HTML from markdown
 */
export function renderReader(article, renderedHtml) {
  state.currentArticleId = article.id;

  elements.readerTitle.textContent = article.title;
  elements.readerSite.textContent = article.siteName || '';
  elements.readerContent.innerHTML = renderedHtml;

  showReader();
}

/**
 * Update reading progress
 * @param {number} percentage - Progress percentage (0-100)
 */
export function updateProgress(percentage) {
  const value = Math.min(100, Math.max(0, percentage));
  if (elements.progressFill) {
    elements.progressFill.style.width = `${value}%`;
  }
  if (elements.readerProgress) {
    elements.readerProgress.setAttribute('aria-valuenow', value);
  }
}

// ========================================
// Modal Management
// ========================================

/**
 * Open the add modal
 * @param {Object} prefill - Optional prefill data { url, title }
 */
export function openAddModal(prefill = {}) {
  elements.urlInput.value = prefill.url || '';
  if (elements.statusText) {
    elements.statusText.textContent = prefill.title || '';
    elements.statusText.hidden = !prefill.title;
  }
  elements.addError.hidden = true;
  elements.addError.textContent = '';

  elements.addModal.showModal();
  elements.urlInput.focus();
}

/**
 * Close the add modal
 */
export function closeAddModal() {
  elements.addModal.close();
  elements.addForm.reset();
  if (elements.statusText) {
    elements.statusText.hidden = true;
  }
  elements.addError.hidden = true;
  setAddLoading(false);
}

/**
 * Set loading state for add modal
 * @param {boolean} loading - Whether loading
 * @param {number} progress - Optional progress percentage (0-100)
 */
export function setAddLoading(loading, progress = 0) {
  state.isLoading = loading;
  elements.saveBtn.disabled = loading;
  elements.urlInput.disabled = loading;
  elements.cancelBtn.disabled = loading;

  // Show/hide progress bar
  if (elements.addProgress) {
    elements.addProgress.hidden = !loading;
  }

  // Update progress
  if (elements.addProgressFill) {
    elements.addProgressFill.style.width = `${progress}%`;
  }

  // Update button text
  elements.saveBtn.textContent = loading ? 'Saving...' : 'Save';
}

/**
 * Update add progress
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} status - Optional status text
 */
export function updateAddProgress(progress, status = '') {
  if (elements.addProgressFill) {
    elements.addProgressFill.style.width = `${progress}%`;
  }
  if (status && elements.statusText) {
    elements.statusText.textContent = status;
    elements.statusText.hidden = false;
  }
}

/**
 * Show error in add modal
 * @param {string} message - Error message
 */
export function showAddError(message) {
  elements.addError.textContent = message;
  elements.addError.hidden = false;
}

// ========================================
// Offline Indicator
// ========================================

/**
 * Update online/offline status
 * @param {boolean} online - Whether online
 */
export function setOnlineStatus(online) {
  state.isOnline = online;
  if (elements.offlineIndicator) {
    elements.offlineIndicator.hidden = online;
  }
}

// ========================================
// Sidebar (Settings)
// ========================================

/**
 * Open the sidebar
 */
export function openSidebar() {
  state.sidebarOpen = true;
  updateSettingsUI();
  elements.sidebar?.classList.add('sidebar--open');
  elements.sidebarBackdrop?.classList.add('sidebar__backdrop--visible');
}

/**
 * Close the sidebar
 */
export function closeSidebar() {
  state.sidebarOpen = false;
  elements.sidebar?.classList.remove('sidebar--open');
  elements.sidebarBackdrop?.classList.remove('sidebar__backdrop--visible');
}

/**
 * Toggle the sidebar
 */
export function toggleSidebar() {
  if (state.sidebarOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

/**
 * Update settings UI to reflect current state
 */
export function updateSettingsUI() {
  // Theme buttons
  elements.themeButtons?.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
  });

  // Font buttons
  elements.fontButtons?.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.font === state.settings.fontFamily);
  });

  // Font size slider
  if (elements.fontSizeSlider) {
    elements.fontSizeSlider.value = state.settings.fontSize;
  }
  if (elements.fontSizeValue) {
    elements.fontSizeValue.textContent = `${state.settings.fontSize}%`;
  }

  // Line height slider
  if (elements.lineHeightSlider) {
    elements.lineHeightSlider.value = state.settings.lineHeight;
  }
  if (elements.lineHeightValue) {
    const lineHeightLabels = { 140: 'Compact', 160: 'Tight', 180: 'Normal', 200: 'Relaxed', 220: 'Loose' };
    elements.lineHeightValue.textContent = lineHeightLabels[state.settings.lineHeight] || 'Normal';
  }
}

/**
 * Apply current settings to the document
 */
export function applySettings() {
  const { theme, fontSize, fontFamily, lineHeight } = state.settings;

  // Apply theme
  document.body.dataset.theme = theme;

  // Apply reader styles
  const readerFontSize = (fontSize / 100) * 1.125; // Base is 1.125rem
  document.documentElement.style.setProperty('--reader-font-size', `${readerFontSize}rem`);
  document.documentElement.style.setProperty('--reader-line-height', lineHeight / 100);
  document.documentElement.style.setProperty(
    '--font-serif',
    fontFamily === 'sans' ? 'var(--font-sans)' : "Georgia, 'Times New Roman', serif"
  );
}

/**
 * Set theme
 * @param {string} theme - Theme name (light, dark, sepia)
 */
export function setTheme(theme) {
  state.settings.theme = theme;
  applySettings();
  updateSettingsUI();
}

/**
 * Set font family
 * @param {string} fontFamily - Font family (serif, sans)
 */
export function setFontFamily(fontFamily) {
  state.settings.fontFamily = fontFamily;
  applySettings();
  updateSettingsUI();
}

/**
 * Set font size
 * @param {number} fontSize - Font size percentage (75-150)
 */
export function setFontSize(fontSize) {
  state.settings.fontSize = fontSize;
  applySettings();
  updateSettingsUI();
}

/**
 * Set line height
 * @param {number} lineHeight - Line height percentage (140-220)
 */
export function setLineHeight(lineHeight) {
  state.settings.lineHeight = lineHeight;
  applySettings();
  updateSettingsUI();
}

/**
 * Load settings from storage
 * @param {Object} savedSettings - Settings object from storage
 */
export function loadSettings(savedSettings) {
  if (savedSettings) {
    state.settings = { ...state.settings, ...savedSettings };
  }
  applySettings();
}

// ========================================
// Immersive Mode
// ========================================

/**
 * Toggle UI visibility (header)
 */
export function toggleUI() {
  if (state.uiHidden) {
    showUI();
  } else {
    hideUI();
  }
}

/**
 * Hide UI (enter immersive mode)
 */
export function hideUI() {
  state.uiHidden = true;
  elements.readerHeader?.classList.add('reader__header--hidden');
  // Also close sidebar if open
  if (state.sidebarOpen) {
    closeSidebar();
  }
}

/**
 * Show UI (exit immersive mode)
 */
export function showUI() {
  state.uiHidden = false;
  elements.readerHeader?.classList.remove('reader__header--hidden');
}

// Legacy aliases for compatibility
export const openSettingsSheet = openSidebar;
export const closeSettingsSheet = closeSidebar;
export const toggleSettingsSheet = toggleSidebar;
