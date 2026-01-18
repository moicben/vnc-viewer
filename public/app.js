// Variables pour les éléments DOM (seront initialisées après le chargement du DOM)
let grid = null;
let loading = null;
let error = null;
let countEl = null;
let modeSwitcher = null;
let refreshTimer = null;
let viewSwitcher = null;
let containersView = null;
let calendarView = null;
let calendar = null;
let calendarWeekTitle = null;
let calendarHeader = null;
let prevWeekBtn = null;
let nextWeekBtn = null;
let loadingText = null;
let containersControls = null;

// Configuration (chargée depuis l'API)
let INCUS_SERVER = '';
let IP_PREFIX = '';
let VNC_BASE_URL = '';

// Fonction pour extraire le hostname depuis l'URL complète
function extractHostname(url) {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname;
  } catch {
    // Si l'URL n'a pas de protocole, retourner tel quel
    return url.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
  }
}
// Utiliser le proxy serveur pour éviter les problèmes CORS
const INCUS_API_URL = '/api/instances';
const CONFIG_API_URL = '/api/config';
const MEETINGS_API_URL = '/api/meetings';

// État des containers
let allContainers = [];
let currentMode = 'all'; // 'all' ou 'dev'
let containersCache = new Map(); // Cache des éléments DOM des containers

// État de la vue
let currentView = 'containers'; // 'containers' ou 'calendar'
let currentWeekStart = null; // Date de début de la semaine affichée
let meetings = []; // Liste des meetings de la semaine

// Initialiser les références aux éléments DOM
function initDOMElements() {
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

// Charger la configuration puis les containers au démarrage
async function init() {
    // Initialiser les éléments DOM d'abord
    if (!initDOMElements()) {
        console.error('Éléments DOM critiques manquants');
        return;
    }
    
    try { 
        if (loading) loading.style.display = 'block';
        const configResponse = await fetch(CONFIG_API_URL);
        
        if (!configResponse.ok) {
            throw new Error(`Erreur HTTP ${configResponse.status}: ${configResponse.statusText}`);
        }
        
        const config = await configResponse.json();
        
        if (!config.incusServer || !config.ipPrefix) {
            throw new Error('Configuration incomplète reçue du serveur');
        }
        
        INCUS_SERVER = config.incusServer;
        IP_PREFIX = config.ipPrefix;
        VNC_BASE_URL = `${INCUS_SERVER}/vnc.html`;
        
        // Configurer le switcher de mode maintenant que les éléments DOM sont initialisés
        setupModeSwitcher();
        
        // Configurer le switcher de vue
        setupViewSwitcher();
        
        // Initialiser la semaine actuelle pour le calendrier
        initCurrentWeek();
        
        // Charger les containers une fois la config chargée
        await loadContainersFromAPI();
        // Attendre que le DOM soit prêt pour calculer les positions
        setTimeout(() => {
            updateModeSwitcher();
            loadContainers();
            // Démarrer le rafraîchissement automatique
            initAutoRefresh();
        }, 0);
    } catch (err) {
        console.error('Erreur lors du chargement de la configuration:', err);
        if (loading) loading.style.display = 'none';
        if (error) {
            error.textContent = `Erreur lors du chargement de la configuration: ${err.message}`;
            error.style.display = 'block';
        }
    }
}

// Configurer le switcher de mode
function setupModeSwitcher() {
    if (!modeSwitcher) return;
    
    modeSwitcher.addEventListener('click', (e) => {
        const clickedMode = e.target.dataset.mode;
        if (clickedMode && clickedMode !== currentMode) {
            currentMode = clickedMode;
            // Utiliser requestAnimationFrame pour s'assurer que le DOM est mis à jour
            requestAnimationFrame(() => {
                updateModeSwitcher();
                loadContainers();
            });
        }
    });
    
    // Mettre à jour l'indicateur lors du redimensionnement de la fenêtre
    window.addEventListener('resize', () => {
        updateModeSwitcher();
    });
}

// Attendre que le DOM soit complètement chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Mettre à jour l'affichage du switcher
function updateModeSwitcher() {
    if (!modeSwitcher) return;
    
    modeSwitcher.setAttribute('data-mode', currentMode);
    const options = modeSwitcher.querySelectorAll('.mode-option');
    const indicator = modeSwitcher.querySelector('.mode-switcher-indicator');
    
    options.forEach((option, index) => {
        if (option.dataset.mode === currentMode) {
            option.classList.add('active');
            // Calculer la position et la largeur de l'indicateur basé sur l'option active
            if (indicator) {
                // Calculer la position en additionnant les largeurs des options précédentes
                let left = 0;
                for (let i = 0; i < index; i++) {
                    left += options[i].offsetWidth;
                }
                const width = option.offsetWidth;
                
                indicator.style.width = `${width}px`;
                indicator.style.transform = `translateX(${left}px)`;
            }
        } else {
            option.classList.remove('active');
        }
    });
}

// Récupérer les containers depuis l'API Incus via le proxy serveur
async function loadContainersFromAPI(silent = false) {
    try {
        if (!silent && loading) loading.style.display = 'block';
        
        const response = await fetch(INCUS_API_URL);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Le serveur retourne déjà les containers traités
        if (data.containers && Array.isArray(data.containers)) {
            const previousContainers = new Map(allContainers.map(c => [c.name, c]));
            const newContainers = data.containers;
            const newContainersMap = new Map(newContainers.map(c => [c.name, c]));
            
            // Synchroniser les containers : ajouter les nouveaux, supprimer les supprimés
            synchronizeContainers(previousContainers, newContainersMap);
            
            allContainers = newContainers;
            
            if (!silent) {
                loadContainers();
            } else {
                // Mise à jour silencieuse : juste synchroniser sans recharger
                synchronizeContainersDOM(previousContainers, newContainersMap);
                updateContainersVisibility();
                const containersToDisplay = getContainersToDisplay();
                if (countEl) countEl.textContent = `${containersToDisplay.length}/${allContainers.length} containers`;
            }
        } else {
            console.warn('Format de données API non reconnu:', data);
            allContainers = [];
            if (countEl) countEl.textContent = '0/0 containers';
        }
    } catch (err) {
        console.error('Erreur lors de la récupération des containers:', err);
        if (!silent && error) {
            error.textContent = `Erreur lors de la récupération: ${err.message}`;
            error.style.display = 'block';
        }
        allContainers = [];
    } finally {
        if (!silent && loading) loading.style.display = 'none';
    }
}

// Synchroniser les containers : ajouter les nouveaux, supprimer les supprimés
function synchronizeContainers(previousContainers, newContainersMap) {
    // Cette fonction est appelée lors du premier chargement
    // La synchronisation DOM se fait dans synchronizeContainersDOM
}

// Synchroniser le DOM : ajouter les nouveaux containers, supprimer les supprimés
function synchronizeContainersDOM(previousContainers, newContainersMap) {
    if (!grid) return;
    
    const INCUS_HOST = extractHostname(INCUS_SERVER);
    const existingContainerElements = new Map();
    
    // Récupérer tous les containers existants dans le DOM
    grid.querySelectorAll('.grid-item').forEach(item => {
        const containerName = item.dataset.containerName || 
            item.querySelector('.grid-item-header span:first-child')?.textContent;
        if (containerName) {
            existingContainerElements.set(containerName, item);
        }
    });
    
    // Supprimer les containers qui n'existent plus
    existingContainerElements.forEach((element, containerName) => {
        if (!newContainersMap.has(containerName)) {
            element.remove();
            containersCache.delete(containerName);
        }
    });
    
    // Mettre à jour les containers existants et ajouter les nouveaux
    newContainersMap.forEach((container, containerName) => {
        const existingElement = existingContainerElements.get(containerName);
        
        if (existingElement) {
            // Container existant : mettre à jour l'IP si elle a changé (sans recharger l'iframe)
            const ipElement = existingElement.querySelector('.grid-item-header .ip');
            if (ipElement && container.ip && ipElement.textContent !== container.ip) {
                ipElement.textContent = container.ip;
            }
        } else {
            // Nouveau container à ajouter
            const allToPreload = getAllContainersToPreload();
            const shouldPreload = allToPreload.some(c => c.name === containerName);
            
            if (shouldPreload && container.ip) {
                const vncUrl = `https://${VNC_BASE_URL}#host=${INCUS_HOST}&port=443&autoconnect=true&scaling=local&path=websockify?token=${container.ip}`;
                
                const containerElement = document.createElement('div');
                containerElement.className = 'grid-item';
                containerElement.dataset.containerName = container.name;
                containerElement.innerHTML = `
                    <div class="grid-item-header">
                        <span>${container.name}</span>
                        <span class="ip">${container.ip}</span>
                    </div>
                    <iframe 
                        src="${vncUrl}" 
                        class="grid-item-iframe"
                        title="${container.name}"
                        allow="fullscreen"
                        loading="eager">
                    </iframe>
                `;
                
                grid.appendChild(containerElement);
                containersCache.set(container.name, containerElement);
            }
        }
    });
}

// Obtenir tous les containers à précharger (c-template + b-template + wireguard + android + tous les autres actifs)
function getAllContainersToPreload() {
    if (allContainers.length === 0) {
        return [];
    }
    
    // Inclure c-template + b-template + wireguard + android + tous les autres containers actifs
    return allContainers.filter(c => 
        c.name === 'c-template' || c.name === 'b-template' || c.name === 'wireguard' || c.name === 'android' || (c.name !== 'c-template' && c.name !== 'b-template' && c.name !== 'wireguard' && c.name !== 'android' && c.status === 'Running')
    );
}

// Obtenir les containers à afficher selon le mode
function getContainersToDisplay() {
    if (allContainers.length === 0) {
        return [];
    }
    
    if (currentMode === 'dev') {
        // Mode Dev : c-template + b-template + wireguard + android
        return allContainers.filter(c => c.name === 'c-template' || c.name === 'b-template' || c.name === 'wireguard' || c.name === 'android');
    } else {
        // Mode All : tous les containers actifs sauf c-template, b-template, wireguard et android
        return allContainers.filter(c => c.name !== 'c-template' && c.name !== 'b-template' && c.name !== 'wireguard' && c.name !== 'android' && c.status === 'Running');
    }
}

function loadContainers() {
    if (!loading || !error || !grid) {
        console.error('Éléments DOM manquants dans loadContainers');
        return;
    }
    
    loading.style.display = 'block';
    error.style.display = 'none';
    
    try {
        // Obtenir les containers à afficher selon le mode
        const containersToDisplay = getContainersToDisplay();
        
        if (containersToDisplay.length === 0) {
            // Si aucun container à afficher, vider le grid
            if (grid) grid.innerHTML = '';
            displayContainers([]);
            if (countEl) countEl.textContent = `0/${allContainers.length} containers`;
            loading.style.display = 'none';
            return;
        }
        
        // Précharger tous les containers si ce n'est pas déjà fait
        preloadAllContainers();
        
        // Mettre à jour la visibilité selon le mode
        updateContainersVisibility();
        
        if (countEl) countEl.textContent = `${containersToDisplay.length}/${allContainers.length} containers`;
        
    } catch (err) {
        console.error('Erreur:', err);
        if (error) {
            error.textContent = `Erreur: ${err.message}`;
            error.style.display = 'block';
        }
        if (grid) grid.innerHTML = '';
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// Précharger tous les containers dans le DOM
function preloadAllContainers() {
    if (!grid) return;
    
    const allToPreload = getAllContainersToPreload();
    if (allToPreload.length === 0) return;
    
    const INCUS_HOST = extractHostname(INCUS_SERVER);
    
    // Vérifier si les containers sont déjà dans le DOM
    const existingContainers = new Set();
    grid.querySelectorAll('.grid-item').forEach(item => {
        const name = item.dataset.containerName || 
            item.querySelector('.grid-item-header span:first-child')?.textContent;
        if (name) existingContainers.add(name);
    });
    
    // Créer uniquement les containers manquants (ne pas toucher aux existants)
    allToPreload.forEach(container => {
        if (!container || !container.ip || existingContainers.has(container.name)) {
            return;
        }
        
        const vncUrl = `https://${VNC_BASE_URL}#host=${INCUS_HOST}&port=443&autoconnect=true&scaling=local&path=websockify?token=${container.ip}`;
        
        const containerElement = document.createElement('div');
        containerElement.className = 'grid-item';
        containerElement.dataset.containerName = container.name;
        containerElement.innerHTML = `
            <div class="grid-item-header">
                <span>${container.name}</span>
                <span class="ip">${container.ip}</span>
            </div>
            <iframe 
                src="${vncUrl}" 
                class="grid-item-iframe"
                title="${container.name}"
                allow="fullscreen"
                loading="eager">
            </iframe>
        `;
        
        grid.appendChild(containerElement);
        containersCache.set(container.name, containerElement);
    });
}

// Mettre à jour la visibilité des containers selon le mode
function updateContainersVisibility() {
    if (!grid) return;
    
    const containersToDisplay = getContainersToDisplay();
    const visibleNames = new Set(containersToDisplay.map(c => c.name));
    
    // Mettre à jour la visibilité de tous les containers
    grid.querySelectorAll('.grid-item').forEach(item => {
        const containerName = item.dataset.containerName || 
            item.querySelector('.grid-item-header span:first-child')?.textContent;
        
        if (containerName && visibleNames.has(containerName)) {
            // Afficher le container
            item.style.display = '';
            item.style.position = '';
            item.style.left = '';
            item.style.top = '';
            item.style.opacity = '';
            item.style.pointerEvents = '';
            item.classList.remove('hidden');
        } else {
            // Masquer visuellement mais garder dans le DOM pour précharger les iframes
            // Positionner hors écran pour que les iframes continuent de charger
            item.style.display = 'block';
            item.style.position = 'absolute';
            item.style.left = '-9999px';
            item.style.top = '0';
            item.style.opacity = '0';
            item.style.pointerEvents = 'none';
            item.classList.add('hidden');
        }
    });
    
    // Mettre à jour la classe grid-single si nécessaire
    if (containersToDisplay.length === 1) {
        grid.classList.add('grid-single');
    } else {
        grid.classList.remove('grid-single');
    }
}

function displayContainers(containers) {
    if (!grid) {
        console.error('grid est null dans displayContainers');
        return;
    }
    
    if (containers.length === 0) {
        // Afficher l'état vide seulement si aucun container n'est préchargé
        const hasPreloadedContainers = grid.querySelectorAll('.grid-item').length > 0;
        if (!hasPreloadedContainers) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h2>Aucun container</h2>
                    <p>${currentMode === 'dev' ? 'Aucun container dev disponible' : 'Aucun container disponible (mode All)'}</p>
                </div>
            `;
        }
        grid.classList.remove('grid-single');
        return;
    }
}

// Actualiser automatiquement toutes les 30 secondes
const REFRESH_INTERVAL = 30000; // 30 secondes
let refreshInterval = null;
let timerInterval = null;
let timeUntilRefresh = 30; // secondes

// Mettre à jour l'affichage du compteur de rafraîchissement
function updateRefreshTimer() {
    if (!refreshTimer) return;
        
    if (timeUntilRefresh > 0) {
        refreshTimer.textContent = `Refresh dans ${timeUntilRefresh}s`;
        timeUntilRefresh--;
    } else {
        refreshTimer.textContent = 'Refresh...';
    }
}

// Démarrer le compteur de rafraîchissement
function startRefreshTimer() {
    // Arrêter le compteur existant s'il y en a un
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // Réinitialiser le compteur
    timeUntilRefresh = REFRESH_INTERVAL / 1000;
    updateRefreshTimer();
    
    // Mettre à jour le compteur toutes les secondes
    timerInterval = setInterval(() => {
        updateRefreshTimer();
    }, 1000);
}

// Arrêter le compteur de rafraîchissement
function stopRefreshTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (refreshTimer) {
        refreshTimer.textContent = '';
    }
}

function startAutoRefresh() {
    // Arrêter l'intervalle existant s'il y en a un
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Démarrer le compteur
    startRefreshTimer();
    
    // Rafraîchir toutes les 30 secondes (30000 ms)
    refreshInterval = setInterval(() => {
        // Rafraîchir silencieusement (sans afficher le loading)
        loadContainersFromAPI(true);
        // Réinitialiser le compteur après le rafraîchissement
        timeUntilRefresh = REFRESH_INTERVAL / 1000;
    }, REFRESH_INTERVAL);
}

// Démarrer le rafraîchissement automatique après le chargement initial
function initAutoRefresh() {
    // Attendre que le chargement initial soit terminé
    setTimeout(() => {
        startAutoRefresh();
    }, 1000);
}

// Arrêter le rafraîchissement automatique quand la page n'est plus visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page cachée : arrêter le rafraîchissement
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        stopRefreshTimer();
    } else {
        // Page visible : redémarrer le rafraîchissement
        startAutoRefresh();
    }
});

// ==================== CALENDAR VIEW ====================

// Initialiser la semaine actuelle (en UTC)
function initCurrentWeek() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    currentWeekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset, 0, 0, 0, 0));
}

// Configurer le switcher de vue
function setupViewSwitcher() {
    if (!viewSwitcher) return;
    
    viewSwitcher.addEventListener('click', (e) => {
        const clickedView = e.target.dataset.view;
        if (clickedView && clickedView !== currentView) {
            currentView = clickedView;
            updateViewSwitcher();
            switchView();
        }
    });
    
    // Navigation semaine précédente
    if (prevWeekBtn) {
        prevWeekBtn.addEventListener('click', () => {
            currentWeekStart = new Date(Date.UTC(
                currentWeekStart.getUTCFullYear(),
                currentWeekStart.getUTCMonth(),
                currentWeekStart.getUTCDate() - 7,
                0, 0, 0, 0
            ));
            loadMeetings();
        });
    }
    
    // Navigation semaine suivante
    if (nextWeekBtn) {
        nextWeekBtn.addEventListener('click', () => {
            currentWeekStart = new Date(Date.UTC(
                currentWeekStart.getUTCFullYear(),
                currentWeekStart.getUTCMonth(),
                currentWeekStart.getUTCDate() + 7,
                0, 0, 0, 0
            ));
            loadMeetings();
        });
    }
}

// Mettre à jour l'affichage du switcher de vue
function updateViewSwitcher() {
    if (!viewSwitcher) return;
    
    viewSwitcher.setAttribute('data-view', currentView);
    const options = viewSwitcher.querySelectorAll('.view-option');
    const indicator = viewSwitcher.querySelector('.view-switcher-indicator');
    
    options.forEach((option, index) => {
        if (option.dataset.view === currentView) {
            option.classList.add('active');
            if (indicator) {
                let left = 0;
                for (let i = 0; i < index; i++) {
                    left += options[i].offsetWidth;
                }
                const width = option.offsetWidth;
                indicator.style.width = `${width}px`;
                indicator.style.transform = `translateX(${left}px)`;
            }
        } else {
            option.classList.remove('active');
        }
    });
}

// Basculer entre les vues
function switchView() {
    if (currentView === 'containers') {
        if (containersView) containersView.style.display = '';
        if (calendarView) calendarView.style.display = 'none';
        if (containersControls) containersControls.style.display = '';
        if (calendarHeader) calendarHeader.style.display = 'none';
        if (countEl) countEl.style.display = '';
    } else if (currentView === 'calendar') {
        if (containersView) containersView.style.display = 'none';
        if (calendarView) calendarView.style.display = '';
        if (containersControls) containersControls.style.display = 'none';
        if (calendarHeader) calendarHeader.style.display = 'flex';
        if (countEl) countEl.style.display = 'none';
        loadMeetings();
        // Recalculer les hauteurs après le rendu
        setTimeout(() => {
            updateCalendarHeights();
        }, 100);
    }
}

// Mettre à jour les hauteurs des conteneurs de meetings
function updateCalendarHeights() {
    if (!calendar || currentView !== 'calendar') return;
    
    const calendarElement = calendar;
    const calendarGridElement = calendar.querySelector('.calendar-grid');
    const dayContainers = calendar.querySelectorAll('.calendar-day-meetings');
    
    if (calendarElement && calendarGridElement && dayContainers.length > 0) {
        dayContainers.forEach(container => {
            // Le conteneur est un item de la CSS grid (grid-row: 2 / -1), donc 100% suffit.
            container.style.height = '100%';
        });
    }
}

// Écouter les changements de taille de fenêtre
window.addEventListener('resize', () => {
    if (currentView === 'calendar') {
        updateCalendarHeights();
    }
});

// Charger les meetings depuis l'API
async function loadMeetings() {
    if (!calendar || !loading || !error) return;
    
    try {
        if (loading) {
            loading.style.display = 'block';
            if (loadingText) loadingText.textContent = 'Chargement des meetings...';
        }
        error.style.display = 'none';
        
        // Calculer la fin de la semaine (en UTC)
        const weekEnd = new Date(Date.UTC(
            currentWeekStart.getUTCFullYear(),
            currentWeekStart.getUTCMonth(),
            currentWeekStart.getUTCDate() + 6,
            23, 59, 59, 999
        ));
        
        const response = await fetch(`${MEETINGS_API_URL}?start=${currentWeekStart.toISOString()}&end=${weekEnd.toISOString()}`);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        meetings = data.meetings || [];
        
        updateCalendarWeekTitle();
        renderCalendar();
        
    } catch (err) {
        console.error('Erreur lors de la récupération des meetings:', err);
        if (error) {
            error.textContent = `Erreur lors de la récupération des meetings: ${err.message}`;
            error.style.display = 'block';
        }
        meetings = [];
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

// Mettre à jour le titre de la semaine (en UTC)
function updateCalendarWeekTitle() {
    if (!calendarWeekTitle || !currentWeekStart) return;
    
    const weekEnd = new Date(Date.UTC(
        currentWeekStart.getUTCFullYear(),
        currentWeekStart.getUTCMonth(),
        currentWeekStart.getUTCDate() + 6,
        0, 0, 0, 0
    ));
    
    const options = { day: 'numeric', month: 'long', timeZone: 'UTC' };
    const startStr = currentWeekStart.toLocaleDateString('fr-FR', options);
    const endStr = weekEnd.toLocaleDateString('fr-FR', options);
    
    // Vérifier si c'est la semaine actuelle (en UTC)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const nowWeekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset, 0, 0, 0, 0));
    
    const isCurrentWeek = currentWeekStart.getTime() === nowWeekStart.getTime();
    
    calendarWeekTitle.textContent = isCurrentWeek 
        ? `Semaine actuelle - ${startStr} au ${endStr}`
        : `${startStr} au ${endStr}`;
}

// Calculer les positions et largeurs des meetings qui se chevauchent pour un jour
function calculateMeetingPositions(dayMeetings) {
    if (dayMeetings.length === 0) return [];
    
    // Préparer les meetings avec leurs dates de début et fin
    const preparedMeetings = dayMeetings.map(meeting => {
        const start = new Date(meeting.meeting_start_at);
        const duration = meeting.meeting_duration_minutes || 30;
        const end = new Date(start.getTime() + duration * 60 * 1000);
        return { ...meeting, start, end, duration };
    }).sort((a, b) => a.start - b.start);
    
    // Pour chaque meeting, trouver tous ceux qui se chevauchent avec lui
    const positionedMeetings = preparedMeetings.map(meeting => {
        // Trouver tous les meetings qui se chevauchent avec ce meeting
        const overlapping = preparedMeetings.filter(other => 
            meeting.start < other.end && other.start < meeting.end
        );
        
        // Trier les meetings qui se chevauchent par heure de début
        const sortedOverlapping = [...overlapping].sort((a, b) => a.start - b.start);
        
        // Trouver la position de ce meeting dans le groupe qui se chevauche
        const position = sortedOverlapping.findIndex(m => m === meeting);
        const maxConcurrent = sortedOverlapping.length;
        
        // Calculer la largeur (chaque meeting prend 1/n de l'espace disponible)
        const width = 1 / maxConcurrent;
        
        return {
            ...meeting,
            position: position / maxConcurrent,
            width: width
        };
    });
    
    return positionedMeetings;
}

// Rendre le calendrier
function renderCalendar() {
    if (!calendar) return;
    
    // Créer la structure du calendrier
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7-19
    
    // Grouper les meetings par jour (en UTC)
    const meetingsByDay = {};
    days.forEach((day, dayIndex) => {
        const dayDate = new Date(Date.UTC(
            currentWeekStart.getUTCFullYear(),
            currentWeekStart.getUTCMonth(),
            currentWeekStart.getUTCDate() + dayIndex,
            0, 0, 0, 0
        ));
        const dayEnd = new Date(Date.UTC(
            currentWeekStart.getUTCFullYear(),
            currentWeekStart.getUTCMonth(),
            currentWeekStart.getUTCDate() + dayIndex,
            23, 59, 59, 999
        ));
        
        meetingsByDay[dayIndex] = meetings.filter(meeting => {
            if (!meeting.meeting_start_at) return false;
            const meetingStart = new Date(meeting.meeting_start_at);
            return meetingStart >= dayDate && meetingStart <= dayEnd;
        });
    });
    
    // Calculer les positions des meetings pour chaque jour
    const positionedMeetingsByDay = {};
    Object.keys(meetingsByDay).forEach(dayIndex => {
        positionedMeetingsByDay[dayIndex] = calculateMeetingPositions(meetingsByDay[dayIndex]);
    });
    
    let html = '<div class="calendar-grid">';

    // Coin haut-gauche (vide) + en-têtes des jours en colonnes (en UTC)
    html += '<div class="calendar-time-column calendar-corner"></div>';
    days.forEach((day, dayIndex) => {
        const dayDate = new Date(Date.UTC(
            currentWeekStart.getUTCFullYear(),
            currentWeekStart.getUTCMonth(),
            currentWeekStart.getUTCDate() + dayIndex,
            0, 0, 0, 0
        ));
        const isToday = isSameDay(dayDate, new Date());
        const gridColumn = dayIndex + 2; // 1 = colonne des heures
        const meetingCount = meetingsByDay[dayIndex]?.length || 0;

        html += `<div class="calendar-day-header ${isToday ? 'today' : ''}" style="grid-row: 1; grid-column: ${gridColumn};">
            <div class="day-name">${day} <span class="meeting-count">${meetingCount}</span></div>
        </div>`;
    });

    // Grille: heures (lignes) × jours (colonnes) - UI allégée avec une ligne par heure
    hours.forEach((hour, hourIndex) => {
        const gridRow = hourIndex + 2; // 1 = en-tête

        // Afficher uniquement l'heure (ex: "08h" au lieu de "08:00" et "08:30")
        const timeStr = `${String(hour).padStart(2, '0')}h`;
        html += `<div class="calendar-time-cell" style="grid-row: ${gridRow}; grid-column: 1;">${timeStr}</div>`;

        days.forEach((day, dayIndex) => {
            // Pour la détection "now", vérifier si on est dans cette heure (peu importe les minutes)
            const dayDate = new Date(Date.UTC(
                currentWeekStart.getUTCFullYear(),
                currentWeekStart.getUTCMonth(),
                currentWeekStart.getUTCDate() + dayIndex,
                hour, 0, 0, 0
            ));

            const now = new Date();
            const isNow = isSameDay(dayDate, now) &&
                         dayDate.getUTCHours() === now.getUTCHours();

            const gridColumn = dayIndex + 2;
            html += `<div class="calendar-cell ${isNow ? 'now' : ''}" style="grid-row: ${gridRow}; grid-column: ${gridColumn};"></div>`;
        });
    });

    html += '</div>';
    calendar.innerHTML = html;
    
    // Attendre que le DOM soit mis à jour pour calculer les hauteurs
    setTimeout(() => {
        // Ajouter les meetings avec positionnement absolu dans chaque colonne de jour
        Object.keys(positionedMeetingsByDay).forEach(dayIndex => {
            const dayMeetings = positionedMeetingsByDay[dayIndex];
            if (dayMeetings.length === 0) return;
            
            // Créer un conteneur pour les meetings de ce jour qui couvre toute la colonne
            const dayContainer = document.createElement('div');
            dayContainer.className = 'calendar-day-meetings';
            dayContainer.setAttribute('data-day-index', dayIndex);
            dayContainer.style.gridColumn = `${parseInt(dayIndex) + 2}`;
            dayContainer.style.gridRow = '2 / -1';
            dayContainer.style.pointerEvents = 'none';
            dayContainer.style.zIndex = '10';
            dayContainer.style.padding = '0';
            dayContainer.style.margin = '0';
            dayContainer.style.width = '100%';
            dayContainer.style.maxWidth = '100%';
            dayContainer.style.height = '100%';
            dayContainer.style.overflow = 'hidden';
            dayContainer.style.boxSizing = 'border-box';
            dayContainer.style.clipPath = 'inset(0)';
            
            // Ajouter le conteneur au grid
            const calendarGrid = calendar.querySelector('.calendar-grid');
            if (calendarGrid) {
                calendarGrid.appendChild(dayContainer);
            }
        
        dayMeetings.forEach(meeting => {
            const meetingStart = new Date(meeting.meeting_start_at);
            const duration = meeting.duration || 30;
            const startMinutes = meetingStart.getUTCHours() * 60 + meetingStart.getUTCMinutes();
            const startSlot = (startMinutes - 7 * 60) / 30; // Position précise en slots (en UTC) - plage 7h-19h
            const heightSlots = duration / 30;
            
            if (startSlot < 0 || startSlot >= 26) return; // Hors de la plage 7h-19h (13 heures × 2 créneaux = 26 slots)
            
            const identity = meeting.identities;
            const bookerName = identity?.fullname || meeting.participant_email || 'Inconnu';
            const company = identity?.company || '';
            const title = meeting.meeting_title || 'Meeting';
            
            const meetingElement = document.createElement('div');
            meetingElement.className = 'calendar-meeting';
            const leftPercent = meeting.position * 100;
            const widthPercent = meeting.width * 100;
            
            // S'assurer que le meeting ne dépasse jamais 100% de la largeur du conteneur
            const maxLeft = 100 - widthPercent;
            const clampedLeft = Math.min(leftPercent, maxLeft);
            const clampedWidth = Math.min(widthPercent, 100 - clampedLeft);
            
            meetingElement.style.position = 'absolute';
            meetingElement.style.left = `${clampedLeft}%`;
            meetingElement.style.width = `${clampedWidth}%`;
            meetingElement.style.maxWidth = `${100 - clampedLeft}%`;
            meetingElement.style.top = `${startSlot * 28}px`;
            meetingElement.style.height = `${heightSlots * 28}px`;
            meetingElement.style.zIndex = meeting.position + 1;
            meetingElement.style.pointerEvents = 'auto';
            meetingElement.style.boxSizing = 'border-box';
            meetingElement.style.paddingLeft = '4px';
            meetingElement.style.paddingRight = '4px';
            meetingElement.style.overflow = 'hidden';
            meetingElement.title = `${title} - ${bookerName}${company ? ' (' + company + ')' : ''}`;
            
            meetingElement.innerHTML = `
                <div class="meeting-title">${title}</div>
                <div class="meeting-booker">${bookerName}${company ? ` • ${company}` : ''}</div>
            `;
            
            // Ajouter l'event listener pour ouvrir la popup
            meetingElement.addEventListener('click', (e) => {
                e.stopPropagation();
                showMeetingPopup(meeting);
            });
            
            dayContainer.appendChild(meetingElement);
        });
        });
        
        // Mettre à jour les hauteurs après le rendu
        updateCalendarHeights();
    }, 0);
}

// Vérifier si deux dates sont le même jour (en UTC)
function isSameDay(date1, date2) {
    return date1.getUTCFullYear() === date2.getUTCFullYear() &&
           date1.getUTCMonth() === date2.getUTCMonth() &&
           date1.getUTCDate() === date2.getUTCDate();
}

// Afficher la popup avec les détails complets du meeting
function showMeetingPopup(meeting) {
    const popup = document.getElementById('meetingPopup');
    const popupTitle = popup.querySelector('.meeting-popup-title');
    const popupDateTime = document.getElementById('meetingPopupDateTime');
    const popupCreatedAt = document.getElementById('meetingPopupCreatedAt');
    const popupBooker = document.getElementById('meetingPopupBooker');
    const popupEmail = document.getElementById('meetingPopupEmail');
    const popupUrl = document.getElementById('meetingPopupUrl');
    const popupClose = popup.querySelector('.meeting-popup-close');
    const popupOverlay = popup.querySelector('.meeting-popup-overlay');
    
    if (!popup) return;
    
    const meetingStart = new Date(meeting.meeting_start_at);
    const identity = meeting.identities;
    const title = meeting.meeting_title || 'Meeting';
    const organizerEmail = meeting.participant_email || '';
    const identityEmail = identity?.email || '';
    const meetingUrl = meeting.meeting_url || '';
    
    const dateOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'UTC'
    };
    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'UTC'
    };
    
    const dateStr = meetingStart.toLocaleDateString('fr-FR', dateOptions);
    const timeStr = meetingStart.toLocaleTimeString('fr-FR', timeOptions);
    const dateTimeStr = `${dateStr} à ${timeStr} UTC`;
    
    let createdAtStr = 'Non renseigné';
    if (meeting.created_at) {
        const createdAt = new Date(meeting.created_at);
        const createdAtDateStr = createdAt.toLocaleDateString('fr-FR', dateOptions);
        const createdAtTimeStr = createdAt.toLocaleTimeString('fr-FR', timeOptions);
        createdAtStr = `${createdAtDateStr} à ${createdAtTimeStr}`;
    }
    
    popupTitle.textContent = title;
    popupDateTime.textContent = dateTimeStr;
    popupCreatedAt.textContent = createdAtStr;
    popupBooker.textContent = organizerEmail || 'Non renseigné';
    popupEmail.textContent = identityEmail || 'Non renseigné';
    
    if (meetingUrl) {
        popupUrl.href = meetingUrl;
        popupUrl.textContent = meetingUrl;
        popupUrl.style.pointerEvents = 'auto';
        popupUrl.style.color = '#4a9eff';
    } else {
        popupUrl.textContent = 'Non renseigné';
        popupUrl.href = '#';
        popupUrl.style.pointerEvents = 'none';
        popupUrl.style.color = '#666';
    }
    
    popup.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    const closePopup = () => {
        popup.style.display = 'none';
        document.body.style.overflow = '';
        popupClose.removeEventListener('click', closePopup);
        popupOverlay.removeEventListener('click', closePopup);
    };
    
    popupClose.addEventListener('click', closePopup);
    popupOverlay.addEventListener('click', closePopup);
    
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closePopup();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}
