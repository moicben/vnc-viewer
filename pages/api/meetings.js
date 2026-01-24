import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Configuration Supabase depuis les variables d'environnement
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      const missingVars = [];
      if (!SUPABASE_URL) missingVars.push('SUPABASE_URL');
      if (!SUPABASE_ANON_KEY) missingVars.push('SUPABASE_ANON_KEY');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(500).json({
        error: 'Configuration incomplète',
        message: `Variables d'environnement manquantes: ${missingVars.join(', ')}. Veuillez les ajouter dans votre fichier .env.`,
        missingVariables: missingVars
      });
      return;
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Utiliser les paramètres de requête si fournis, sinon utiliser la semaine actuelle
    let monday, sunday;
    
    if (req.query.start && req.query.end) {
      monday = new Date(req.query.start);
      sunday = new Date(req.query.end);
    } else {
      // Calculer le début et la fin de la semaine actuelle (Lundi au Dimanche)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Dimanche, 1 = Lundi, etc.
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Ajuster pour que Lundi soit le premier jour
      
      monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      
      sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
    }
    
    // Récupérer les meetings de la semaine
    const { data: meetingsData, error: meetingsError } = await supabase
      .from('meetings')
      .select(`
        id,
        internal_id,
        participant_email,
        status,
        meeting_start_at,
        meeting_title,
        meeting_url,
        comment,
        created_at,
        identity_id
      `)
      .gte('meeting_start_at', monday.toISOString())
      .lte('meeting_start_at', sunday.toISOString())
      .order('meeting_start_at', { ascending: true });
    
    if (meetingsError) {
      throw meetingsError;
    }
    
    // Récupérer les identités séparément pour tous les identity_id uniques
    const identityIds = [...new Set(meetingsData.filter(m => m.identity_id).map(m => m.identity_id))];
    let identitiesMap = new Map();
    
    if (identityIds.length > 0) {
      const { data: identities, error: identitiesError } = await supabase
        .from('identities')
        .select('id, fullname, company, email')
        .in('id', identityIds);
      
      if (identitiesError) {
        console.error('Erreur lors de la récupération des identités:', identitiesError);
      } else if (identities && identities.length > 0) {
        identities.forEach(i => {
          if (i.id) {
            identitiesMap.set(i.id, i);
          }
        });
      }
    }
    
    // Fusionner les données : ajouter l'identité à chaque meeting
    const meetings = meetingsData.map(meeting => ({
      ...meeting,
      identities: meeting.identity_id ? (identitiesMap.get(meeting.identity_id) || null) : null
    }));
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      meetings: meetings || [],
      weekStart: monday.toISOString(),
      weekEnd: sunday.toISOString()
    });
    
  } catch (error) {
    console.error('Erreur dans /api/meetings:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Erreur lors de la récupération des meetings',
      message: error.message
    });
  }
}
