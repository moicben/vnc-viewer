import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration depuis les variables d'environnement
const INCUS_SERVER = process.env.INCUS_SERVER || '109.176.198.25';
const INCUS_PORT = process.env.INCUS_PORT || '9443';
const IP_PREFIX = process.env.IP_PREFIX || '10.225.44.';
const INCUS_API_URL = process.env.INCUS_API_URL || 'https://agi.worksbase.pro/instances';
const INCUS_API_KEY = process.env.INCUS_API_KEY || '';
const VNC_BASE_URL = `https://${INCUS_SERVER}:${INCUS_PORT}/vnc.html`;

// Middleware pour parser le JSON
app.use(express.json());

// Servir les fichiers statiques 
app.use(express.static(__dirname));

// Route API pour récupérer la configuration (valeurs non sensibles)
app.get('/api/config', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    incusServer: INCUS_SERVER,
    incusPort: INCUS_PORT,
    ipPrefix: IP_PREFIX
  });
});

// Route API pour récupérer les containers depuis l'API Incus
app.get('/api/instances', async (req, res) => {
  try {
    
    // Faire la requête à l'API Incus depuis le serveur (pas de problème CORS)
    const response = await fetch(INCUS_API_URL, {
      headers: {
        'x-api-key': INCUS_API_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Traiter les données de l'API Incus
    // Format: [{"name":"scheduler","type":"container","status":"Running","ips":[{"interface":"eth0","address":"10.225.44.181"}]}, ...]
    let containers = [];
    
    if (Array.isArray(data)) {
      containers = data.map(instance => {
        // Extraire le suffixe IP depuis l'IP complète
        let ipSuffix = null;
        let ip = null;
        
        if (instance.ips && Array.isArray(instance.ips) && instance.ips.length > 0) {
          // Chercher l'IP qui correspond au préfixe
          const ipObj = instance.ips.find(ipItem => 
            ipItem.address && ipItem.address.startsWith(IP_PREFIX)
          );
          if (ipObj && ipObj.address) {
            ip = ipObj.address;
            ipSuffix = ip.replace(IP_PREFIX, '');
          }
        }
        
        // Si pas d'IP trouvée, essayer d'extraire depuis le nom (ex: booker-181 -> 181)
        if (!ipSuffix && instance.name) {
          const match = instance.name.match(/(\d+)$/);
          if (match) {
            ipSuffix = match[1];
            ip = `${IP_PREFIX}${ipSuffix}`;
          }
        }
        
        return {
          name: instance.name || 'unknown',
          ipSuffix: ipSuffix,
          ip: ip,
          status: instance.status || 'Unknown',
          type: instance.type || 'container'
        };
      }).filter(container => container.ipSuffix); // Filtrer ceux sans IP valide
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      containers: containers,
      count: containers.length
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Erreur lors de la récupération des containers',
      message: error.message
    });
  }
});

// Route API pour les containers (ancienne route, gardée pour compatibilité)
app.get('/api/containers', async (req, res) => {
  try {
    // Récupérer les containers depuis les variables d'environnement
    // Format simplifié: CONTAINERS='181,182' ou CONTAINERS='["181", "182"]'
    const containersEnv = process.env.CONTAINERS;
    let ipSuffixes = [];
    
    if (containersEnv) {
      try {
        // Essayer de parser comme JSON array d'abord
        if (containersEnv.trim().startsWith('[')) {
          ipSuffixes = JSON.parse(containersEnv);
        } else if (containersEnv.trim().startsWith('{')) {
          // Format avec accolades: {"181", "182"} - extraire les valeurs entre guillemets
          const matches = containersEnv.match(/"([^"]+)"/g);
          ipSuffixes = matches ? matches.map(m => m.replace(/"/g, '')) : [];
        } else {
          // Format simple: 181,182 ou "181", "182"
          ipSuffixes = containersEnv.split(',').map(s => s.trim().replace(/['"]/g, ''));
        }
      } catch (e) {
        // Si le parsing JSON échoue, traiter comme une liste séparée par des virgules
        ipSuffixes = containersEnv.split(',').map(s => s.trim().replace(/['"]/g, ''));
      }
    }
    
    // Générer les containers avec noms et IPs automatiques
    const containersWithVNC = ipSuffixes
      .filter(suffix => suffix) // Filtrer les valeurs vides
      .map((suffix, index) => {
        const ip = `${IP_PREFIX}${suffix}`;
        return {
          name: `${index + 1}`,
          ip: ip,
          vncUrl: `${VNC_BASE_URL}#host=${INCUS_SERVER}&port=${INCUS_PORT}&autoconnect=true&scaling=local&path=websockify?token=${ip}`
        };
      });
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      containers: containersWithVNC,
      count: containersWithVNC.length
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des containers',
      message: error.message
    });
  }
});

// Route pour servir index.html pour toutes les autres routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📡 API disponible sur http://localhost:${PORT}/api/containers`);
});

