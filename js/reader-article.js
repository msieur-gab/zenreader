/**
 * ZenKeeper - Article Reader Module
 * Renders article HTML content with progress tracking
 */

import * as ui from './ui.js';

let container = null;
let contentElement = null;
let onNavigateCallback = null;
let scrollTimeout = null;

/**
 * Initialize the article reader
 * @param {string} content - HTML content
 * @param {Object} options - Reader options
 * @returns {Promise<Object>} Reader metadata
 */
export async function initArticle(content, options = {}) {
  container = ui.elements.viewerContainer;

  // Clear container
  container.innerHTML = '';

  // Create content wrapper
  contentElement = document.createElement('div');
  contentElement.className = 'article-content';
  contentElement.innerHTML = content;

  // Apply theme
  applyTheme(ui.state.theme);

  // Append to container
  container.appendChild(contentElement);

  // Store callback
  onNavigateCallback = options.onNavigate;

  // Setup scroll tracking
  setupScrollTracking();

  // Restore scroll position if provided
  if (options.scrollPosition) {
    requestAnimationFrame(() => {
      const scrollTop = (options.scrollPosition / 100) * getMaxScroll();
      container.scrollTop = scrollTop;
    });
  }

  // Calculate reading stats
  const text = contentElement.textContent || '';
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  return {
    metadata: {
      wordCount
    },
    totalPages: 100 // Use percentage as "pages"
  };
}

/**
 * Get maximum scroll value
 * @returns {number}
 */
function getMaxScroll() {
  if (!container || !contentElement) return 1;
  return Math.max(1, contentElement.scrollHeight - container.clientHeight);
}

/**
 * Get current scroll percentage
 * @returns {number}
 */
function getScrollPercentage() {
  if (!container) return 0;
  const maxScroll = getMaxScroll();
  if (maxScroll <= 0) return 100;
  return Math.round((container.scrollTop / maxScroll) * 100);
}

/**
 * Setup scroll event tracking
 */
function setupScrollTracking() {
  if (!container) return;

  container.addEventListener('scroll', handleScroll, { passive: true });
}

/**
 * Handle scroll events with debouncing
 */
function handleScroll() {
  // Clear existing timeout
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  // Update UI immediately
  const percentage = getScrollPercentage();
  ui.updatePageInfo(percentage, 100);

  // Debounce the callback to avoid too many saves
  scrollTimeout = setTimeout(() => {
    if (onNavigateCallback) {
      onNavigateCallback({
        scrollPosition: container.scrollTop,
        percentage: percentage
      });
    }
  }, 500);
}

/**
 * Apply theme to content
 * @param {string} theme - 'light' or 'dark'
 */
export function applyTheme(theme) {
  if (!contentElement) return;
  contentElement.dataset.theme = theme;
}

/**
 * Set theme
 * @param {string} theme - 'light' or 'dark'
 */
export function setTheme(theme) {
  applyTheme(theme);
}

/**
 * Set font size
 * @param {number} size - Font size percentage
 */
export function setFontSize(size) {
  if (!contentElement) return;
  contentElement.style.fontSize = `${size}%`;
}

/**
 * Scroll to a specific position
 * @param {number} percentage - Scroll percentage (0-100)
 */
export function scrollTo(percentage) {
  if (!container) return;
  const scrollTop = (percentage / 100) * getMaxScroll();
  container.scrollTo({
    top: scrollTop,
    behavior: 'smooth'
  });
}

/**
 * Get current scroll position
 * @returns {number} Scroll percentage
 */
export function getCurrentPosition() {
  return getScrollPercentage();
}

/**
 * Scroll to next "page" (viewport height)
 */
export function next() {
  if (!container) return;
  container.scrollBy({
    top: container.clientHeight * 0.9,
    behavior: 'smooth'
  });
}

/**
 * Scroll to previous "page" (viewport height)
 */
export function prev() {
  if (!container) return;
  container.scrollBy({
    top: -container.clientHeight * 0.9,
    behavior: 'smooth'
  });
}

/**
 * Get selected text
 * @returns {string|null}
 */
export function getSelectedText() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;
  return selection.toString().trim();
}

/**
 * Clear text selection
 */
export function clearSelection() {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

/**
 * Destroy the reader
 */
export function destroy() {
  if (container) {
    container.removeEventListener('scroll', handleScroll);
    container.innerHTML = '';
  }

  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }

  container = null;
  contentElement = null;
  onNavigateCallback = null;
}
