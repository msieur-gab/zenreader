/**
 * ZenReader - API Module
 * Handles content extraction via Netlify Functions
 */

// Turndown instance for HTML to Markdown conversion
let turndownService = null;

/**
 * Initialize Turndown service
 */
function getTurndown() {
  if (!turndownService) {
    // eslint-disable-next-line no-undef
    turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*'
    });

    // Remove empty elements
    turndownService.addRule('removeEmpty', {
      filter: (node) => {
        return (
          node.nodeType === 1 &&
          !node.textContent.trim() &&
          !node.querySelector('img')
        );
      },
      replacement: () => ''
    });

    // Better image handling
    turndownService.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const alt = node.getAttribute('alt') || '';
        const src = node.getAttribute('src') || '';
        if (!src) return '';
        return `![${alt}](${src})`;
      }
    });
  }
  return turndownService;
}

/**
 * Extract article content from a URL
 * @param {string} url - The URL to extract content from
 * @returns {Promise<Object>} Extracted article data
 */
export async function extractArticle(url) {
  const response = await fetch('/.netlify/functions/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to extract: ${response.status}`);
  }

  const article = await response.json();

  // Convert HTML content to Markdown
  const markdown = getTurndown().turndown(article.content || '');

  return {
    title: article.title || 'Untitled',
    author: article.author || null,
    siteName: article.siteName || extractDomain(url),
    excerpt: article.excerpt || '',
    url: url,
    markdown
  };
}

/**
 * Extract domain name from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name
 */
function extractDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Extract URL from shared text
 * Text from share intents sometimes contains extra text along with the URL
 * @param {string} text - Text that may contain a URL
 * @returns {string|null} Extracted URL or null
 */
export function extractUrlFromText(text) {
  if (!text) return null;
  const urlMatch = text.match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/i);
  return urlMatch ? urlMatch[0] : null;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} Whether the URL is valid
 */
export function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
