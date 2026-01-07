export default async function handler(req, res) {
  try {
    // Configuration depuis les variables d'environnement
    const INCUS_SERVER = process.env.INCUS_SERVER ;
    const IP_PREFIX = process.env.IP_PREFIX;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      incusServer: INCUS_SERVER,
      ipPrefix: IP_PREFIX
    });
  } catch (error) {
    console.error('Erreur dans /api/config:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Erreur lors de la récupération de la configuration',
      message: error.message
    });
  }
}
