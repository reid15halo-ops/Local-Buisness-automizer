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
    const offeneAnfragen = store.anfragen.filter(a => a.status === 'neu').length;
    const wartendeAngebote = store.angebote.filter(a => a.status === 'offen').length;
    const aktiveAuftraege = store.auftraege.filter(a => a.status !== 'abgeschlossen').length;
    const offeneRechnungen = store.rechnungen.filter(r => r.status === 'offen').length;

    document.getElementById('stat-anfragen').textContent = offeneAnfragen;
    document.getElementById('stat-angebote').textContent = wartendeAngebote;
    document.getElementById('stat-auftraege').textContent = aktiveAuftraege;
    document.getElementById('stat-rechnungen').textContent = offeneRechnungen;

    // Update badges
    document.getElementById('anfragen-badge').textContent = offeneAnfragen;
    document.getElementById('angebote-badge').textContent = wartendeAngebote;
    document.getElementById('auftraege-badge').textContent = aktiveAuftraege;
    document.getElementById('rechnungen-badge').textContent = offeneRechnungen;

    renderActivities();
}

// Export dashboard functions
window.DashboardModule = {
    updateDashboard
};
