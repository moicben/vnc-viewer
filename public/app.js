// Vérifier que tous les éléments DOM existent
const grid = document.getElementById('grid');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const refreshBtn = document.getElementById('refreshBtn');
const countEl = document.getElementById('count');
const dropdownBtn = document.getElementById('dropdownBtn');
const dropdownBtnText = document.getElementById('dropdownBtnText');
const dropdownMenu = document.getElementById('dropdownMenu');
const dropdownList = document.getElementById('dropdownList');
const selectAllBtn = document.getElementById('selectAllBtn');
const deselectAllBtn = document.getElementById('deselectAllBtn');

// Vérifier que tous les éléments critiques existent
if (!grid || !loading || !error || !refreshBtn || !countEl || !dropdownBtn || 
    !dropdownBtnText || !dropdownMenu || !dropdownList || !selectAllBtn || !deselectAllBtn) {
    console.error('Erreur: Certains éléments DOM sont manquants');
    if (error) {
        error.textContent = 'Erreur: Éléments DOM manquants. Vérifiez que tous les éléments sont présents dans le HTML.';
        error.style.display = 'block';
    }
}

// Configuration (chargée depuis l'API)
let INCUS_SERVER = '';
let INCUS_PORT = '';
let IP_PREFIX = '';
let VNC_BASE_URL = '';
// Utiliser le proxy serveur pour éviter les problèmes CORS
const INCUS_API_URL = '/api/instances';
const CONFIG_API_URL = '/api/config';

// État des containers
let allContainers = [];
let selectedContainers = new Set();

// Charger la configuration puis les containers au démarrage
async function init() {
    // Vérifier que les éléments critiques existent
    if (!loading || !error) {
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
        
        if (!config.incusServer || !config.incusPort || !config.ipPrefix) {
            throw new Error('Configuration incomplète reçue du serveur');
        }
        
        INCUS_SERVER = config.incusServer;
        INCUS_PORT = config.incusPort;
        IP_PREFIX = config.ipPrefix;
        VNC_BASE_URL = `https://${INCUS_SERVER}:${INCUS_PORT}/vnc.html`;
        
        // Charger les containers une fois la config chargée
        await loadContainersFromAPI();
        loadContainers();
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

// Initialiser les event listeners seulement si les éléments existent
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        loadContainersFromAPI();
        loadContainers();
    });
}

// Toggle dropdown
if (dropdownBtn && dropdownMenu) {
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
    });
}

// Fermer le dropdown en cliquant ailleurs
if (dropdownBtn && dropdownMenu) {
    document.addEventListener('click', (e) => {
        if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.style.display = 'none';
        }
    });
}

// Boutons sélectionner/désélectionner tout
if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
        allContainers.forEach(container => selectedContainers.add(container.name));
        updateDropdownDisplay();
        loadContainers();
    });
}

if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
        selectedContainers.clear();
        updateDropdownDisplay();
        loadContainers();
    });
}

// Récupérer les containers depuis l'API Incus via le proxy serveur
async function loadContainersFromAPI() {
    try {
        const response = await fetch(INCUS_API_URL);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Le serveur retourne déjà les containers traités
        if (data.containers && Array.isArray(data.containers)) {
            allContainers = data.containers;
            updateDropdownDisplay();
        } else {
            console.warn('Format de données API non reconnu:', data);
            allContainers = [];
        }
    } catch (err) {
        console.error('Erreur lors de la récupération des containers:', err);
        if (error) {
            error.textContent = `Erreur lors de la récupération: ${err.message}`;
            error.style.display = 'block';
        }
        allContainers = [];
    }
}

// Mettre à jour l'affichage du dropdown
function updateDropdownDisplay() {
    if (!dropdownList) {
        console.error('dropdownList est null');
        return;
    }
    
    if (allContainers.length === 0) {
        dropdownList.innerHTML = '<div class="dropdown-empty">Aucun container disponible</div>';
        return;
    }
    
    // Sélectionner "scheduler" par défaut si aucun container n'est sélectionné
    if (selectedContainers.size === 0) {
        const schedulerContainer = allContainers.find(c => c.name === 'scheduler');
        if (schedulerContainer) {
            selectedContainers.add('scheduler');
        }
    }
    
    dropdownList.innerHTML = allContainers.map(container => `
        <label class="dropdown-item">
            <input 
                type="checkbox" 
                value="${container.name}"
                ${selectedContainers.has(container.name) ? 'checked' : ''}
                class="container-checkbox">
            <span class="container-name" title="${container.name}">${container.name}</span>
        </label>
    `).join('');
    
    // Ajouter les event listeners aux checkboxes
    dropdownList.querySelectorAll('.container-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const containerName = e.target.value;
            if (e.target.checked) {
                selectedContainers.add(containerName);
            } else {
                selectedContainers.delete(containerName);
            }
            updateDropdownButtonText();
            loadContainers();
        });
    });
    
    updateDropdownButtonText();
    
    // Charger les containers si scheduler a été sélectionné par défaut
    if (selectedContainers.size > 0) {
        loadContainers();
    }
}

// Mettre à jour le texte du bouton dropdown
function updateDropdownButtonText() {
    if (!dropdownBtnText) return;
    
    const count = selectedContainers.size;
    if (count === 0) {
        dropdownBtnText.textContent = 'Sélectionner des containers';
    } else {
        // Afficher les noms des containers sélectionnés séparés par des virgules
        const selectedNames = Array.from(selectedContainers);
        const namesText = selectedNames.join(', ');
        dropdownBtnText.textContent = namesText;
    }
}

function loadContainers() {
    if (!loading || !error || !grid) {
        console.error('Éléments DOM manquants dans loadContainers');
        return;
    }
    
    loading.style.display = 'block';
    error.style.display = 'none';
    grid.innerHTML = '';
    
    try {
        if (selectedContainers.size === 0) {
            displayContainers([]);
            if (countEl) countEl.textContent = '0 containers';
            loading.style.display = 'none';
            return;
        }
        
        // Générer les containers sélectionnés avec leurs IPs
        const containers = Array.from(selectedContainers)
            .map(containerName => {
                const container = allContainers.find(c => c.name === containerName);
                if (!container || !container.ip) {
                    return null;
                }
                return {
                    name: container.name,
                    ip: container.ip,
                    vncUrl: `${VNC_BASE_URL}#host=${INCUS_SERVER}&port=${INCUS_PORT}&autoconnect=true&scaling=local&path=websockify?token=${container.ip}`
                };
            })
            .filter(c => c !== null);
        
        displayContainers(containers);
        if (countEl) countEl.textContent = `${containers.length} container${containers.length !== 1 ? 's' : ''}`;
        
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

function displayContainers(containers) {
    if (!grid) {
        console.error('grid est null dans displayContainers');
        return;
    }
    
    if (containers.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h2>Aucun container</h2>
                <p>Sélectionnez des containers dans le menu déroulant ci-dessus</p>
            </div>
        `;
        grid.classList.remove('grid-single');
        return;
    }
    
    // Ajouter une classe si un seul container pour l'afficher en pleine largeur
    if (containers.length === 1) {
        grid.classList.add('grid-single');
    } else {
        grid.classList.remove('grid-single');
    }
    
    grid.innerHTML = containers.map(container => `
        <div class="grid-item">
            <div class="grid-item-header">
                <span>${container.name}</span>
                <span class="ip">${container.ip}</span>
            </div>
            <iframe 
                src="${container.vncUrl}" 
                class="grid-item-iframe"
                title="${container.name}"
                allow="fullscreen"
                loading="lazy">
            </iframe>
        </div>
    `).join('');
}

// Actualiser automatiquement toutes les 30 secondes (optionnel)
// setInterval(() => {
//     loadContainers();
// }, 30000);

