// Gestion des appels API

import { CONFIG_API_URL, INCUS_API_URL, MEETINGS_API_URL, updateConfig } from './config.js';

// Charger la configuration depuis l'API
export async function loadConfig() {
    const configResponse = await fetch(CONFIG_API_URL);
    
    if (!configResponse.ok) {
        throw new Error(`Erreur HTTP ${configResponse.status}: ${configResponse.statusText}`);
    }
    
    const config = await configResponse.json();
    
    if (!config.incusServer || !config.ipPrefix) {
        throw new Error('Configuration incomplète reçue du serveur');
    }
    
    updateConfig(config);
    return config;
}

// Récupérer les containers depuis l'API Incus via le proxy serveur
export async function loadContainersFromAPI(silent = false) {
    try {
        const response = await fetch(INCUS_API_URL);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Le serveur retourne déjà les containers traités
        if (data.containers && Array.isArray(data.containers)) {
            return data.containers;
        } else {
            console.warn('Format de données API non reconnu:', data);
            return [];
        }
    } catch (err) {
        console.error('Erreur lors de la récupération des containers:', err);
        throw err;
    }
}

// Charger les meetings depuis l'API
export async function loadMeetingsFromAPI(startDate, endDate) {
    const startDateUTC = new Date(Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        0, 0, 0, 0
    ));
    
    const endDateUTC = new Date(Date.UTC(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate() + 3,
        23, 59, 59, 999
    ));
    
    const response = await fetch(`${MEETINGS_API_URL}?start=${startDateUTC.toISOString()}&end=${endDateUTC.toISOString()}`);
    
    if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    return data.meetings || [];
}
