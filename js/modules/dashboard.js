/* ============================================
   Dashboard Module
   Dashboard rendering, stats, and charts
   ============================================ */

const { store, renderActivities } = (() => {
    const store = window.storeService.state;
    const { renderActivities } = window.ActivityModule;
    return { store, renderActivities };
})();

function updateDashboard() {
    const offeneAnfragen = store?.anfragen?.filter(a => a.status === 'neu').length || 0;
    const wartendeAngebote = store?.angebote?.filter(a => a.status === 'offen').length || 0;
    const aktiveAuftraege = store?.auftraege?.filter(a => a.status !== 'abgeschlossen').length || 0;
    const offeneRechnungen = store?.rechnungen?.filter(r => r.status === 'offen').length || 0;

    const statAnfragen = document.getElementById('stat-anfragen');
    const statAngebote = document.getElementById('stat-angebote');
    const statAuftraege = document.getElementById('stat-auftraege');
    const statRechnungen = document.getElementById('stat-rechnungen');

    if (statAnfragen) {statAnfragen.textContent = offeneAnfragen;}
    if (statAngebote) {statAngebote.textContent = wartendeAngebote;}
    if (statAuftraege) {statAuftraege.textContent = aktiveAuftraege;}
    if (statRechnungen) {statRechnungen.textContent = offeneRechnungen;}

    // Update badges
    const anfragenBadge = document.getElementById('anfragen-badge');
    const angeboteBadge = document.getElementById('angebote-badge');
    const auftraegeBadge = document.getElementById('auftraege-badge');
    const rechnungenBadge = document.getElementById('rechnungen-badge');

    if (anfragenBadge) {anfragenBadge.textContent = offeneAnfragen;}
    if (angeboteBadge) {angeboteBadge.textContent = wartendeAngebote;}
    if (auftraegeBadge) {auftraegeBadge.textContent = aktiveAuftraege;}
    if (rechnungenBadge) {rechnungenBadge.textContent = offeneRechnungen;}

    renderActivities();

    // Initialize and refresh dashboard charts
    if (window.dashboardChartsService) {
        try {
            window.dashboardChartsService.initDashboardCharts();
        } catch (error) {
            console.warn('Failed to initialize dashboard charts:', error);
        }
    }
}

// Export dashboard functions
window.DashboardModule = {
    updateDashboard,
    refreshCharts: () => {
        if (window.dashboardChartsService) {
            window.dashboardChartsService.refreshCharts();
        }
    }
};
