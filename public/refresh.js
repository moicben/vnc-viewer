// Gestion du rafraîchissement automatique

import { REFRESH_INTERVAL } from './config.js';
import { refreshTimer } from './dom.js';
import { loadContainersFromAPI } from './api.js';
import { synchronizeContainersDOM, updateContainersVisibility, getContainersToDisplay, setAllContainers } from './containers.js';
import { countEl } from './dom.js';

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

export function startAutoRefresh() {
    // Arrêter l'intervalle existant s'il y en a un
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    
    // Démarrer le compteur
    startRefreshTimer();
    
    // Rafraîchir toutes les 30 secondes (30000 ms)
    refreshInterval = setInterval(async () => {
        try {
            // Rafraîchir silencieusement (sans afficher le loading)
            const newContainers = await loadContainersFromAPI();
            
            if (newContainers && Array.isArray(newContainers)) {
                const previousContainers = new Map(
                    Array.from(document.querySelectorAll('.grid-item')).map(item => {
                        const name = item.dataset.containerName || 
                            item.querySelector('.grid-item-header span:first-child')?.textContent;
                        return name ? [name, { name }] : null;
                    }).filter(Boolean)
                );
                
                const newContainersMap = new Map(newContainers.map(c => [c.name, c]));
                
                // Synchroniser les containers : ajouter les nouveaux, supprimer les supprimés
                synchronizeContainersDOM(previousContainers, newContainersMap);
                setAllContainers(newContainers);
                updateContainersVisibility();
                
                const containersToDisplay = getContainersToDisplay();
                if (countEl) countEl.textContent = `${containersToDisplay.length}/${newContainers.length} containers`;
            }
            
            // Réinitialiser le compteur après le rafraîchissement
            timeUntilRefresh = REFRESH_INTERVAL / 1000;
        } catch (err) {
            console.error('Erreur lors du rafraîchissement automatique:', err);
        }
    }, REFRESH_INTERVAL);
}

// Démarrer le rafraîchissement automatique après le chargement initial
export function initAutoRefresh() {
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
