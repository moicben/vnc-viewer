// Gestion des containers

import { INCUS_SERVER, VNC_BASE_URL, extractHostname } from './config.js';
import { grid, countEl, loading, error } from './dom.js';

// État des containers
export let allContainers = [];
export let currentMode = 'all'; // 'all' ou 'dev'
let containersCache = new Map(); // Cache des éléments DOM des containers

// Obtenir tous les containers à précharger (c-template + b-template + wireguard + android + c-test + tous les autres actifs)
export function getAllContainersToPreload() {
    if (allContainers.length === 0) {
        return [];
    }
    
    // Inclure c-template + b-template + wireguard + android + c-test + tous les autres containers actifs
    return allContainers.filter(c => 
        c.name === 'c-template' || c.name === 'b-template' || c.name === 'wireguard' || c.name === 'android' || c.name === 'c-test' || (c.name !== 'c-template' && c.name !== 'b-template' && c.name !== 'wireguard' && c.name !== 'android' && c.name !== 'c-test' && c.status === 'Running')
    );
}

// Obtenir les containers à afficher selon le mode
export function getContainersToDisplay() {
    if (allContainers.length === 0) {
        return [];
    }
    
    if (currentMode === 'dev') {
        // Mode Dev : c-template + b-template + wireguard + android + c-test
        return allContainers.filter(c => c.name === 'c-template' || c.name === 'b-template' || c.name === 'wireguard' || c.name === 'android' || c.name === 'c-test');
    } else {
        // Mode All : tous les containers actifs sauf c-template, b-template, wireguard, android et c-test
        return allContainers.filter(c => c.name !== 'c-template' && c.name !== 'b-template' && c.name !== 'wireguard' && c.name !== 'android' && c.name !== 'c-test' && c.status === 'Running');
    }
}

// Mettre à jour le mode
export function setCurrentMode(mode) {
    currentMode = mode;
}

// Mettre à jour les containers
export function setAllContainers(containers) {
    allContainers = containers;
}

// Synchroniser le DOM : ajouter les nouveaux containers, supprimer les supprimés
export function synchronizeContainersDOM(previousContainers, newContainersMap) {
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

// Précharger tous les containers dans le DOM
export function preloadAllContainers() {
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
export function updateContainersVisibility() {
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

export function displayContainers(containers) {
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

export function loadContainers() {
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
