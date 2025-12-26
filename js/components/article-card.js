/**
 * ZenReader - Article Card Web Component
 * Displays an article in the library grid
 */

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
    }

    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 140px;
      padding: 1rem;
      background: var(--bg-secondary, #f8fafc);
      border-radius: var(--radius-lg, 0.75rem);
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0, 0, 0, 0.1));
    }

    .card:active {
      transform: translateY(0);
    }

    .card--read {
      opacity: 0.7;
    }

    .card__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .card__title {
      flex: 1;
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary, #1e293b);
      line-height: 1.4;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .card__delete {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.75rem;
      height: 1.75rem;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 50%;
      color: var(--text-muted, #94a3b8);
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s, background-color 0.2s, color 0.2s;
    }

    .card:hover .card__delete {
      opacity: 1;
    }

    .card__delete:hover {
      background: rgba(239, 68, 68, 0.1);
      color: var(--color-danger, #ef4444);
    }

    .card__delete svg {
      width: 1rem;
      height: 1rem;
    }

    .card__excerpt {
      flex: 1;
      font-size: 0.875rem;
      color: var(--text-secondary, #64748b);
      line-height: 1.5;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      margin-bottom: 0.75rem;
    }

    .card__meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: auto;
      padding-top: 0.75rem;
      border-top: 1px solid var(--bg-tertiary, #e2e8f0);
      font-size: 0.75rem;
      color: var(--text-muted, #94a3b8);
    }

    .card__site {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card__time {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex-shrink: 0;
    }

    .card__icon {
      width: 0.875rem;
      height: 0.875rem;
    }
  </style>

  <article class="card" tabindex="0" role="button">
    <header class="card__header">
      <h3 class="card__title"></h3>
      <button class="card__delete" aria-label="Delete article" title="Delete article">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    </header>
    <p class="card__excerpt"></p>
    <footer class="card__meta">
      <span class="card__site">
        <svg class="card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
        <span class="card__site-name"></span>
      </span>
      <span class="card__time">
        <svg class="card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span class="card__time-value"></span>
      </span>
    </footer>
  </article>
`;

class ArticleCard extends HTMLElement {
  static get observedAttributes() {
    return ['article-id', 'title', 'site', 'read-time', 'is-read', 'excerpt'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    // Cache DOM elements
    this._card = this.shadowRoot.querySelector('.card');
    this._title = this.shadowRoot.querySelector('.card__title');
    this._excerpt = this.shadowRoot.querySelector('.card__excerpt');
    this._siteName = this.shadowRoot.querySelector('.card__site-name');
    this._timeValue = this.shadowRoot.querySelector('.card__time-value');
    this._deleteBtn = this.shadowRoot.querySelector('.card__delete');
  }

  connectedCallback() {
    this._render();
    this._attachEventListeners();
  }

  disconnectedCallback() {
    this._removeEventListeners();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this._render();
    }
  }

  _render() {
    const title = this.getAttribute('title') || 'Untitled';
    const site = this.getAttribute('site') || '';
    const readTime = this.getAttribute('read-time') || '?';
    const isRead = this.getAttribute('is-read') === 'true';
    const excerpt = this.getAttribute('excerpt') || '';

    this._title.textContent = title;
    this._excerpt.textContent = excerpt;
    this._siteName.textContent = site;
    this._timeValue.textContent = `${readTime} min`;
    this._card.classList.toggle('card--read', isRead);
  }

  _attachEventListeners() {
    this._handleCardClick = this._handleCardClick.bind(this);
    this._handleDeleteClick = this._handleDeleteClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);

    this._card.addEventListener('click', this._handleCardClick);
    this._deleteBtn.addEventListener('click', this._handleDeleteClick);
    this._card.addEventListener('keydown', this._handleKeyDown);
  }

  _removeEventListeners() {
    this._card.removeEventListener('click', this._handleCardClick);
    this._deleteBtn.removeEventListener('click', this._handleDeleteClick);
    this._card.removeEventListener('keydown', this._handleKeyDown);
  }

  _handleCardClick(e) {
    // Don't trigger if delete button was clicked
    if (e.target.closest('.card__delete')) return;

    const articleId = this.getAttribute('article-id');
    this.dispatchEvent(
      new CustomEvent('article-open', {
        bubbles: true,
        composed: true,
        detail: { id: parseInt(articleId, 10) }
      })
    );
  }

  _handleDeleteClick(e) {
    e.stopPropagation();
    const articleId = this.getAttribute('article-id');
    const title = this.getAttribute('title');

    this.dispatchEvent(
      new CustomEvent('article-delete', {
        bubbles: true,
        composed: true,
        detail: {
          id: parseInt(articleId, 10),
          title
        }
      })
    );
  }

  _handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleCardClick(e);
    }
  }
}

// Register the custom element
customElements.define('article-card', ArticleCard);

export default ArticleCard;
