/* ============================================
   Material Picker Component
   Reusable material selection for Angebote
   ============================================ */

class MaterialPickerUI {
    constructor() {
        this.selectedMaterial = null;
        this.onSelectCallback = null;
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('material-picker-styles')) {return;}

        const style = document.createElement('style');
        style.id = 'material-picker-styles';
        style.textContent = `
            .material-picker-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                padding: 20px;
            }

            .material-picker-content {
                background: #1c1c21;
                border-radius: 12px;
                width: 100%;
                max-width: 500px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
                border: 1px solid #333;
            }

            .material-picker-header {
                padding: 16px 20px;
                border-bottom: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .material-picker-header h3 {
                margin: 0;
                color: #fff;
                font-size: 16px;
            }

            .material-picker-close {
                background: none;
                border: none;
                color: #888;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .material-picker-close:hover {
                color: #fff;
            }

            .material-picker-search {
                padding: 12px 16px;
                border-bottom: 1px solid #333;
            }

            .material-picker-search input {
                width: 100%;
                padding: 8px 12px;
                background: #2a2a30;
                border: 1px solid #444;
                border-radius: 6px;
                color: #fff;
                font-size: 14px;
            }

            .material-picker-search input::placeholder {
                color: #666;
            }

            .material-picker-search input:focus {
                outline: none;
                border-color: #6366f1;
                background: #333;
            }

            .material-picker-list {
                flex: 1;
                overflow-y: auto;
                padding: 8px;
            }

            .material-picker-item {
                padding: 12px;
                margin: 4px 0;
                background: #2a2a30;
                border: 1px solid #333;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s;
                color: #fff;
            }

            .material-picker-item:hover {
                background: #333;
                border-color: #6366f1;
            }

            .material-picker-item-name {
                font-weight: 500;
                margin-bottom: 4px;
            }

            .material-picker-item-meta {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                color: #999;
                margin-top: 4px;
            }

            .material-picker-item-info {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                margin-top: 4px;
            }

            .material-picker-item-info span {
                display: flex;
                gap: 4px;
                align-items: center;
            }

            .material-picker-stock-indicator {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 4px;
            }

            .material-picker-stock-green {
                background: #22c55e;
            }

            .material-picker-stock-amber {
                background: #f59e0b;
            }

            .material-picker-stock-red {
                background: #ef4444;
            }

            .material-picker-empty {
                padding: 40px 20px;
                text-align: center;
                color: #666;
            }

            .position-material-badge {
                display: inline-block;
                background: #6366f1;
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                margin-left: 4px;
            }

            .position-material-clear {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                padding: 0 4px;
                font-size: 12px;
            }

            .position-material-clear:hover {
                color: #f59e0b;
            }

            .position-stock-status {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #999;
                margin-left: 8px;
            }

            .position-margin-info {
                font-size: 11px;
                color: #6366f1;
                margin-top: 4px;
            }

            .material-picker-item-artikelnr {
                font-size: 12px;
                color: #666;
                margin-top: 2px;
            }

            .material-picker-item-selected {
                background: #6366f1;
                border-color: #6366f1;
            }

            .material-picker-no-results {
                padding: 20px;
                text-align: center;
                color: #666;
                font-size: 14px;
            }

            /* Scrollbar styling */
            .material-picker-list::-webkit-scrollbar {
                width: 8px;
            }

            .material-picker-list::-webkit-scrollbar-track {
                background: #2a2a30;
            }

            .material-picker-list::-webkit-scrollbar-thumb {
                background: #444;
                border-radius: 4px;
            }

            .material-picker-list::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
        `;
        document.head.appendChild(style);
    }

    open(onSelect = null) {
        this.onSelectCallback = onSelect;
        const materials = window.materialService?.getAllMaterials() || [];

        const modal = document.createElement('div');
        modal.className = 'material-picker-modal';
        modal.id = 'material-picker-modal-' + Date.now();

        const content = document.createElement('div');
        content.className = 'material-picker-content';

        content.innerHTML = `
            <div class="material-picker-header">
                <h3>Material aus Bestand wählen</h3>
                <button class="material-picker-close">&times;</button>
            </div>
            <div class="material-picker-search">
                <input type="text" class="material-picker-search-input" placeholder="Materialiën durchsuchen...">
            </div>
            <div class="material-picker-list"></div>
        `;

        modal.appendChild(content);
        document.body.appendChild(modal);

        const closeBtn = content.querySelector('.material-picker-close');
        const searchInput = content.querySelector('.material-picker-search-input');
        const list = content.querySelector('.material-picker-list');

        closeBtn.addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Render all materials initially
        this.renderMaterialList(materials, list, modal);

        // Search functionality
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            if (query.length === 0) {
                this.renderMaterialList(materials, list, modal);
            } else {
                const filtered = materials.filter(m =>
                    m.bezeichnung.toLowerCase().includes(query) ||
                    m.artikelnummer.toLowerCase().includes(query) ||
                    m.kategorie.toLowerCase().includes(query)
                );
                this.renderMaterialList(filtered, list, modal);
            }
        });

        searchInput.focus();
    }

    renderMaterialList(materials, container, modal) {
        if (materials.length === 0) {
            container.innerHTML = '<div class="material-picker-no-results">Keine Materialien gefunden</div>';
            return;
        }

        container.innerHTML = materials.map(material => {
            const stockStatus = this.getStockStatus(material);
            const stockColor = stockStatus.color;

            return `
                <div class="material-picker-item" data-material-id="${material.id}">
                    <div class="material-picker-item-name">${window.UI?.sanitize?.(material.bezeichnung) || material.bezeichnung}</div>
                    <div class="material-picker-item-artikelnr">Art.Nr.: ${window.UI?.sanitize?.(material.artikelnummer) || material.artikelnummer}</div>
                    <div class="material-picker-item-info">
                        <span>
                            <span class="material-picker-stock-indicator ${stockColor}"></span>
                            Verfügbar: ${material.bestand} ${material.einheit}
                        </span>
                        <span>${this.formatCurrency(material.vkPreis || material.preis)}</span>
                    </div>
                    <div class="material-picker-item-meta">
                        <span>EK: ${this.formatCurrency(material.preis)}</span>
                        <span>Marge: ${this.calculateMargin(material)}%</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.material-picker-item').forEach(item => {
            item.addEventListener('click', () => {
                const materialId = item.dataset.materialId;
                const material = materials.find(m => m.id === materialId);
                if (material && this.onSelectCallback) {
                    this.onSelectCallback(material);
                }
                modal.remove();
            });
        });
    }

    getStockStatus(material) {
        // We'll use a basic threshold for "sufficient" stock
        // Sufficient = bestand > 5 units (or more than 50% of minBestand)
        const threshold = Math.max(5, material.minBestand || 0);

        if (material.bestand === 0) {
            return { color: 'material-picker-stock-red', label: 'Out of stock' };
        } else if (material.bestand < threshold) {
            return { color: 'material-picker-stock-amber', label: 'Low stock' };
        } else {
            return { color: 'material-picker-stock-green', label: 'In stock' };
        }
    }

    calculateMargin(material) {
        if (!material.preis || material.preis === 0) {return '0';}
        const margin = ((material.vkPreis || material.preis) - material.preis) / material.preis * 100;
        return Math.round(margin).toString();
    }

    formatCurrency(value) {
        if (!value) {return '0,00 €';}
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(value);
    }
}

// Create global instance
window.materialPickerUI = new MaterialPickerUI();
