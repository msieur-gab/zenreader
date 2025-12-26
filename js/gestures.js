/**
 * ZenReader - Gesture Handler
 * Handles touch gestures for immersive reading
 */

// Configuration
const SWIPE_THRESHOLD = 50;   // Minimum distance for swipe
const TAP_THRESHOLD = 10;     // Maximum movement for tap
const SWIPE_TIMEOUT = 300;    // Maximum time for swipe gesture (ms)

// Touch tracking state
let touchStartX = null;
let touchStartY = null;
let touchStartTime = null;

// Target element
let gestureTarget = null;

// Callbacks
let onSwipeUp = null;
let onSwipeDown = null;
let onTap = null;

/**
 * Initialize gesture handling on an element
 * @param {HTMLElement} element - Element to attach gestures to
 * @param {Object} callbacks - Gesture callbacks
 */
export function initGestures(element, callbacks = {}) {
  gestureTarget = element;
  onSwipeUp = callbacks.onSwipeUp || null;
  onSwipeDown = callbacks.onSwipeDown || null;
  onTap = callbacks.onTap || null;

  if (element) {
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    // Also handle clicks for desktop
    element.addEventListener('click', handleClick);
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Handle touch start
 * @param {TouchEvent} e
 */
function handleTouchStart(e) {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touchStartTime = Date.now();
}

/**
 * Handle touch move
 * @param {TouchEvent} e
 */
function handleTouchMove(e) {
  // Just tracking, let the page scroll naturally
}

/**
 * Handle touch end
 * @param {TouchEvent} e
 */
function handleTouchEnd(e) {
  if (touchStartX === null || touchStartY === null) return;

  const touch = e.changedTouches[0];
  const deltaX = touchStartX - touch.clientX;
  const deltaY = touchStartY - touch.clientY;
  const deltaTime = Date.now() - touchStartTime;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  // Check if it's a valid gesture (within time limit)
  if (deltaTime > SWIPE_TIMEOUT) {
    resetTouch();
    return;
  }

  // Determine gesture type
  if (absY > SWIPE_THRESHOLD && absY > absX) {
    // Vertical swipe (and more vertical than horizontal)
    if (deltaY > 0) {
      // Swipe up -> hide UI
      if (onSwipeUp) onSwipeUp();
    } else {
      // Swipe down -> show UI
      if (onSwipeDown) onSwipeDown();
    }
    if (e.cancelable) e.preventDefault();
  } else if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD) {
    // It's a tap -> toggle UI
    // But only if not clicking on interactive elements
    const target = e.target;
    if (!isInteractiveElement(target)) {
      if (onTap) onTap();
    }
  }

  resetTouch();
}

/**
 * Handle touch cancel
 */
function handleTouchCancel() {
  resetTouch();
}

/**
 * Reset touch tracking state
 */
function resetTouch() {
  touchStartX = null;
  touchStartY = null;
  touchStartTime = null;
}

/**
 * Handle click for desktop tap detection
 * @param {MouseEvent} e
 */
function handleClick(e) {
  // Only handle clicks directly on the content area, not on interactive elements
  if (!isInteractiveElement(e.target)) {
    // Don't trigger on link clicks
    if (e.target.tagName !== 'A' && !e.target.closest('a')) {
      if (onTap) onTap();
    }
  }
}

/**
 * Check if element is interactive (button, link, input, etc.)
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isInteractiveElement(element) {
  const interactiveTags = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL'];
  const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'textbox'];

  // Check the element and its parents
  let current = element;
  while (current && current !== gestureTarget) {
    if (interactiveTags.includes(current.tagName)) return true;
    if (interactiveRoles.includes(current.getAttribute('role'))) return true;
    if (current.classList.contains('btn')) return true;
    if (current.classList.contains('fab')) return true;
    current = current.parentElement;
  }

  return false;
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} e
 */
function handleKeyDown(e) {
  // Ignore if focused on input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Only handle in reader view (check body attribute)
  if (document.body.dataset.view !== 'reader') return;

  switch (e.key) {
    case 'Escape':
      // Show UI if hidden
      if (onSwipeDown) onSwipeDown();
      break;

    case 'f':
    case 'F':
      // Toggle fullscreen
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      break;
  }
}

/**
 * Update gesture callbacks
 * @param {Object} callbacks - New callbacks
 */
export function updateCallbacks(callbacks) {
  if (callbacks.onSwipeUp !== undefined) onSwipeUp = callbacks.onSwipeUp;
  if (callbacks.onSwipeDown !== undefined) onSwipeDown = callbacks.onSwipeDown;
  if (callbacks.onTap !== undefined) onTap = callbacks.onTap;
}

/**
 * Clean up gesture handling
 */
export function destroyGestures() {
  if (gestureTarget) {
    gestureTarget.removeEventListener('touchstart', handleTouchStart);
    gestureTarget.removeEventListener('touchmove', handleTouchMove);
    gestureTarget.removeEventListener('touchend', handleTouchEnd);
    gestureTarget.removeEventListener('touchcancel', handleTouchCancel);
    gestureTarget.removeEventListener('click', handleClick);
  }

  document.removeEventListener('keydown', handleKeyDown);
  resetTouch();
  gestureTarget = null;
}
