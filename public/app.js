// Variables pour les éléments DOM (seront initialisées après le chargement du DOM)
let grid = null;
let loading = null;
let error = null;
let countEl = null;
let modeSwitcher = null;
let refreshTimer = null;

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

// État des containers
let allContainers = [];
let currentMode = 'all'; // 'all' ou 'dev'
let containersCache = new Map(); // Cache des éléments DOM des containers

// Initialiser les références aux éléments DOM
function initDOMElements() {
    grid = document.getElementById('grid');
    loading = document.getElementById('loading');
    error = document.getElementById('error');
    countEl = document.getElementById('count');
    modeSwitcher = document.getElementById('modeSwitcher');
    refreshTimer = document.getElementById('refreshTimer');
    
    // Vérifier que tous les éléments critiques existent
    if (!grid || !loading || !error || !countEl || !modeSwitcher) {
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

// Obtenir tous les containers à précharger (c-template + tous les autres actifs)
function getAllContainersToPreload() {
    if (allContainers.length === 0) {
        return [];
    }
    
    // Inclure c-template + tous les autres containers actifs
    return allContainers.filter(c => 
        c.name === 'c-template' || (c.name !== 'c-template' && c.status === 'Running')
    );
}

// Obtenir les containers à afficher selon le mode
function getContainersToDisplay() {
    if (allContainers.length === 0) {
        return [];
    }
    
    if (currentMode === 'dev') {
        // Mode Dev : seulement c-template
        return allContainers.filter(c => c.name === 'c-template');
    } else {
        // Mode All : tous les containers actifs sauf c-template
        return allContainers.filter(c => c.name !== 'c-template' && c.status === 'Running');
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

