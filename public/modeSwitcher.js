// Gestion du mode switcher

import { modeSwitcher } from './dom.js';
import { currentMode, setCurrentMode, loadContainers } from './containers.js';

// Mettre à jour l'affichage du switcher
export function updateModeSwitcher() {
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

// Configurer le switcher de mode
export function setupModeSwitcher() {
    if (!modeSwitcher) return;
    
    modeSwitcher.addEventListener('click', (e) => {
        const clickedMode = e.target.dataset.mode;
        if (clickedMode && clickedMode !== currentMode) {
            setCurrentMode(clickedMode);
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
