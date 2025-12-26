/**
 * ZenReader - Markdown Renderer
 * Simple regex-based markdown to HTML converter
 */

/**
 * Render markdown to HTML
 * @param {string} md - Markdown content
 * @returns {string} HTML content
 */
export function renderMarkdown(md) {
  if (!md) return '';

  let html = md
    // Escape HTML entities (but preserve already-escaped ones from Turndown)
    .replace(/&(?!(amp|lt|gt|quot|#39);)/g, '&amp;')
    .replace(/<(?!\/?(a|img)\s)/g, '&lt;')
    .replace(/(?<!["=])>/g, '&gt;')

    // Code blocks (must be before other rules)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const escaped = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
    })

    // Inline code
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')

    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')

    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')

    // Links (already preserved from HTML)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

    // Images (already preserved from HTML)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')

    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    .replace(/^\*\*\*$/gm, '<hr>')

    // Unordered lists
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')

    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive list items in ul/ol
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Merge consecutive blockquotes
  html = html.replace(/(<blockquote>.*<\/blockquote>\n?)+/g, (match) => {
    const content = match.replace(/<\/?blockquote>/g, ' ').trim();
    return `<blockquote>${content}</blockquote>`;
  });

  // Paragraphs - wrap remaining text blocks
  html = html
    .split('\n\n')
    .map((block) => {
      block = block.trim();
      if (!block) return '';

      // Don't wrap block elements
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr|img|a )/.test(block)) {
        return block;
      }

      // Wrap in paragraph
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}

/**
 * Calculate estimated reading time
 * @param {string} text - Text content
 * @param {number} wordsPerMinute - Reading speed (default 200)
 * @returns {number} Estimated minutes
 */
export function calculateReadingTime(text, wordsPerMinute = 200) {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}
