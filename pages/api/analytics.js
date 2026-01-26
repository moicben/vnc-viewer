import { createClient } from '@supabase/supabase-js';

async function countUniqueMeetingsForEventType({ supabase, eventType, meetingIds }) {
  if (!meetingIds || meetingIds.length === 0) return 0;

  // Supabase/PostgREST limite la taille des pages de résultats.
  // On paginate et on déduplique côté serveur pour obtenir un compte exact.
  const uniqueMeetingIds = new Set();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('events')
      .select('meeting_id')
      .eq('event_type', eventType)
      .in('meeting_id', meetingIds)
      .range(from, to);

    if (error) throw error;

    for (const row of data || []) {
      if (row?.meeting_id !== null && row?.meeting_id !== undefined) {
        uniqueMeetingIds.add(row.meeting_id);
      }
    }

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return uniqueMeetingIds.size;
}

async function fetchPastMeetingsPaginated({ supabase, nowIso, startDate, endDate, identityId }) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;

    let query = supabase
      .from('meetings')
      .select('id, internal_id, meeting_start_at, status, identity_id')
      .lt('meeting_start_at', nowIso)
      .order('meeting_start_at', { ascending: true })
      .range(from, to);

    if (startDate && endDate) {
      query = query
        .gte('meeting_start_at', startDate.toISOString())
        .lte('meeting_start_at', endDate.toISOString());
    }

    if (identityId) {
      query = query.eq('identity_id', identityId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const page = data || [];
    rows.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

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
    
    const now = new Date();
    const nowIso = now.toISOString();
    
    // Récupérer tous les meetings passés (ou filtrés par date si fourni)
    let startDate = null;
    let endDate = null;
    const identityIdRaw = req.query.identityId;
    const identityId = identityIdRaw ? String(identityIdRaw) : null;
    
    if (req.query.start && req.query.end) {
      startDate = new Date(req.query.start);
      endDate = new Date(req.query.end);
      endDate.setHours(23, 59, 59, 999);
    }
    
    // 1) Charger les meetings passés (paginés) pour construire la liste d'identités sur la période.
    const meetingsAll = await fetchPastMeetingsPaginated({
      supabase,
      nowIso,
      startDate,
      endDate,
      identityId: null
    });

    // 2) Charger les meetings passés (paginés) filtrés par identité (si fournie) pour le funnel.
    const meetingsFiltered = await fetchPastMeetingsPaginated({
      supabase,
      nowIso,
      startDate,
      endDate,
      identityId
    });

    const meetingsPlanned = meetingsFiltered.length;
    
    // 2. Compter les participants détectés (meetings passés où le status indique une présence)
    // NOTE: on exclut explicitement "booked" (ex: meeting planifié mais non réellement "présent").
    const pastMeetings = (meetingsFiltered || []).filter((meeting) => {
      return meeting.status !== 'no_participant_detected' && meeting.status !== 'booked';
    });
    
    const participantsDetected = pastMeetings.length;
    
    // 3. Récupérer les internal_id des meetings passés pour chercher les événements
    const internalIds = pastMeetings
      .map(meeting => meeting.internal_id)
      .filter(id => id !== null && id !== undefined);
    
    let loginsPerformed = 0;
    let verificationStart = 0;
    let adbPair = 0;
    let adbConnect = 0;
    
    if (internalIds.length > 0) {
      // IMPORTANT: on compte des meetings uniques par étape (pas le nombre de lignes "events").
      loginsPerformed = await countUniqueMeetingsForEventType({
        supabase,
        eventType: 'login',
        meetingIds: internalIds
      });

      verificationStart = await countUniqueMeetingsForEventType({
        supabase,
        eventType: 'verification_start',
        meetingIds: internalIds
      });

      adbPair = await countUniqueMeetingsForEventType({
        supabase,
        eventType: 'adb_pair',
        meetingIds: internalIds
      });

      adbConnect = await countUniqueMeetingsForEventType({
        supabase,
        eventType: 'adb_connect',
        meetingIds: internalIds
      });
    }
    
    // Calculer les taux de conversion (toutes les étapes vs base meetings)
    // Ex: verificationStart% = (verificationStart / meetingsPlanned) * 100
    const conversionToParticipants = meetingsPlanned > 0
      ? ((participantsDetected / meetingsPlanned) * 100).toFixed(1)
      : 0;

    const conversionToLogins = meetingsPlanned > 0
      ? ((loginsPerformed / meetingsPlanned) * 100).toFixed(1)
      : 0;

    const conversionToVerificationStart = meetingsPlanned > 0
      ? ((verificationStart / meetingsPlanned) * 100).toFixed(1)
      : 0;

    const conversionToAdbPair = meetingsPlanned > 0
      ? ((adbPair / meetingsPlanned) * 100).toFixed(1)
      : 0;

    const conversionToAdbConnect = meetingsPlanned > 0
      ? ((adbConnect / meetingsPlanned) * 100).toFixed(1)
      : 0;

    // 4) Construire la liste des identités disponibles sur la période (non filtrée).
    const identityIds = [
      ...new Set((meetingsAll || []).map(m => m.identity_id).filter(Boolean))
    ];

    let availableIdentities = [];
    if (identityIds.length > 0) {
      const { data: identities, error: identitiesError } = await supabase
        .from('identities')
        .select('id, fullname, company, email')
        .in('id', identityIds);

      if (identitiesError) {
        console.error('Erreur lors de la récupération des identités:', identitiesError);
      } else {
        availableIdentities = (identities || [])
          .filter(i => i && i.id)
          .sort((a, b) => {
            const nameA = String(a.fullname || '').toLowerCase();
            const nameB = String(b.fullname || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
      }
    }
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      funnel: {
        meetingsPlanned,
        participantsDetected,
        loginsPerformed,
        verificationStart,
        adbPair,
        adbConnect
      },
      conversions: {
        toParticipants: parseFloat(conversionToParticipants),
        toLogins: parseFloat(conversionToLogins),
        toVerificationStart: parseFloat(conversionToVerificationStart),
        toAdbPair: parseFloat(conversionToAdbPair),
        toAdbConnect: parseFloat(conversionToAdbConnect)
      },
      availableIdentities,
      period: {
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null
      },
      filters: {
        identityId
      }
    });
    
  } catch (error) {
    console.error('Erreur dans /api/analytics:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Erreur lors de la récupération des analytics',
      message: error.message
    });
  }
}
