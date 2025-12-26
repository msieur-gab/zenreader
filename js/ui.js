/**
 * ZenReader - UI Module
 * State management and DOM updates
 */

// ========================================
// DOM Element References
// ========================================

export const elements = {
  // Views
  libraryView: document.getElementById('library-view'),
  readerView: document.getElementById('reader-view'),

  // Library
  articleGrid: document.getElementById('article-grid'),
  emptyState: document.getElementById('empty-state'),

  // Header
  addBtn: document.getElementById('add-btn'),
  settingsBtn: document.getElementById('settings-btn'),

  // Reader
  backBtn: document.getElementById('back-btn'),
  exportArticleBtn: document.getElementById('export-article-btn'),
  deleteArticleBtn: document.getElementById('delete-article-btn'),
  readerTitle: document.getElementById('reader-title'),
  readerSite: document.getElementById('reader-site'),
  readerContent: document.getElementById('reader-content'),
  readerProgress: document.getElementById('reader-progress'),
  progressFill: document.querySelector('.progress-bar__fill'),
  readerHeader: document.querySelector('.reader-header'),

  // Settings Sheet (reader)
  settingsSheet: document.getElementById('settings-sheet'),
  settingsSheetBackdrop: document.getElementById('settings-sheet-backdrop'),
  settingsFab: document.getElementById('settings-fab'),

  // Sheet controls (duplicated from modal)
  sheetThemeButtons: document.querySelectorAll('#settings-sheet .theme-btn'),
  sheetFontButtons: document.querySelectorAll('#settings-sheet .font-btn'),
  sheetFontSizeSlider: document.getElementById('sheet-font-size-slider'),
  sheetFontSizeValue: document.getElementById('sheet-font-size-value'),
  sheetLineHeightSlider: document.getElementById('sheet-line-height-slider'),
  sheetLineHeightValue: document.getElementById('sheet-line-height-value'),

  // Modal
  addModal: document.getElementById('add-modal'),
  addForm: document.getElementById('add-form'),
  urlInput: document.getElementById('url-input'),
  detectedTitle: document.getElementById('detected-title'),
  addError: document.getElementById('add-error'),
  closeModalBtn: document.getElementById('close-modal-btn'),
  cancelAddBtn: document.getElementById('cancel-add-btn'),
  saveAddBtn: document.getElementById('save-add-btn'),

  // Offline indicator
  offlineIndicator: document.getElementById('offline-indicator'),

  // Settings Modal
  settingsModal: document.getElementById('settings-modal'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  themeButtons: document.querySelectorAll('.theme-btn'),
  fontButtons: document.querySelectorAll('.font-btn'),
  fontSizeSlider: document.getElementById('font-size-slider'),
  fontSizeValue: document.getElementById('font-size-value'),
  lineHeightSlider: document.getElementById('line-height-slider'),
  lineHeightValue: document.getElementById('line-height-value')
};

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
  settingsSheetOpen: false,
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
  state.settingsSheetOpen = false;
  elements.readerHeader?.classList.remove('reader-header--hidden');
  elements.settingsSheet?.classList.remove('settings-sheet--open');
  elements.settingsSheetBackdrop?.classList.remove('sheet-backdrop--visible');
  elements.settingsFab?.classList.remove('fab--hidden');

  document.body.dataset.view = 'library';
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

  document.body.dataset.view = 'reader';
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
  elements.progressFill.style.width = `${value}%`;
  elements.readerProgress.setAttribute('aria-valuenow', value);
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
  elements.detectedTitle.textContent = prefill.title || '';
  elements.detectedTitle.hidden = !prefill.title;
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
  elements.detectedTitle.hidden = true;
  elements.addError.hidden = true;
  setAddLoading(false);
}

/**
 * Set loading state for add modal
 * @param {boolean} loading - Whether loading
 */
export function setAddLoading(loading) {
  state.isLoading = loading;
  elements.saveAddBtn.disabled = loading;
  elements.urlInput.disabled = loading;

  const btnText = elements.saveAddBtn.querySelector('.btn__text');
  const btnLoading = elements.saveAddBtn.querySelector('.btn__loading');

  btnText.hidden = loading;
  btnLoading.hidden = !loading;
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
  elements.offlineIndicator.hidden = online;
}

// ========================================
// Settings Modal
// ========================================

/**
 * Open the settings modal
 */
export function openSettingsModal() {
  updateSettingsUI();
  elements.settingsModal.showModal();
}

/**
 * Close the settings modal
 */
export function closeSettingsModal() {
  elements.settingsModal.close();
}

/**
 * Update settings UI to reflect current state
 */
export function updateSettingsUI() {
  // Theme buttons
  elements.themeButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
  });

  // Font buttons
  elements.fontButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.font === state.settings.fontFamily);
  });

  // Font size slider
  elements.fontSizeSlider.value = state.settings.fontSize;
  elements.fontSizeValue.textContent = `${state.settings.fontSize}%`;

  // Line height slider
  elements.lineHeightSlider.value = state.settings.lineHeight;
  const lineHeightLabels = { 140: 'Compact', 160: 'Tight', 180: 'Normal', 200: 'Relaxed', 220: 'Loose' };
  elements.lineHeightValue.textContent = lineHeightLabels[state.settings.lineHeight] || 'Normal';

  // Also update sheet UI
  updateSheetUI();
}

/**
 * Apply current settings to the document
 */
export function applySettings() {
  const { theme, fontSize, fontFamily, lineHeight } = state.settings;

  // Apply theme
  document.documentElement.dataset.theme = theme === 'light' ? '' : theme;
  if (theme === 'light') {
    delete document.documentElement.dataset.theme;
  }

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
  elements.readerHeader?.classList.add('reader-header--hidden');
  // Also close settings sheet if open
  if (state.settingsSheetOpen) {
    closeSettingsSheet();
  }
}

/**
 * Show UI (exit immersive mode)
 */
export function showUI() {
  state.uiHidden = false;
  elements.readerHeader?.classList.remove('reader-header--hidden');
}

// ========================================
// Settings Sheet (Reader)
// ========================================

/**
 * Open the settings sheet
 */
export function openSettingsSheet() {
  state.settingsSheetOpen = true;
  updateSheetUI();
  elements.settingsSheet?.classList.add('settings-sheet--open');
  elements.settingsSheetBackdrop?.classList.add('sheet-backdrop--visible');
  elements.settingsFab?.classList.add('fab--hidden');
}

/**
 * Close the settings sheet
 */
export function closeSettingsSheet() {
  state.settingsSheetOpen = false;
  elements.settingsSheet?.classList.remove('settings-sheet--open');
  elements.settingsSheetBackdrop?.classList.remove('sheet-backdrop--visible');
  elements.settingsFab?.classList.remove('fab--hidden');
}

/**
 * Toggle the settings sheet
 */
export function toggleSettingsSheet() {
  if (state.settingsSheetOpen) {
    closeSettingsSheet();
  } else {
    openSettingsSheet();
  }
}

/**
 * Update sheet UI to reflect current settings state
 */
export function updateSheetUI() {
  // Theme buttons
  elements.sheetThemeButtons?.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === state.settings.theme);
  });

  // Font buttons
  elements.sheetFontButtons?.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.font === state.settings.fontFamily);
  });

  // Font size slider
  if (elements.sheetFontSizeSlider) {
    elements.sheetFontSizeSlider.value = state.settings.fontSize;
  }
  if (elements.sheetFontSizeValue) {
    elements.sheetFontSizeValue.textContent = `${state.settings.fontSize}%`;
  }

  // Line height slider
  if (elements.sheetLineHeightSlider) {
    elements.sheetLineHeightSlider.value = state.settings.lineHeight;
  }
  if (elements.sheetLineHeightValue) {
    const lineHeightLabels = { 140: 'Compact', 160: 'Tight', 180: 'Normal', 200: 'Relaxed', 220: 'Loose' };
    elements.sheetLineHeightValue.textContent = lineHeightLabels[state.settings.lineHeight] || 'Normal';
  }
}
