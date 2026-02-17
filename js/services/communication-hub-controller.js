/* ============================================
   Communication Hub Controller
   Manages WhatsApp-style chat UI interaction
   ============================================ */

class CommunicationHubController {
    constructor() {
        this.currentConversation = null;
        this.selectedChannel = 'sms';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadConversations();
    }

    setupEventListeners() {
        // Navigation
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-view="kommunikation"]')) {
                this.loadConversations();
            }
        });

        // Conversation selection
        document.addEventListener('click', (e) => {
            const convItem = e.target.closest('.comm-item');
            if (convItem) {
                const conversationId = convItem.dataset.conversationId;
                this.selectConversation(conversationId);
            }
        });

        // Template selection
        const templateSelect = document.getElementById('comm-template-select');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.insertTemplate(e.target.value);
                    e.target.value = ''; // Reset
                }
            });
        }

        // Message input
        const messageInput = document.getElementById('comm-message-input');
        if (messageInput) {
            messageInput.addEventListener('input', (e) => {
                this.updateCharCount(e.target.value);
            });

            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    this.sendMessage();
                }
            });
        }

        // Channel selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.comm-channel-btn')) {
                const btn = e.target.closest('.comm-channel-btn');
                const channel = btn.dataset.channel;
                this.selectChannel(channel);
            }
        });

        // Send button
        const sendBtn = document.getElementById('btn-send-message');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Search
        const searchInput = document.getElementById('comm-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchConversations(e.target.value);
            });
        }

        // Export button
        const exportBtn = document.getElementById('btn-comm-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportConversation());
        }

        // Info button
        const infoBtn = document.getElementById('btn-comm-info');
        if (infoBtn) {
            infoBtn.addEventListener('click', () => this.showConversationInfo());
        }
    }

    loadConversations() {
        const conversations = window.unifiedCommService?.getConversations() || [];
        const listContainer = document.getElementById('comm-conversations-list');

        if (!listContainer) {return;}

        if (conversations.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">Keine Gespräche</p>';
            return;
        }

        const san = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => s);
        listContainer.innerHTML = conversations.map(conv => {
            const time = new Date(conv.lastMessageTime || conv.createdAt).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const unreadBadge = conv.unreadCount > 0
                ? `<div class="comm-unread">${conv.unreadCount}</div>`
                : '';

            return `
                <div class="comm-item ${this.currentConversation?.id === conv.id ? 'active' : ''}"
                     data-conversation-id="${san(conv.id)}">
                    <div class="comm-item-name">${san(conv.customerName)}</div>
                    <div class="comm-item-preview">${san(conv.lastMessage || 'Keine Nachrichten')}</div>
                    <div class="comm-item-time">${time}</div>
                    ${unreadBadge}
                </div>
            `;
        }).join('');
    }

    selectConversation(conversationId) {
        const conversation = window.unifiedCommService?.getConversationById(conversationId);
        if (!conversation) {return;}

        this.currentConversation = conversation;

        // Update UI
        const emptyState = document.getElementById('comm-empty-state');
        const chatView = document.getElementById('comm-chat-view');
        const chatTitle = document.getElementById('comm-chat-title');

        if (emptyState) {emptyState.style.display = 'none';}
        if (chatView) {chatView.style.display = 'flex';}
        if (chatTitle) {chatTitle.textContent = conversation.customerName;}

        // Load messages
        this.loadMessages();

        // Mark as read
        window.unifiedCommService?.markConversationAsRead(conversationId);

        // Update conversation list
        this.loadConversations();

        // Update badge
        this.updateBadges();
    }

    loadMessages() {
        if (!this.currentConversation) {return;}

        const messages = window.unifiedCommService?.getConversationMessages(this.currentConversation.id) || [];
        const container = document.getElementById('comm-messages-container');

        if (!container) {return;}

        container.innerHTML = messages.map(msg => {
            const time = new Date(msg.timestamp).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
            });

            const statusIcon = {
                'sent': '✓',
                'delivered': '✓✓',
                'read': '✓✓',
                'failed': '✗'
            }[msg.status] || '⏱';

            const statusColor = msg.status === 'failed' ? '#ef4444' : 'inherit';

            return `
                <div class="comm-message ${msg.direction}">
                    <div class="comm-message-bubble">
                        ${this.linkify(msg.content)}
                    </div>
                    <div class="comm-message-time">${time}</div>
                    ${msg.direction === 'sent' ? `<div class="comm-message-status" style="color: ${statusColor};">${statusIcon}</div>` : ''}
                </div>
            `;
        }).join('');

        // Scroll to bottom
        if (container.parentElement) {
            container.parentElement.scrollTop = container.parentElement.scrollHeight;
        }
    }

    linkify(text) {
        // Sanitize text first, then linkify URLs
        const sanitize = window.UI?.sanitize || window.sanitize?.escapeHtml || (s => s);
        const safeText = sanitize(text);
        return safeText.replace(/(https?:\/\/[^\s&]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">$1</a>');
    }

    updateCharCount(text) {
        const countSpan = document.getElementById('comm-char-count');
        const charCount = document.querySelector('.comm-char-count');
        const segmentsSpan = document.getElementById('comm-sms-segments');

        if (!countSpan) {return;}

        const smsInfo = window.unifiedCommService?.calculateSmsLength(text) || { length: 0, segments: 1 };

        countSpan.textContent = smsInfo.length;

        // Update color
        if (charCount) {
            charCount.classList.remove('warning', 'error');
            if (smsInfo.segments > 3) {
                charCount.classList.add('warning');
            }
            if (smsInfo.segments > 6) {
                charCount.classList.add('error');
            }
        }

        // Show segment count
        if (segmentsSpan) {
            if (smsInfo.segments > 1) {
                segmentsSpan.textContent = ` (${smsInfo.segments} Teile)`;
            } else {
                segmentsSpan.textContent = '';
            }
        }
    }

    selectChannel(channel) {
        this.selectedChannel = channel;

        // Update button states
        document.querySelectorAll('.comm-channel-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-channel="${channel}"]`)?.classList.add('active');

        // Update char limit display
        const charLimit = channel === 'sms' ? 160 : 5000;
        const charCountSpan = document.querySelector('.comm-char-count span:nth-child(3)');
        if (charCountSpan) {
            charCountSpan.textContent = `/${charLimit}`;
        }
    }

    insertTemplate(templateKey) {
        const template = window.unifiedCommService?.getTemplateByKey(templateKey);
        if (!template) {return;}

        let content = template.template;

        // For SMS, use SMS variant if available
        if (this.selectedChannel === 'sms' && template.smsVariant) {
            content = template.smsVariant;
        }

        // Show variable input dialog
        const variables = template.variables || [];
        if (variables.length > 0) {
            this.showVariableDialog(templateKey, variables, content);
        } else {
            const textarea = document.getElementById('comm-message-input');
            if (textarea) {
                textarea.value = content;
                this.updateCharCount(content);
            }
        }
    }

    showVariableDialog(templateKey, variables, content) {
        const form = document.createElement('div');
        form.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 24px;
            z-index: 1000;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Vorlage-Variablen ausfüllen';
        title.style.marginTop = '0';
        form.appendChild(title);

        const inputs = {};
        variables.forEach(varName => {
            const label = document.createElement('label');
            label.style.cssText = `
                display: block;
                margin-bottom: 12px;
                font-size: 13px;
                font-weight: 500;
            `;
            label.innerHTML = `${varName}:`;
            form.appendChild(label);

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = `${varName}...`;
            input.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--bg-secondary);
                color: var(--text-primary);
                margin-bottom: 12px;
                font-size: 13px;
                box-sizing: border-box;
            `;
            form.appendChild(input);
            inputs[varName] = input;
        });

        const buttons = document.createElement('div');
        buttons.style.cssText = `
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 20px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Abbrechen';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.onclick = () => document.body.removeChild(overlay);
        buttons.appendChild(cancelBtn);

        const okBtn = document.createElement('button');
        okBtn.textContent = 'Einfügen';
        okBtn.className = 'btn btn-primary';
        okBtn.onclick = () => {
            const values = {};
            for (const [varName, input] of Object.entries(inputs)) {
                values[varName] = input.value;
            }

            let filledContent = content;
            for (const [varName, value] of Object.entries(values)) {
                filledContent = filledContent.replace(new RegExp(`{{${varName}}}`, 'g'), value);
            }

            const textarea = document.getElementById('comm-message-input');
            if (textarea) {
                textarea.value = filledContent;
                this.updateCharCount(filledContent);
            }

            document.body.removeChild(overlay);
        };
        buttons.appendChild(okBtn);

        form.appendChild(buttons);

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
        `;
        overlay.onclick = () => document.body.removeChild(overlay);

        overlay.appendChild(form);
        document.body.appendChild(overlay);

        // Focus first input
        Object.values(inputs)[0]?.focus();
    }

    async sendMessage() {
        if (!this.currentConversation) {
            alert('Bitte wählen Sie zunächst ein Gespräch');
            return;
        }

        const textarea = document.getElementById('comm-message-input');
        const message = textarea?.value?.trim();

        if (!message) {
            alert('Nachricht darf nicht leer sein');
            return;
        }

        // Validate SMS length if SMS channel
        if (this.selectedChannel === 'sms') {
            const smsInfo = window.unifiedCommService?.calculateSmsLength(message);
            if (smsInfo?.segments > 6) {
                alert('SMS zu lang (max. 6 Teile)');
                return;
            }
        }

        try {
            if (this.selectedChannel === 'sms') {
                // Send SMS
                const result = await window.unifiedCommService?.sendSms(
                    this.currentConversation.customerPhone,
                    message,
                    this.currentConversation.id,
                    this.currentConversation.customerId
                );

                if (!result?.success) {
                    alert('Fehler beim Versenden: ' + (result?.error || 'Unbekannter Fehler'));
                    return;
                }
            } else {
                // Add to conversation for other channels
                window.unifiedCommService?.addMessage(this.currentConversation.id, {
                    direction: 'sent',
                    type: 'text',
                    content: message,
                    channel: this.selectedChannel,
                    status: 'sent'
                });
            }

            // Clear input
            if (textarea) {
                textarea.value = '';
                this.updateCharCount('');
            }

            // Reload messages
            this.loadMessages();

            // Update conversations list
            this.loadConversations();

            // Update badges
            this.updateBadges();

        } catch (error) {
            console.error('Send error:', error);
            alert('Fehler beim Versenden der Nachricht');
        }
    }

    searchConversations(query) {
        if (!query.trim()) {
            this.loadConversations();
            return;
        }

        const results = window.unifiedCommService?.searchConversations(query) || [];
        const listContainer = document.getElementById('comm-conversations-list');

        if (!listContainer) {return;}

        if (results.length === 0) {
            listContainer.innerHTML = '<p class="empty-state">Keine Ergebnisse</p>';
            return;
        }

        listContainer.innerHTML = results.map(conv => {
            const time = new Date(conv.lastMessageTime || conv.createdAt).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
                <div class="comm-item ${this.currentConversation?.id === conv.id ? 'active' : ''}"
                     data-conversation-id="${conv.id}">
                    <div class="comm-item-name">${conv.customerName}</div>
                    <div class="comm-item-preview">${conv.lastMessage || 'Keine Nachrichten'}</div>
                    <div class="comm-item-time">${time}</div>
                </div>
            `;
        }).join('');
    }

    exportConversation() {
        if (!this.currentConversation) {
            alert('Bitte wählen Sie zunächst ein Gespräch');
            return;
        }

        const exportData = window.unifiedCommService?.exportCommunicationHistory(
            this.currentConversation.customerId
        );

        if (!exportData) {
            alert('Keine Daten zum Exportieren');
            return;
        }

        // Create and download CSV
        const blob = new Blob([exportData.content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = exportData.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        alert(`Exportiert: ${exportData.filename}`);
    }

    showConversationInfo() {
        if (!this.currentConversation) {return;}

        const messages = window.unifiedCommService?.getConversationMessages(this.currentConversation.id) || [];
        const stats = window.unifiedCommService?.getStatistics() || {};

        alert(`
Kunde: ${this.currentConversation.customerName}
Telefon: ${this.currentConversation.customerPhone}
E-Mail: ${this.currentConversation.customerEmail}

Nachrichtenanzahl: ${messages.length}
Letzte Nachricht: ${this.currentConversation.lastMessageTime ? new Date(this.currentConversation.lastMessageTime).toLocaleString('de-DE') : 'Keine'}
        `);
    }

    updateBadges() {
        const unreadConversations = (window.unifiedCommService?.getConversations() || [])
            .filter(c => c.unreadCount > 0)
            .length;

        const badge = document.getElementById('kommunikation-badge');
        if (badge) {
            badge.textContent = unreadConversations;
            badge.style.display = unreadConversations > 0 ? 'inline-block' : 'none';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.communicationHubController) {
            window.communicationHubController = new CommunicationHubController();
        }
    });
} else {
    if (!window.communicationHubController) {
        window.communicationHubController = new CommunicationHubController();
    }
}
