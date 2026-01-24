import React, { useEffect, useMemo, useRef, useState } from 'react';
import MeetingPopup from './MeetingPopup.jsx';

const MEETINGS_API_URL = '/api/meetings';
const SLOT_MIN_TIME = '00:00:00';
const SLOT_MAX_TIME = '24:00:00';
const SLOT_DURATION_MINUTES = 30;
const DEFAULT_SLOT_PX = 50;

function timeToMinutes(timeStr) { 
  // "HH:MM" or "HH:MM:SS"
  const parts = String(timeStr).split(':').map(n => parseInt(n, 10));
  const [h = 0, m = 0] = parts;
  return h * 60 + m;
}

function startOfUtcDay(d) {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addUtcDays(d, days) {
  const date = new Date(d);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function minutesSinceStartOfUtcDay(date) {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseMeetingDateUtc(value) {
  if (!value) return null;
  const s = String(value);
  // Si la string a déjà un timezone (Z ou ±HH:MM), Date() est OK.
  if (/(Z|[+-]\d{2}:\d{2})$/.test(s)) return new Date(s);
  // Sinon on force l'interprétation en UTC.
  return new Date(`${s}Z`);
}

/**
 * Calcule un layout simple d'overlap (colonnes) pour un ensemble d'événements d'une même journée.
 * Chaque événement est { id, startMs, endMs, ... } (ms UTC).
 */
function computeOverlapLayout(dayEvents) {
  // Trier par start puis end
  const events = [...dayEvents].sort((a, b) => (a.startMs - b.startMs) || (a.endMs - b.endMs));
  const active = [];
  const placed = [];

  // Pour chaque "cluster" d'événements en chevauchement, on veut un colCount commun.
  let cluster = [];
  let clusterEnd = -Infinity;
  const flushCluster = () => {
    if (cluster.length === 0) return;
    const clusterMaxCols = Math.max(...cluster.map(e => e._colCount || 1));
    for (const e of cluster) {
      e.colCount = clusterMaxCols;
      placed.push(e);
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const ev of events) {
    // Purger les actifs terminés
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMs <= ev.startMs) active.splice(i, 1);
    }

    // Nouvelle "fenêtre" de cluster si aucun overlap
    if (cluster.length > 0 && ev.startMs >= clusterEnd) {
      flushCluster();
    }

    // Trouver la première colonne libre
    const usedCols = new Set(active.map(a => a.colIndex));
    let colIndex = 0;
    while (usedCols.has(colIndex)) colIndex += 1;

    const withLayout = { ...ev, colIndex, colCount: 1 };

    active.push(withLayout);
    cluster.push(withLayout);
    clusterEnd = Math.max(clusterEnd, withLayout.endMs);

    // Mettre à jour le max colonnes au sein du cluster
    const currentCols = Math.max(...active.map(a => a.colIndex + 1));
    for (const e of cluster) {
      e._colCount = Math.max(e._colCount || 1, currentCols);
    }
  }

  flushCluster();
  return placed;
}

function Calendar({ currentDate, onDateChange }) {
  const calendarWrapperRef = useRef(null);
  const [meetingsData, setMeetingsData] = useState([]);
  const [allMeetingsData, setAllMeetingsData] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calendarHeight, setCalendarHeight] = useState(null);
  const [selectedIdentityId, setSelectedIdentityId] = useState(null);
  const [availableIdentities, setAvailableIdentities] = useState([]);
  const calendarBodyRef = useRef(null);
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    // Initialiser avec aujourd'hui en UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  });

  // Fonction pour charger les meetings
  const loadMeetings = async (startDate, endDate) => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      const response = await fetch(
        `${MEETINGS_API_URL}?start=${startDate.toISOString()}&end=${end.toISOString()}`
      );
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      const meetings = data.meetings || [];
      
      // Stocker toutes les données pour le filtrage
      setAllMeetingsData(meetings);
      
      // Extraire les identités uniques disponibles
      const identitiesMap = new Map();
      meetings.forEach(meeting => {
        if (meeting.identities && meeting.identities.id) {
          const identity = meeting.identities;
          if (!identitiesMap.has(identity.id)) {
            identitiesMap.set(identity.id, {
              id: identity.id,
              fullname: identity.fullname || 'Inconnu',
              company: identity.company || '',
              email: identity.email || ''
            });
          }
        }
      });
      const identities = Array.from(identitiesMap.values()).sort((a, b) => {
        const nameA = a.fullname.toLowerCase();
        const nameB = b.fullname.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setAvailableIdentities(identities);
      
      // Réinitialiser le filtre si l'identité sélectionnée n'existe plus
      if (selectedIdentityId && !identities.find(id => id.id === selectedIdentityId)) {
        setSelectedIdentityId(null);
      }
    } catch (err) {
      console.error('Erreur lors de la récupération des meetings:', err);
      setError(err.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  // Calculer la date de fin de la vue (aujourd'hui + 3 jours) en UTC
  const getViewEndDate = () => {
    const end = new Date(currentViewDate);
    end.setUTCDate(currentViewDate.getUTCDate() + 3);
    end.setUTCHours(23, 59, 59, 999);
    return end;
  };

  // Calculer la hauteur disponible pour le calendrier
  useEffect(() => {
    let resizeObserver = null;
    
    const updateCalendarHeight = () => {
      if (calendarWrapperRef.current) {
        const wrapper = calendarWrapperRef.current;
        // Trouver le conteneur parent dashboard-content
        const dashboardContent = wrapper.closest('.dashboard-content');
        if (dashboardContent) {
          const contentRect = dashboardContent.getBoundingClientRect();
          // Soustraire le padding (20px top + 28px bottom = 48px) et la hauteur des contrôles de navigation (~60px)
          const availableHeight = contentRect.height - 48 - 60;
          if (availableHeight > 0) {
            setCalendarHeight(Math.max(400, availableHeight));
          }
        }
      }
    };

    // Attendre que le DOM soit prêt et que le composant soit monté
    const timeoutId = setTimeout(() => {
      updateCalendarHeight();
      // Utiliser ResizeObserver pour détecter les changements de taille
      if (calendarWrapperRef.current) {
        const dashboardContent = calendarWrapperRef.current.closest('.dashboard-content');
        if (dashboardContent) {
          resizeObserver = new ResizeObserver(() => {
            updateCalendarHeight();
          });
          resizeObserver.observe(dashboardContent);
        }
      }
    }, 100);
    
    window.addEventListener('resize', updateCalendarHeight);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateCalendarHeight);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  // Convertir les meetings en événements avec filtrage par identité
  useEffect(() => {
    // Filtrer les meetings selon l'identité sélectionnée
    const filteredMeetings = selectedIdentityId
      ? allMeetingsData.filter(meeting => meeting.identities?.id === selectedIdentityId)
      : allMeetingsData;
    
    // Stocker les données filtrées pour la popup
    setMeetingsData(filteredMeetings);
  }, [allMeetingsData, selectedIdentityId]);

  // Charger les meetings quand la date change
  useEffect(() => {
    const startDate = currentViewDate;
    const endDate = getViewEndDate();
    loadMeetings(startDate, endDate);
  }, [currentViewDate]);

  // Naviguer vers une date spécifique
  useEffect(() => {
    if (!currentDate) return;
    const targetDate = startOfUtcDay(currentDate);
    setCurrentViewDate(targetDate);
  }, [currentDate]);

  // Navigation précédent/suivant
  const navigateDays = (days) => {
    const newDate = new Date(currentViewDate);
    newDate.setUTCDate(currentViewDate.getUTCDate() + days);
    newDate.setUTCHours(0, 0, 0, 0);
    
    setCurrentViewDate(newDate);
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  // Aller à aujourd'hui
  const goToToday = () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    setCurrentViewDate(today);
    if (onDateChange) {
      onDateChange(today);
    }
  };

  const slotCount = useMemo(() => {
    const totalMinutes = timeToMinutes(SLOT_MAX_TIME) - timeToMinutes(SLOT_MIN_TIME);
    return Math.max(1, Math.round(totalMinutes / SLOT_DURATION_MINUTES));
  }, []);

  const slotHeightPx = DEFAULT_SLOT_PX;
  const pxPerMinute = slotHeightPx / SLOT_DURATION_MINUTES;

  const viewDays = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => startOfUtcDay(addUtcDays(currentViewDate, i)));
  }, [currentViewDate]);

  // Formater la plage de dates affichée
  const formatDateRange = () => {
    const start = new Date(currentViewDate);
    const end = new Date(currentViewDate);
    end.setUTCDate(currentViewDate.getUTCDate() + 3);
    
    const options = { day: 'numeric', month: 'long', timeZone: 'UTC' };
    const startStr = start.toLocaleDateString('fr-FR', options);
    const endStr = end.toLocaleDateString('fr-FR', options);
    
    // Vérifier si aujourd'hui est dans la plage (en UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startUTC = new Date(start);
    startUTC.setUTCHours(0, 0, 0, 0);
    const endUTC = new Date(end);
    endUTC.setUTCHours(23, 59, 59, 999);
    const isTodayInRange = today >= startUTC && today <= endUTC;
    
    if (isTodayInRange && startUTC.getTime() === today.getTime()) {
      return `Aujourd'hui - ${endStr}`;
    }
    
    return `${startStr} - ${endStr}`;
  };

  // Compter les événements par jour
  const getEventCountForDay = (dayDate) => {
    const dayStart = new Date(dayDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayDate);
    dayEnd.setUTCHours(23, 59, 59, 999);
    
    return meetingsData.filter(meeting => {
      const meetingStart = parseMeetingDateUtc(meeting.meeting_start_at) || new Date(meeting.meeting_start_at);
      return meetingStart >= dayStart && meetingStart <= dayEnd;
    }).length;
  };

  const formatDayHeader = (dayDate) => {
    const dayOfWeekRaw = dayDate.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
    const dayOfWeek = dayOfWeekRaw.charAt(0).toUpperCase() + dayOfWeekRaw.slice(1);
    const eventCount = getEventCountForDay(dayDate);
    return { dayOfWeek, eventCount };
  };

  const meetingsByDayWithLayout = useMemo(() => {
    const startMinutes = timeToMinutes(SLOT_MIN_TIME);
    const endMinutes = timeToMinutes(SLOT_MAX_TIME);
    const viewStartMs = startOfUtcDay(currentViewDate).getTime();
    const viewEndMs = addUtcDays(currentViewDate, 4).getTime(); // fin exclusive

    const normalized = meetingsData
      .map(meeting => {
        const start = parseMeetingDateUtc(meeting.meeting_start_at) || new Date(meeting.meeting_start_at);
        const duration = meeting.meeting_duration_minutes || 30;
        const end = new Date(start.getTime() + duration * 60 * 1000);
        return {
          meeting,
          id: meeting.id,
          startMs: start.getTime(),
          endMs: end.getTime(),
          startDate: start,
          endDate: end
        };
      })
      .filter(ev => ev.endMs > viewStartMs && ev.startMs < viewEndMs);

    const byDay = new Map(); // dayIndex -> events
    for (let i = 0; i < 4; i++) byDay.set(i, []);

    for (const ev of normalized) {
      // On affiche l'événement dans la colonne du jour de son start (comportement "timegrid" simple)
      const dayIndex = Math.floor((startOfUtcDay(ev.startDate).getTime() - startOfUtcDay(currentViewDate).getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex > 3) continue;

      const startMin = minutesSinceStartOfUtcDay(ev.startDate);
      const endMinRaw = minutesSinceStartOfUtcDay(ev.endDate);
      const endMin = ev.endDate.getUTCDate() !== ev.startDate.getUTCDate() ? 24 * 60 : endMinRaw;

      const clampedStartMin = clamp(startMin, startMinutes, endMinutes);
      const clampedEndMin = clamp(endMin, startMinutes, endMinutes);
      if (clampedEndMin <= clampedStartMin) continue;

      byDay.get(dayIndex).push({
        ...ev,
        startMin: clampedStartMin,
        endMin: clampedEndMin
      });
    }

    const result = new Map();
    for (let dayIndex = 0; dayIndex < 4; dayIndex++) {
      const dayEvents = byDay.get(dayIndex);
      const withLayout = computeOverlapLayout(dayEvents.map(e => ({
        ...e,
        // Utiliser la timeline minute (ms pour overlap)
        startMs: startOfUtcDay(e.startDate).getTime() + e.startMin * 60 * 1000,
        endMs: startOfUtcDay(e.startDate).getTime() + e.endMin * 60 * 1000
      })));
      result.set(dayIndex, withLayout);
    }

    return result;
  }, [meetingsData, currentViewDate]);

  // Rafraîchir l'indicateur "now"
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick(t => (t + 1) % 1_000_000), 30_000);
    return () => clearInterval(id);
  }, []);

  const nowIndicator = useMemo(() => {
    const now = new Date();
    const todayUtc = startOfUtcDay(now).getTime();
    const viewStartUtc = startOfUtcDay(currentViewDate).getTime();
    const dayIndex = Math.floor((todayUtc - viewStartUtc) / (24 * 60 * 60 * 1000));
    if (dayIndex < 0 || dayIndex > 3) return null;

    const minutes = minutesSinceStartOfUtcDay(now);
    const startMinutes = timeToMinutes(SLOT_MIN_TIME);
    const endMinutes = timeToMinutes(SLOT_MAX_TIME);
    const clamped = clamp(minutes, startMinutes, endMinutes);
    const topPx = (clamped - startMinutes) * pxPerMinute;

    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');

    return { dayIndex, topPx, label: `${hh}:${mm}` };
  }, [currentViewDate, pxPerMinute, nowTick]);

  // Scroll initial vers l'heure actuelle (si visible dans la plage)
  useEffect(() => {
    if (!calendarBodyRef.current) return;
    const el = calendarBodyRef.current;
    const now = new Date();
    const startMinutes = timeToMinutes(SLOT_MIN_TIME);
    const minutes = minutesSinceStartOfUtcDay(now);
    const topPx = Math.max(0, (minutes - startMinutes) * pxPerMinute - 200);
    el.scrollTop = topPx;
  }, [currentViewDate, pxPerMinute]);

  return (
    <div 
      ref={calendarWrapperRef}
      className="calendar-wrapper" 
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}
    >
      {error && (
        <div className="calendar-error" style={{
          background: '#1a0a0a',
          color: '#ff6666',
          padding: '16px',
          borderRadius: '6px',
          marginBottom: '16px',
          border: '1px solid #2a1a1a',
          fontSize: '14px'
        }}>
          Erreur: {error}
        </div>
      )}

      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 10, 10, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            padding: '32px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            minWidth: '200px'
          }}>
            <div style={{
              border: '3px solid #2a2a2a',
              borderTop: '3px solid #4a9eff',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'spin 0.8s linear infinite'
            }} />
            <p style={{
              color: '#e0e0e0',
              fontSize: '14px',
              fontWeight: 500,
              margin: 0
            }}>
              Chargement des meetings...
            </p>
          </div>
        </div>
      )}
      
      {/* Contrôles de navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
        padding: '0',
        flexWrap: 'wrap'
      }}>
        {/* Filtre par identité */}
        {availableIdentities.length > 0 && (
          <select
            value={selectedIdentityId || ''}
            onChange={(e) => setSelectedIdentityId(e.target.value || null)}
            className="identity-filter"
            style={{
              background: '#0a0a0a',
              color: '#e0e0e0',
              border: '1px solid #2a2a2a',
              padding: '6px 12px',
              paddingRight: '32px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: 'inherit',
              minWidth: '120px',
              appearance: 'none',
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center'
            }}
          >
            <option value="">All identity</option>
            {availableIdentities.map(identity => (
              <option key={identity.id} value={identity.id}>
                {identity.fullname}
              </option>
            ))}
          </select>
        )}
        
        {/* Navigateur de semaine */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <button
            onClick={goToToday}
            className="calendar-today-btn"
            style={{
              background: '#1a1a1a',
              color: '#e0e0e0',
              border: '1px solid #2a2a2a',
              padding: '6px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              fontWeight: 400
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#222';
              e.target.style.borderColor = '#333';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#1a1a1a';
              e.target.style.borderColor = '#2a2a2a';
            }}
          >
            Today
          </button>
          
          <span style={{
            fontSize: '13px',
            color: '#999',
            textAlign: 'center'
          }}>
            {formatDateRange()}
          </span>
          
          <button
            onClick={() => navigateDays(1)}
            className="calendar-nav-btn"
            style={{
              background: '#1a1a1a',
              color: '#e0e0e0',
              border: '1px solid #2a2a2a',
              padding: '8px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#222';
              e.target.style.borderColor = '#333';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#1a1a1a';
              e.target.style.borderColor = '#2a2a2a';
            }}
          >
            →
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: calendarHeight ? `${calendarHeight}px` : '100%' }}>
        <div
          className="calendar"
          style={{
            height: '100%',
            ...(calendarHeight ? { maxHeight: `${calendarHeight}px` } : null)
          }}
        >
          {/* Header fixe */}
          <div
            className="calendar-grid calendar-grid-header"
            style={{
              gridTemplateRows: `56px`,
              gridTemplateColumns: `70px repeat(4, 1fr)`
            }}
          >
            <div
              className="calendar-time-column calendar-corner"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#999',
                fontSize: '12px'
              }}
            >
              UTC
            </div>
            {viewDays.map((dayDate, dayIndex) => {
              const { dayOfWeek, eventCount } = formatDayHeader(dayDate);
              const isToday = startOfUtcDay(new Date()).getTime() === dayDate.getTime();
              return (
                <div
                  key={dayDate.toISOString()}
                  className={`calendar-day-header ${isToday ? 'today' : ''}`}
                  style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
                >
                  <div className="day-name" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#fff' }}>{dayOfWeek}</span>
                    {eventCount > 0 && <span className="meeting-count" style={{ fontSize: '11px' }}>{eventCount}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body scrollable */}
          <div
            ref={calendarBodyRef}
            className="calendar-scroll"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden'
            }}
          >
            <div
              className="calendar-grid calendar-grid-body"
              style={{
                gridTemplateColumns: `70px repeat(4, 1fr)`,
                gridTemplateRows: `repeat(${slotCount}, ${slotHeightPx}px)`
              }}
            >
              {/* Colonne horaires + cellules */}
              {Array.from({ length: slotCount }, (_, slotIndex) => {
                const minutesFromStart = slotIndex * SLOT_DURATION_MINUTES + timeToMinutes(SLOT_MIN_TIME);
                const hour = Math.floor(minutesFromStart / 60);
                const minute = minutesFromStart % 60;
                const isHour = minute === 0;
                const label = isHour ? `${String(hour).padStart(2, '0')}:00` : '';

                return (
                  <React.Fragment key={`slot-${slotIndex}`}>
                    <div className="calendar-time-cell" style={{ gridColumn: 1, gridRow: slotIndex + 1 }}>
                      {label}
                    </div>
                    {viewDays.map((dayDate, dayIndex) => {
                      const isToday = startOfUtcDay(new Date()).getTime() === dayDate.getTime();
                      return (
                        <div
                          key={`cell-${slotIndex}-${dayIndex}`}
                          className={`calendar-cell ${isToday ? 'today' : ''}`}
                          style={{ gridColumn: dayIndex + 2, gridRow: slotIndex + 1 }}
                        />
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Overlays par jour (meetings) */}
              {viewDays.map((dayDate, dayIndex) => {
                const dayMeetings = meetingsByDayWithLayout.get(dayIndex) || [];
                const startMinutes = timeToMinutes(SLOT_MIN_TIME);
                const dayHeightPx = slotCount * slotHeightPx;

                return (
                  <div
                    key={`meetings-${dayDate.toISOString()}`}
                    className="calendar-day-meetings"
                    style={{
                      gridColumn: dayIndex + 2,
                      gridRow: `1 / span ${slotCount}`,
                      height: `${dayHeightPx}px`
                    }}
                  >
                    {dayMeetings.map(ev => {
                      const top = (ev.startMin - startMinutes) * pxPerMinute;
                      const height = Math.max(8, (ev.endMin - ev.startMin) * pxPerMinute);

                      const gapPx = 4;
                      const widthPct = 100 / (ev.colCount || 1);
                      const leftPct = widthPct * (ev.colIndex || 0);

                      const identity = ev.meeting.identities;
                      const bookerName = identity?.fullname || ev.meeting.participant_email || 'Inconnu';
                      const company = identity?.company || '';
                      const meetingTitle = ev.meeting.meeting_title || 'Meeting';
                      // Email affiché: source unique = colonne meetings.participant_email
                      const participantEmail = ev.meeting.participant_email || '';

                      return (
                        <div
                          key={String(ev.id)}
                          className="calendar-meeting"
                          style={{
                            top: `${top}px`,
                            height: `${height}px`,
                            left: `calc(${leftPct}% + ${gapPx / 2}px)`,
                            width: `calc(${widthPct}% - ${gapPx}px)`
                          }}
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMeeting(ev.meeting);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedMeeting(ev.meeting);
                            }
                          }}
                        >
                          <div className="meeting-title">{meetingTitle}</div>
                          <div className="meeting-booker">
                            {participantEmail || `${bookerName}${company ? ` • ${company}` : ''}`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Indicateur "now" */}
              {nowIndicator && (
                <div
                  className="calendar-current-time-indicator"
                  style={{
                    // Limiter la largeur à la colonne du jour actuel
                    gridColumn: `${nowIndicator.dayIndex + 2} / span 1`,
                    gridRow: `1 / span ${slotCount}`,
                    position: 'relative',
                    zIndex: 999,
                    height: `${slotCount * slotHeightPx}px`
                  }}
                >
                  <div className="calendar-current-time-line" style={{ top: `${nowIndicator.topPx}px` }} />
                  <div className="calendar-current-time-bullet" style={{ top: `calc(${nowIndicator.topPx}px - 5px)`, left: '6px' }} />
                  <div className="calendar-current-time-label" style={{ top: `calc(${nowIndicator.topPx}px - 12px)`, left: '24px' }}>
                    {nowIndicator.label}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {selectedMeeting && (
        <MeetingPopup meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />
      )}
    </div>
  );
}

export default Calendar;
