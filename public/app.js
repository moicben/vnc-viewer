// Point d'entrée principal de l'application

import { initDOMElements } from './dom.js';
import { loadConfig, loadContainersFromAPI } from './api.js';
import { setAllContainers, loadContainers } from './containers.js';
import { setupModeSwitcher, updateModeSwitcher } from './modeSwitcher.js';
import { setupViewSwitcher, initCurrentWeek } from './calendar.js';
import { initAutoRefresh } from './refresh.js';
import { loading, error, countEl } from './dom.js';

// Charger la configuration puis les containers au démarrage
async function init() {
    // Initialiser les éléments DOM d'abord
    if (!initDOMElements()) {
        console.error('Éléments DOM critiques manquants');
        return;
    }
    
    try { 
        if (loading) loading.style.display = 'block';
        
        // Charger la configuration
        await loadConfig();
        
        // Configurer le switcher de mode maintenant que les éléments DOM sont initialisés
        setupModeSwitcher();
        
        // Configurer le switcher de vue
        setupViewSwitcher();
        
        // Initialiser la semaine actuelle pour le calendrier
        initCurrentWeek();
        
        // Charger les containers une fois la config chargée
        const containers = await loadContainersFromAPI();
        setAllContainers(containers);
        
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

// Attendre que le DOM soit complètement chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
