import { createClient } from '@supabase/supabase-js';

const DEFAULT_LIMIT = 25;

function getSafeLimit(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, 200);
}

async function fetchPastMeetingsWithQueriesPaginated({ supabase, nowIso, startDate, endDate, identityId }) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;

    let query = supabase
      .from('meetings')
      .select(
        `
          internal_id,
          meeting_start_at,
          status,
          identity_id,
          contact_id,
          contacts:contacts!meetings_contact_id_fkey (
            source_query
          )
        `
      )
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

async function fetchEventsForMeetingsPaginated({ supabase, meetingIds }) {
  if (!meetingIds || meetingIds.length === 0) return [];

  // On récupère tous les events des meetings concernés.
  // NB: Supabase/PostgREST paginate sur le résultat final.
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('events')
      .select('meeting_id, event_type')
      .in('meeting_id', meetingIds)
      .range(from, to);

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

    let startDate = null;
    let endDate = null;
    if (req.query.start && req.query.end) {
      startDate = new Date(req.query.start);
      endDate = new Date(req.query.end);
      endDate.setHours(23, 59, 59, 999);
    }

    const identityIdRaw = req.query.identityId;
    const identityId = identityIdRaw ? String(identityIdRaw) : null;
    const limit = getSafeLimit(req.query.limit);

    // 1) Meetings passés + source_query (via contacts)
    const meetings = await fetchPastMeetingsWithQueriesPaginated({
      supabase,
      nowIso,
      startDate,
      endDate,
      identityId
    });

    // "Present" = meetings passés dont status != no_participant_detected (même logique que /api/analytics)
    const presentMeetings = (meetings || []).filter((m) => m?.status !== 'no_participant_detected');

    const internalIds = presentMeetings
      .map((m) => m?.internal_id)
      .filter((id) => id !== null && id !== undefined);

    // 2) Events liés aux meetings "present"
    const events = await fetchEventsForMeetingsPaginated({
      supabase,
      meetingIds: internalIds
    });

    // meeting_id -> Set(event_type)
    const meetingEventTypes = new Map();
    for (const ev of events || []) {
      const mid = ev?.meeting_id;
      const t = ev?.event_type;
      if (!mid || !t) continue;
      let set = meetingEventTypes.get(mid);
      if (!set) {
        set = new Set();
        meetingEventTypes.set(mid, set);
      }
      set.add(t);
    }

    // Agrégation par source_query
    const byQuery = new Map();
    const normalizeQuery = (q) => {
      const s = String(q ?? '').trim();
      return s;
    };

    for (const m of presentMeetings) {
      const query = normalizeQuery(m?.contacts?.source_query);
      if (!query) continue;

      const mid = m?.internal_id;
      if (!mid) continue;

      const types = meetingEventTypes.get(mid) || new Set();

      let agg = byQuery.get(query);
      if (!agg) {
        agg = {
          query,
          presentCount: 0,
          loggedCount: 0,
          conversionsCount: 0,
          verificationCount: 0,
          adbPairCount: 0
        };
        byQuery.set(query, agg);
      }

      // présent = 1 meeting
      agg.presentCount += 1;

      // counts = meetings uniques par type (comme le funnel)
      if (types.has('login')) agg.loggedCount += 1;
      if (types.has('verification_start')) agg.verificationCount += 1;
      if (types.has('adb_pair')) agg.adbPairCount += 1;
      if (types.has('adb_connect')) agg.conversionsCount += 1;
    }

    const items = [...byQuery.values()]
      .map((r) => {
        const overallCount =
          Number(r.presentCount ?? 0) +
          Number(r.loggedCount ?? 0) +
          Number(r.verificationCount ?? 0) +
          Number(r.adbPairCount ?? 0) +
          Number(r.conversionsCount ?? 0);

        return {
          query: r.query,
          presentCount: r.presentCount,
          loggedCount: r.loggedCount,
          overallCount,
          // Champ utile pour le tri ("a généré le plus de conversion")
          conversionsCount: r.conversionsCount
        };
      })
      .sort((a, b) => {
        const dc = Number(b.conversionsCount ?? 0) - Number(a.conversionsCount ?? 0);
        if (dc !== 0) return dc;
        const doverall = Number(b.overallCount ?? 0) - Number(a.overallCount ?? 0);
        if (doverall !== 0) return doverall;
        return String(a.query).localeCompare(String(b.query));
      })
      .slice(0, limit);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      items,
      limit,
      filters: {
        identityId,
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null
      }
    });
  } catch (error) {
    console.error('Erreur dans /api/best-queries:', error);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({
      error: 'Erreur lors de la récupération des best queries',
      message: error.message
    });
  }
}

