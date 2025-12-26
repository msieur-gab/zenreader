/**
 * ZenKeeper - UI State Management
 * Handles state and DOM updates
 */

// ========================================
// DOM Element References (Lazy-loaded)
// ========================================

let _elements = null;

export function getElements() {
  if (_elements) return _elements;

  _elements = {
    // Views
    libraryView: document.getElementById('library-view'),
    readerView: document.getElementById('reader-view'),

    // Library
    articleGrid: document.getElementById('article-grid'),
    emptyState: document.getElementById('empty-state'),
    urlForm: document.getElementById('url-form'),
    urlInput: document.getElementById('url-input'),
    themeToggleLib: document.getElementById('theme-toggle-lib'),

    // Reader header
    header: document.getElementById('header'),
    backToLibrary: document.getElementById('back-to-library'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    articleTitle: document.getElementById('article-title'),
    articleAuthor: document.getElementById('article-author'),
    sourceLink: document.getElementById('source-link'),

    // Controls
    fontControls: document.getElementById('font-controls'),
    fontDecrease: document.getElementById('font-decrease'),
    fontLevel: document.getElementById('font-level'),
    fontIncrease: document.getElementById('font-increase'),
    themeToggle: document.getElementById('theme-toggle'),
    bookmarkBtn: document.getElementById('bookmark-btn'),

    // Sidebar
    sidebar: document.getElementById('sidebar'),
    tocList: document.getElementById('toc-list'),
    bookmarkCount: document.getElementById('bookmark-count'),
    bookmarkList: document.getElementById('bookmark-list'),

    // Download
    downloadBtn: document.getElementById('download-btn'),

    // Reader
    reader: document.getElementById('reader'),
    loadingScreen: document.getElementById('loading-screen'),
    loadStatus: document.getElementById('load-status'),
    loadProgress: document.getElementById('load-progress'),
    errorScreen: document.getElementById('error-screen'),
    errorMessage: document.getElementById('error-message'),
    retryBtn: document.getElementById('retry-btn'),
    viewerContainer: document.getElementById('viewer-container'),

    // Page navigation
    pageNav: document.getElementById('page-nav'),
    prevPage: document.getElementById('prev-page'),
    currentPage: document.getElementById('current-page'),
    totalPages: document.getElementById('total-pages'),
    nextPage: document.getElementById('next-page'),

    // Dialog
    confirmDialog: document.getElementById('confirm-dialog'),
    dialogTitle: document.getElementById('dialog-title'),
    dialogMessage: document.getElementById('dialog-message'),
    dialogCancel: document.getElementById('dialog-cancel'),
    dialogConfirm: document.getElementById('dialog-confirm'),

    // Toast
    toast: document.getElementById('toast')
  };

  return _elements;
}

// For backwards compatibility - proxy that calls getElements()
export const elements = new Proxy({}, {
  get(target, prop) {
    return getElements()[prop];
  }
});

// ========================================
// Application State
// ========================================

export const state = {
  // View
  currentView: 'library', // 'library' | 'reader'

  // Theme
  theme: localStorage.getItem('zenkeeper-theme') || 'light',

  // Reader settings
  fontSize: parseInt(localStorage.getItem('zenkeeper-fontSize') || '100', 10),

  // UI state
  sidebarOpen: false,
  uiHidden: false,

  // Article state
  bookState: 'idle', // 'idle' | 'loading' | 'reading' | 'error'
  currentArticleId: null,

  // Loading
  loadStatus: '',
  loadPercent: 0,

  // Article data
  metadata: null,
  headings: [],
  bookmarks: [],
  currentPage: 0,
  totalPages: 100,
  error: null
};

// State change listeners
const listeners = new Set();

/**
 * Subscribe to state changes
 * @param {Function} listener - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Update state and notify listeners
 * @param {Object} updates - State updates
 */
export function updateState(updates) {
  const prevState = { ...state };
  Object.assign(state, updates);

  // Notify listeners
  listeners.forEach(listener => {
    try {
      listener(state, prevState);
    } catch (error) {
      console.error('State listener error:', error);
    }
  });

  // Render UI changes
  render(state, prevState);
}

// ========================================
// UI Rendering
// ========================================

/**
 * Main render function - updates DOM based on state changes
 * @param {Object} current - Current state
 * @param {Object} prev - Previous state
 */
function render(current, prev) {
  const els = getElements();

  // Theme
  if (current.theme !== prev.theme) {
    document.body.dataset.theme = current.theme;
    localStorage.setItem('zenkeeper-theme', current.theme);
  }

  // View switching
  if (current.currentView !== prev.currentView) {
    if (current.currentView === 'library') {
      els.libraryView.hidden = false;
      els.readerView.hidden = true;
    } else {
      els.libraryView.hidden = true;
      els.readerView.hidden = false;
    }
    document.body.dataset.view = current.currentView;
  }

  // Sidebar
  if (current.sidebarOpen !== prev.sidebarOpen) {
    els.sidebar?.classList.toggle('sidebar--open', current.sidebarOpen);
  }

  // UI visibility (immersive mode)
  if (current.uiHidden !== prev.uiHidden) {
    document.body.dataset.uiHidden = current.uiHidden;
  }

  // Article state
  if (current.bookState !== prev.bookState) {
    if (els.loadingScreen) els.loadingScreen.hidden = current.bookState !== 'loading';
    if (els.errorScreen) els.errorScreen.hidden = current.bookState !== 'error';
  }

  // Loading progress
  if (current.loadStatus !== prev.loadStatus && els.loadStatus) {
    els.loadStatus.textContent = current.loadStatus;
  }
  if (current.loadPercent !== prev.loadPercent && els.loadProgress) {
    els.loadProgress.value = current.loadPercent;
  }

  // Error
  if (current.error !== prev.error && current.error && els.errorMessage) {
    els.errorMessage.textContent = current.error;
  }

  // Font size
  if (current.fontSize !== prev.fontSize && els.fontLevel) {
    els.fontLevel.textContent = `${current.fontSize}%`;
    localStorage.setItem('zenkeeper-fontSize', current.fontSize);
  }

  // Metadata
  if (current.metadata !== prev.metadata && current.metadata) {
    if (els.articleTitle) els.articleTitle.textContent = current.metadata.title || 'Untitled';
    if (els.articleAuthor) {
      const authorText = current.metadata.author || current.metadata.siteName || '';
      els.articleAuthor.textContent = authorText;
      els.articleAuthor.hidden = !authorText;
    }
    if (els.sourceLink && current.metadata.url) {
      els.sourceLink.href = current.metadata.url;
      els.sourceLink.hidden = false;
    }
  }

  // Page info (progress percentage)
  if (current.currentPage !== prev.currentPage && els.currentPage) {
    els.currentPage.textContent = `${current.currentPage}%`;
  }

  // Bookmarks
  if (current.bookmarks !== prev.bookmarks) {
    renderBookmarks(current.bookmarks);
  }

  // TOC (headings)
  if (current.headings !== prev.headings) {
    renderTOC(current.headings);
  }
}

/**
 * Render bookmarks list
 * @param {Array} bookmarks - Array of bookmark objects
 */
function renderBookmarks(bookmarks) {
  const els = getElements();
  if (!els.bookmarkCount || !els.bookmarkList) return;

  els.bookmarkCount.textContent = bookmarks.length;
  els.bookmarkList.innerHTML = '';

  if (bookmarks.length === 0) {
    const li = document.createElement('li');
    li.style.color = 'var(--text-muted)';
    li.style.fontSize = '0.75rem';
    li.style.textAlign = 'center';
    li.style.padding = '1rem';
    li.textContent = 'No bookmarks yet';
    els.bookmarkList.appendChild(li);
    return;
  }

  bookmarks.forEach(bookmark => {
    const li = document.createElement('li');
    li.dataset.id = bookmark.id;
    li.dataset.position = bookmark.scrollPosition;
    li.innerHTML = `
      <span>${bookmark.label}</span>
      <button aria-label="Delete bookmark" title="Delete bookmark">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    els.bookmarkList.appendChild(li);
  });
}

/**
 * Render table of contents (headings)
 * @param {Array} headings - Array of heading objects with level, text, id
 */
function renderTOC(headings) {
  const els = getElements();
  if (!els.tocList) return;

  els.tocList.innerHTML = '';

  if (!headings || headings.length === 0) {
    const li = document.createElement('li');
    li.className = 'toc-empty';
    li.textContent = 'No headings found';
    els.tocList.appendChild(li);
    return;
  }

  headings.forEach(heading => {
    const li = document.createElement('li');
    li.className = `toc-item toc-level-${heading.level}`;
    li.dataset.headingId = heading.id;
    li.textContent = heading.text;
    els.tocList.appendChild(li);
  });
}

// ========================================
// UI Actions
// ========================================

/**
 * Toggle theme
 */
export function toggleTheme() {
  updateState({
    theme: state.theme === 'light' ? 'dark' : 'light'
  });
}

/**
 * Toggle sidebar
 */
export function toggleSidebar() {
  updateState({
    sidebarOpen: !state.sidebarOpen
  });
}

/**
 * Toggle UI visibility (immersive mode)
 * @param {boolean|null} forceValue - Force a specific value, or toggle if null
 */
export function toggleUI(forceValue = null) {
  updateState({
    uiHidden: forceValue !== null ? forceValue : !state.uiHidden
  });
}

/**
 * Show UI (exit immersive mode)
 */
export function showUI() {
  updateState({ uiHidden: false });
}

/**
 * Hide UI (enter immersive mode)
 */
export function hideUI() {
  updateState({ uiHidden: true });
}

/**
 * Switch to library view
 */
export function showLibrary() {
  updateState({
    currentView: 'library',
    bookState: 'idle',
    sidebarOpen: false,
    uiHidden: false
  });
}

/**
 * Switch to reader view
 */
export function showReader() {
  updateState({
    currentView: 'reader'
  });
}

/**
 * Set loading state
 * @param {string} status - Loading status message
 * @param {number} percent - Loading percentage (0-100)
 */
export function setLoading(status, percent = 0) {
  updateState({
    currentView: 'reader',
    bookState: 'loading',
    loadStatus: status,
    loadPercent: percent
  });
}

/**
 * Set error state
 * @param {string} message - Error message
 */
export function setError(message) {
  updateState({
    bookState: 'error',
    error: message
  });
}

/**
 * Set reading state with article data
 * @param {Object} data - Article data
 */
export function setReading(data) {
  updateState({
    bookState: 'reading',
    currentView: 'reader',
    ...data
  });
}

/**
 * Update font size
 * @param {number} delta - Change amount
 */
export function changeFontSize(delta) {
  const newSize = Math.max(50, Math.min(200, state.fontSize + delta));
  updateState({ fontSize: newSize });
}

/**
 * Update page info (progress)
 * @param {number} current - Current progress percentage
 * @param {number} total - Total (always 100 for percentage)
 */
export function updatePageInfo(current, total) {
  updateState({
    currentPage: current,
    totalPages: total
  });
}

/**
 * Show toast message
 * @param {string} message - Toast message
 * @param {number} duration - Duration in ms
 */
export function showToast(message, duration = 3000) {
  const els = getElements();
  if (!els.toast) return;

  els.toast.textContent = message;
  els.toast.classList.add('toast--visible');

  setTimeout(() => {
    els.toast.classList.remove('toast--visible');
  }, duration);
}

// ========================================
// Dialog
// ========================================

let dialogResolve = null;

/**
 * Show confirmation dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} confirmText - Confirm button text
 * @returns {Promise<boolean>} Whether user confirmed
 */
export function showConfirmDialog(title, message, confirmText = 'Confirm') {
  const els = getElements();
  if (!els.confirmDialog) return Promise.resolve(false);

  els.dialogTitle.textContent = title;
  els.dialogMessage.textContent = message;
  els.dialogConfirm.textContent = confirmText;
  els.confirmDialog.showModal();

  return new Promise(resolve => {
    dialogResolve = resolve;
  });
}

/**
 * Close dialog with result
 * @param {boolean} confirmed - Whether user confirmed
 */
export function closeDialog(confirmed) {
  const els = getElements();
  if (!els.confirmDialog) return;

  els.confirmDialog.close();
  if (dialogResolve) {
    dialogResolve(confirmed);
    dialogResolve = null;
  }
}

// ========================================
// Initialize
// ========================================

/**
 * Initialize UI with stored preferences
 */
export function initUI() {
  const els = getElements();

  // Apply stored theme
  document.body.dataset.theme = state.theme;

  // Apply font size
  if (els.fontLevel) {
    els.fontLevel.textContent = `${state.fontSize}%`;
  }

  // Setup dialog event listeners
  els.dialogCancel?.addEventListener('click', () => closeDialog(false));
  els.dialogConfirm?.addEventListener('click', () => closeDialog(true));
  els.confirmDialog?.addEventListener('cancel', () => closeDialog(false));
}
