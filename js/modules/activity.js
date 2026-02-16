/* ============================================
   Activity Module
   Activity log, notifications, and history
   ============================================ */

function renderActivities() {
    const container = document.getElementById('activity-list');
    const activities = window.storeService.state.activities || [];

    if (activities.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Aktivitäten.</p>';
        return;
    }

    container.innerHTML = activities.slice(0, 10).map(activity => `
        <div class="activity-item">
            <span class="activity-icon">${activity.icon}</span>
            <div class="activity-content">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${window.UI.getRelativeTime(activity.time)}</div>
            </div>
        </div>
    `).join('');
}

// Export activity functions
window.ActivityModule = {
    renderActivities
};
