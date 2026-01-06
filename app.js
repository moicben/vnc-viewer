const grid = document.getElementById('grid');
const loading = document.getElementById('loading');
const error = document.getElementById('error');
const refreshBtn = document.getElementById('refreshBtn');
const countEl = document.getElementById('count');
const containersInput = document.getElementById('containersInput');

// Configuration
const INCUS_SERVER = '109.176.198.25';
const INCUS_PORT = '9443';
const IP_PREFIX = '10.225.44.';
const VNC_BASE_URL = `https://${INCUS_SERVER}:${INCUS_PORT}/vnc.html`;

// Charger les containers au démarrage
loadContainers();

// Écouter le bouton d'actualisation
refreshBtn.addEventListener('click', () => {
    loadContainers();
});

// Écouter la touche Entrée dans l'input
containersInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loadContainers();
    }
});

// Écouter les changements dans l'input (optionnel, pour mise à jour en temps réel)
containersInput.addEventListener('blur', () => {
    loadContainers();
});

function loadContainers() {
    loading.style.display = 'block';
    error.style.display = 'none';
    grid.innerHTML = '';
    
    try {
        const inputValue = containersInput.value.trim();
        
        if (!inputValue) {
            displayContainers([]);
            countEl.textContent = '0 containers';
            loading.style.display = 'none';
            return;
        }
        
        // Parser les numéros séparés par des virgules
        const ipSuffixes = inputValue.split(',')
            .map(s => s.trim())
            .filter(s => s); // Filtrer les valeurs vides
        
        if (ipSuffixes.length === 0) {
            displayContainers([]);
            countEl.textContent = '0 containers';
            loading.style.display = 'none';
            return;
        }
        
        // Générer les containers avec noms et IPs automatiques
        const containers = ipSuffixes.map((suffix, index) => {
            const ip = `${IP_PREFIX}${suffix}`;
            return {
                name: `${index + 1}`,
                ip: ip,
                vncUrl: `${VNC_BASE_URL}#host=${INCUS_SERVER}&port=${INCUS_PORT}&autoconnect=true&scaling=local&path=websockify?token=${ip}`
            };
        });
        
        displayContainers(containers);
        countEl.textContent = `${containers.length} container${containers.length !== 1 ? 's' : ''}`;
        
    } catch (err) {
        console.error('Erreur:', err);
        error.textContent = `Erreur: ${err.message}`;
        error.style.display = 'block';
        grid.innerHTML = '';
    } finally {
        loading.style.display = 'none';
    }
}

function displayContainers(containers) {
    if (containers.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h2>Aucun container</h2>
                <p>Saisissez les numéros de containers dans le champ ci-dessus (ex: 181,182,183)</p>
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

