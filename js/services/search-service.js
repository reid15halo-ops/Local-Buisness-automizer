/* ============================================
   Global Search Service
   Fuzzy search across customers, invoices, tasks
   ============================================ */

class SearchService {
    constructor() {
        this.index = [];
        this.resultsContainer = null;
    }

    // Build search index from store data
    buildIndex() {
        this.index = [];
        const store = window.storeService?.state;
        if (!store) {return;}

        // Index Anfragen
        store.anfragen?.forEach(item => {
            this.index.push({
                type: 'anfrage',
                id: item.id,
                title: item.kunde.name,
                subtitle: item.leistungsart,
                description: item.beschreibung,
                searchText: `${item.id} ${item.kunde.name} ${item.kunde.email} ${item.leistungsart} ${item.beschreibung}`.toLowerCase(),
                icon: '📋',
                view: 'anfragen',
                data: item
            });
        });

        // Index Angebote
        store.angebote?.forEach(item => {
            this.index.push({
                type: 'angebot',
                id: item.id,
                title: item.kunde.name,
                subtitle: `${item.positionen.length} Positionen`,
                description: window.UI.formatCurrency(item.brutto),
                searchText: `${item.id} ${item.kunde.name} ${item.leistungsart}`.toLowerCase(),
                icon: '📝',
                view: 'angebote',
                data: item
            });
        });

        // Index Aufträge
        store.auftraege?.forEach(item => {
            this.index.push({
                type: 'auftrag',
                id: item.id,
                title: item.kunde.name,
                subtitle: item.leistungsart,
                description: window.UI.formatCurrency(item.angebotsWert),
                searchText: `${item.id} ${item.kunde.name} ${item.leistungsart}`.toLowerCase(),
                icon: '⚙️',
                view: 'auftraege',
                data: item
            });
        });

        // Index Rechnungen
        store.rechnungen?.forEach(item => {
            this.index.push({
                type: 'rechnung',
                id: item.id,
                title: item.kunde.name,
                subtitle: `Status: ${item.status}`,
                description: window.UI.formatCurrency(item.brutto),
                searchText: `${item.id} ${item.kunde.name} ${item.status}`.toLowerCase(),
                icon: '💰',
                view: 'rechnungen',
                data: item
            });
        });

        // Index Tasks (if available)
        if (window.taskService) {
            window.taskService.getAllTasks?.().forEach(item => {
                this.index.push({
                    type: 'task',
                    id: item.id,
                    title: item.title,
                    subtitle: item.priority,
                    description: item.description,
                    searchText: `${item.title} ${item.description}`.toLowerCase(),
                    icon: '✓',
                    view: 'aufgaben',
                    data: item
                });
            });
        }
    }

    // Fuzzy search algorithm
    fuzzyMatch(query, text) {
        query = query.toLowerCase();
        text = text.toLowerCase();

        // Exact match
        if (text.includes(query)) {
            return { score: 100, match: true };
        }

        // Fuzzy match (allows typos)
        let queryIdx = 0;
        let textIdx = 0;
        let matches = 0;

        while (queryIdx < query.length && textIdx < text.length) {
            if (query[queryIdx] === text[textIdx]) {
                matches++;
                queryIdx++;
            }
            textIdx++;
        }

        const score = (matches / query.length) * 80;
        return { score, match: matches >= query.length * 0.7 }; // 70% match required
    }

    // Search function
    search(query) {
        if (!query || query.length < 2) {
            return [];
        }

        this.buildIndex(); // Rebuild index (could be optimized with dirty flag)

        const results = this.index
            .map(item => {
                const match = this.fuzzyMatch(query, item.searchText);
                return { ...item, score: match.score, match: match.match };
            })
            .filter(item => item.match)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // Top 10 results

        return results;
    }

    // Show search results UI
    showResults(results, query) {
        // Create or get results container
        if (!this.resultsContainer) {
            this.resultsContainer = document.createElement('div');
            this.resultsContainer.id = 'search-results';
            this.resultsContainer.className = 'search-results';
            document.body.appendChild(this.resultsContainer);

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .search-results {
                    position: fixed;
                    top: 60px;
                    right: 24px;
                    width: 400px;
                    max-height: 500px;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                    overflow-y: auto;
                    z-index: 1000;
                    display: none;
                }
                .search-results.active {
                    display: block;
                }
                .search-result-item {
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border-color);
                    cursor: pointer;
                    display: flex;
                    gap: 12px;
                    align-items: start;
                    transition: background 0.2s;
                }
                .search-result-item:hover {
                    background: var(--bg-hover);
                }
                .search-result-item:last-child {
                    border-bottom: none;
                }
                .search-result-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }
                .search-result-content {
                    flex: 1;
                    min-width: 0;
                }
                .search-result-title {
                    font-weight: 600;
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .search-result-subtitle {
                    font-size: 12px;
                    color: var(--text-secondary);
                }
                .search-result-description {
                    font-size: 13px;
                    color: var(--text-primary);
                    margin-top: 4px;
                }
                .search-no-results {
                    padding: 24px;
                    text-align: center;
                    color: var(--text-secondary);
                }
                @media (max-width: 768px) {
                    .search-results {
                        left: 12px;
                        right: 12px;
                        width: auto;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        if (results.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="search-no-results">
                    🔍 Keine Ergebnisse für "${window.UI.sanitize(query)}"
                </div>
            `;
        } else {
            this.resultsContainer.innerHTML = results.map(result => `
                <div class="search-result-item" onclick="window.searchService.navigateToResult('${result.type}', '${result.id}', '${result.view}')">
                    <div class="search-result-icon">${result.icon}</div>
                    <div class="search-result-content">
                        <div class="search-result-title">${window.UI.sanitize(result.title)}</div>
                        <div class="search-result-subtitle">${result.subtitle}</div>
                        <div class="search-result-description">${window.UI.sanitize(result.description)}</div>
                    </div>
                </div>
            `).join('');
        }

        this.resultsContainer.classList.add('active');

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', this.handleClickOutside.bind(this), { once: true });
        }, 10);
    }

    hideResults() {
        if (this.resultsContainer) {
            this.resultsContainer.classList.remove('active');
        }
    }

    handleClickOutside(e) {
        if (this.resultsContainer &&
            !this.resultsContainer.contains(e.target) &&
            e.target.id !== 'global-search') {
            this.hideResults();
        }
    }

    navigateToResult(type, id, view) {
        this.hideResults();

        // Navigate to view
        if (window.navigationController) {
            window.navigationController.navigateTo(view);
        }

        // Highlight item (optional - could scroll to it)
        setTimeout(() => {
            // Sanitize id to prevent CSS selector injection
            const safeId = CSS.escape ? CSS.escape(id) : id.replace(/[^\w-]/g, '');
            const element = document.querySelector(`[data-id="${safeId}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                element.style.animation = 'highlight 1s';
            }
        }, 300);
    }

    init() {
        const searchInput = document.getElementById('global-search');
        if (!searchInput) {return;}

        let debounceTimer;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();

            if (query.length < 2) {
                this.hideResults();
                return;
            }

            debounceTimer = setTimeout(() => {
                const results = this.search(query);
                this.showResults(results, query);
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideResults();
                searchInput.blur();
            }
        });

        // Build initial index
        this.buildIndex();

        // Rebuild index when store changes
        if (window.storeService) {
            window.storeService.subscribe?.(() => this.buildIndex());
        }
    }
}

window.searchService = new SearchService();
