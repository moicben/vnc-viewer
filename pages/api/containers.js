export default async function handler(req, res) {
  try {
    // Configuration depuis les variables d'environnement
    const INCUS_SERVER = process.env.INCUS_SERVER;
    const IP_PREFIX = process.env.IP_PREFIX;
    
    // Vérifier que les variables d'environnement nécessaires sont définies
    const missingVars = [];
    if (!INCUS_SERVER) missingVars.push('INCUS_SERVER');
    if (!IP_PREFIX) missingVars.push('IP_PREFIX');

    if (missingVars.length > 0) {
      console.error('Variables d\'environnement manquantes:', missingVars.join(', '));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({
        error: 'Configuration incomplète',
        message: `Variables d'environnement manquantes: ${missingVars.join(', ')}. Veuillez les ajouter dans votre fichier .env.`,
        missingVariables: missingVars
      });
      return;
    }
    
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
    
    const INCUS_HOST = extractHostname(INCUS_SERVER);
    const VNC_BASE_URL = `${INCUS_SERVER}/vnc.html`;
    
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
          vncUrl: `${VNC_BASE_URL}#host=${INCUS_HOST}&autoconnect=true&scaling=local&path=websockify?token=${ip}`
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Erreur lors de la récupération des containers',
      message: error.message
    });
  }
}

