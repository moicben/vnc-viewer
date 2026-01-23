// Configuration et constantes

// Configuration (chargée depuis l'API)
export let INCUS_SERVER = '';
export let IP_PREFIX = '';
export let VNC_BASE_URL = '';

// URLs API
export const INCUS_API_URL = '/api/instances';
export const CONFIG_API_URL = '/api/config';
export const MEETINGS_API_URL = '/api/meetings';

// Configuration du rafraîchissement
export const REFRESH_INTERVAL = 30000; // 30 secondes

// Fonction pour extraire le hostname depuis l'URL complète
export function extractHostname(url) {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname;
  } catch {
    // Si l'URL n'a pas de protocole, retourner tel quel
    return url.replace(/^https?:\/\//, '').split(':')[0].split('/')[0];
  }
}

// Fonction pour mettre à jour la configuration
export function updateConfig(config) {
  INCUS_SERVER = config.incusServer;
  IP_PREFIX = config.ipPrefix;
  VNC_BASE_URL = `${INCUS_SERVER}/vnc.html`;
}
