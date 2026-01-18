import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    // Configuration Supabase depuis les variables d'environnement
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vgijwvybcggjkezzxatg.supabase.co';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaWp3dnliY2dnamtlenp4YXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk4NDc1NDQsImV4cCI6MjA2NTQyMzU0NH0.oE5VEP-ZRYJ8mUbSs9gJ51I1-BeqeCf4FNRUUoXgJ9k';
    
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
    
    // Récupérer les meetings de la semaine avec les identités
    const { data: meetings, error } = await supabase
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
        identity_id,
        identities (
          id,
          fullname,
          company,
          email
        )
      `)
      .gte('meeting_start_at', monday.toISOString())
      .lte('meeting_start_at', sunday.toISOString())
      .order('meeting_start_at', { ascending: true });
    
    if (error) {
      throw error;
    }
    
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
