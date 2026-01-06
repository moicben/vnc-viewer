export default async function handler(req, res) {
  try {
    // Configuration depuis les variables d'environnement
    const INCUS_API_URL = process.env.INCUS_API_URL;
    const INCUS_API_KEY = process.env.INCUS_API_KEY;
    const IP_PREFIX = process.env.IP_PREFIX || '10.225.44.';

    if (!INCUS_API_KEY) {
      throw new Error('INCUS_API_KEY n\'est pas configurée');
    }

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
}
