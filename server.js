import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Importer les handlers depuis les fichiers API (source unique de vérité)
import configHandler from './api/config.js';
import instancesHandler from './api/instances.js';
import containersHandler from './api/containers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour parser le JSON
app.use(express.json());

// Servir les fichiers statiques depuis le dossier public à la racine
app.use(express.static(join(__dirname, 'public')));
// Servir aussi la racine pour index.html
app.use(express.static(__dirname));

// Utiliser les handlers depuis api/ pour éviter la duplication
app.get('/api/config', configHandler);
app.get('/api/instances', instancesHandler);
app.get('/api/containers', containersHandler);

// Route pour servir index.html pour toutes les autres routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📡 API disponible sur http://localhost:${PORT}/api/containers`);
});

