// Gestion des éléments DOM

// Variables pour les éléments DOM (seront initialisées après le chargement du DOM)
export let grid = null;
export let loading = null;
export let error = null;
export let countEl = null;
export let modeSwitcher = null;
export let refreshTimer = null;
export let viewSwitcher = null;
export let containersView = null;
export let calendarView = null;
export let calendar = null;
export let calendarWeekTitle = null;
export let calendarHeader = null;
export let prevWeekBtn = null;
export let nextWeekBtn = null;
export let loadingText = null;
export let containersControls = null;
export let identityFilter = null;

// Initialiser les références aux éléments DOM
export function initDOMElements() {
    grid = document.getElementById('grid');
    loading = document.getElementById('loading');
    error = document.getElementById('error');
    countEl = document.getElementById('count');
    modeSwitcher = document.getElementById('modeSwitcher');
    refreshTimer = document.getElementById('refreshTimer');
    viewSwitcher = document.getElementById('viewSwitcher');
    containersView = document.getElementById('containersView');
    calendarView = document.getElementById('calendarView');
    calendar = document.getElementById('calendar');
    calendarHeader = document.getElementById("calendarHeader");
    calendarWeekTitle = document.getElementById('calendarWeekTitle');
    prevWeekBtn = document.getElementById('prevWeek');
    nextWeekBtn = document.getElementById('nextWeek');
    loadingText = document.getElementById('loadingText');
    containersControls = document.getElementById('containersControls');
    identityFilter = document.getElementById('identityFilter');
    
    // Vérifier que tous les éléments critiques existent
    if (!grid || !loading || !error || !countEl || !modeSwitcher || !viewSwitcher) {
        console.error('Erreur: Certains éléments DOM sont manquants');
        if (error) {
            error.textContent = 'Erreur: Éléments DOM manquants. Vérifiez que tous les éléments sont présents dans le HTML.';
            error.style.display = 'block';
        }
        return false;
    }
    return true;
}
