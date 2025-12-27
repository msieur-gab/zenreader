/**
 * ZenReader - Content Extraction Function
 * Uses @mozilla/readability and jsdom to extract article content
 */

const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
// Node 18+ has native fetch, no need for node-fetch

// Initialize Turndown with ATX-style headings
const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

exports.handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { url } = body;

    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid URL format' })
      };
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ZenReader/1.0; +https://zenreader.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: `Failed to fetch URL: ${response.status} ${response.statusText}`
        })
      };
    }

    const html = await response.text();

    // Parse with jsdom, passing the URL for relative link resolution
    const dom = new JSDOM(html, {
      url: url
    });

    const document = dom.window.document;

    // Extract with Readability
    const reader = new Readability(document, {
      charThreshold: 50
    });

    const article = reader.parse();

    if (!article || !article.content) {
      return {
        statusCode: 422,
        headers,
        body: JSON.stringify({
          error: 'Could not extract article content. The page may not contain readable article text.'
        })
      };
    }

    // Extract metadata
    const metaAuthor = document.querySelector('meta[name="author"]')?.content;
    const metaOgSiteName = document.querySelector('meta[property="og:site_name"]')?.content;
    const metaPublishedTime = document.querySelector('meta[property="article:published_time"]')?.content;

    // Convert HTML content to Markdown
    const markdown = turndown.turndown(article.content);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        title: article.title || 'Untitled',
        author: article.byline || metaAuthor || null,
        markdown: markdown,
        textContent: article.textContent,
        excerpt: article.excerpt || '',
        siteName: article.siteName || metaOgSiteName || parsedUrl.hostname.replace(/^www\./, ''),
        publishedTime: metaPublishedTime || null,
        url: url,
        length: article.length
      })
    };

  } catch (error) {
    console.error('Extraction error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'An unexpected error occurred'
      })
    };
  }
};
