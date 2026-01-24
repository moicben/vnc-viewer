import React, { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import frLocale from '@fullcalendar/core/locales/fr';
import MeetingPopup from './MeetingPopup.jsx';

const MEETINGS_API_URL = '/api/meetings';
const SLOT_MIN_TIME = '00:00:00';
const SLOT_MAX_TIME = '24:00:00';
const SLOT_DURATION_MINUTES = 30;

function timeToMinutes(timeStr) {
  // "HH:MM" or "HH:MM:SS"
  const parts = String(timeStr).split(':').map(n => parseInt(n, 10));
  const [h = 0, m = 0] = parts;
  return h * 60 + m;
}

function Calendar({ currentDate, onDateChange }) {
  const calendarRef = useRef(null);
  const calendarWrapperRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [meetingsData, setMeetingsData] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calendarHeight, setCalendarHeight] = useState(null);
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
      
      // Stocker les données complètes pour la popup
      setMeetingsData(meetings);
      
      // Convertir les meetings en format FullCalendar
      const calendarEvents = meetings.map(meeting => {
        const start = new Date(meeting.meeting_start_at);
        const duration = meeting.meeting_duration_minutes || 30;
        const end = new Date(start.getTime() + duration * 60 * 1000);
        
        const identity = meeting.identities;
        const bookerName = identity?.fullname || meeting.participant_email || 'Inconnu';
        const company = identity?.company || '';
        const title = meeting.meeting_title || 'Meeting';
        
        return {
          id: meeting.id,
          title: `${title} - ${bookerName}${company ? ` (${company})` : ''}`,
          start: start.toISOString(),
          end: end.toISOString(),
          extendedProps: {
            meetingId: meeting.id,
            meetingTitle: title,
            bookerName,
            company,
            meetingUrl: meeting.meeting_url,
            comment: meeting.comment
          }
        };
      });
      
      setEvents(calendarEvents);
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

  // Forcer une hauteur uniforme de chaque slot (remplit toute la hauteur)
  useEffect(() => {
    if (calendarRef.current && calendarHeight) {
      const calendarApi = calendarRef.current.getApi();
      const rootEl = calendarRef.current.el;

      const slotCount = Math.max(
        1,
        Math.round((timeToMinutes(SLOT_MAX_TIME) - timeToMinutes(SLOT_MIN_TIME)) / SLOT_DURATION_MINUTES)
      );

      let cancelled = false;

      const applyUniformSlotHeights = () => {
        if (cancelled || !rootEl) return;

        // 1) S'assurer que la taille de base est à jour
        calendarApi.updateSize();

        // 2) Mesurer la hauteur réelle disponible pour la grille horaire
        requestAnimationFrame(() => {
          if (cancelled) return;

          const timegridBody = rootEl.querySelector('.fc-timegrid-body');
          const bodyRect = timegridBody?.getBoundingClientRect();
          const bodyHeight = bodyRect?.height || 0;
          if (!bodyHeight) return;

          const slotPx = '50';
          rootEl.style.setProperty('--vnc-timegrid-slot-count', String(slotCount));
          rootEl.style.setProperty('--vnc-timegrid-slot-height', `${slotPx}px`);

          // 3) Forcer FullCalendar à recalculer les coords avec les nouvelles hauteurs
          requestAnimationFrame(() => {
            if (cancelled) return;
            calendarApi.updateSize();
          });
        });
      };

      const timeoutId = setTimeout(applyUniformSlotHeights, 0);

      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }
  }, [calendarHeight, currentViewDate]);

  // Charger les meetings quand la date change
  useEffect(() => {
    const startDate = currentViewDate;
    const endDate = getViewEndDate();
    loadMeetings(startDate, endDate);
  }, [currentViewDate]);

  // Gérer le changement de date dans FullCalendar
  const handleDatesSet = (dateInfo) => {
    const start = new Date(dateInfo.start);
    start.setUTCHours(0, 0, 0, 0);
    
    // Mettre à jour la date de vue si elle a changé
    if (start.getTime() !== currentViewDate.getTime()) {
      setCurrentViewDate(start);
      if (onDateChange) {
        onDateChange(start);
      }
    }
  };

  // Naviguer vers une date spécifique
  useEffect(() => {
    if (calendarRef.current && currentDate) {
      const calendarApi = calendarRef.current.getApi();
      const targetDate = new Date(currentDate);
      targetDate.setUTCHours(0, 0, 0, 0);
      calendarApi.gotoDate(targetDate);
      setCurrentViewDate(targetDate);
    }
  }, [currentDate]);

  // Navigation précédent/suivant
  const navigateDays = (days) => {
    const newDate = new Date(currentViewDate);
    newDate.setUTCDate(currentViewDate.getUTCDate() + days);
    newDate.setUTCHours(0, 0, 0, 0);
    
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(newDate);
    }
    setCurrentViewDate(newDate);
    if (onDateChange) {
      onDateChange(newDate);
    }
  };

  // Aller à aujourd'hui
  const goToToday = () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(today);
    }
    setCurrentViewDate(today);
    if (onDateChange) {
      onDateChange(today);
    }
  };

  // Gérer le clic sur un event
  const handleEventClick = (clickInfo) => {
    const meetingId = clickInfo.event.extendedProps.meetingId;
    const meeting = meetingsData.find(m => m.id === meetingId);
    if (meeting) {
      setSelectedMeeting(meeting);
    }
  };

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
    
    return events.filter(event => {
      const eventStart = new Date(event.start);
      return eventStart >= dayStart && eventStart <= dayEnd;
    }).length;
  };

  // Personnaliser le contenu de l'en-tête de jour
  const dayHeaderContent = (dayInfo) => {
    const eventCount = getEventCountForDay(dayInfo.date);
    // Extraire seulement le jour de la semaine et capitaliser la première lettre
    const dayOfWeekRaw = dayInfo.date.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
    const dayOfWeek = dayOfWeekRaw.charAt(0).toUpperCase() + dayOfWeekRaw.slice(1);
    
    if (eventCount > 0) {
      return {
        html: `
          <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; width: 100%;">
            <div style="font-size: 12px; font-weight: 500; color: #fff;">${dayOfWeek}</div>
            <div style="font-size: 11px; color: #999; font-weight: 400;">${eventCount}</div>
          </div>
        `
      };
    }
    // Si pas d'événements, retourner juste le jour de la semaine capitalisé
    return dayOfWeek;
  };

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
        <div className="loading">
          <div className="spinner" />
          <p>Chargement du planning...</p>
        </div>
      )}
      
      {/* Contrôles de navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        marginBottom: '16px',
        padding: '0 24px'
      }}>
        <button
          onClick={() => navigateDays(-1)}
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
          ←
        </button>
        
        <button
          onClick={goToToday}
          className="calendar-today-btn"
          style={{
            background: '#1a1a1a',
            color: '#e0e0e0',
            border: '1px solid #2a2a2a',
            padding: '8px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
            fontWeight: 500
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
          Aujourd'hui
        </button>
        
        <span style={{
          fontSize: '13px',
          color: '#999',
          minWidth: '200px',
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

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: calendarHeight ? `${calendarHeight}px` : '100%' }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin]}
          initialView="timeGridFourDay"
          locale={frLocale}
          headerToolbar={false}
          allDaySlot={false}
          slotMinTime={SLOT_MIN_TIME}
          slotMaxTime={SLOT_MAX_TIME}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          height={calendarHeight || 'auto'}
        events={events}
        datesSet={handleDatesSet}
        initialDate={currentViewDate}
        timeZone="UTC"
        views={{
          timeGridFourDay: {
            type: 'timeGrid',
            duration: { days: 4 },
            buttonText: '4 jours'
          }
        }}
        validRange={(nowDate) => {
          // Permettre le défilement dans le passé et le futur
          return {
            start: null,
            end: null
          };
        }}
        eventClick={handleEventClick}
        eventContent={(eventInfo) => {
          const { meetingTitle, bookerName, company } = eventInfo.event.extendedProps;
          return (
            <div className="fc-event-main-frame">
              <div className="fc-event-title-text">
                {meetingTitle}
              </div>
              <div className="fc-event-booker-text">
                {bookerName}{company ? ` • ${company}` : ''}
              </div>
            </div>
          );
        }}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'UTC'
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'UTC'
        }}
        dayHeaderFormat={{ weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }}
        dayHeaderContent={dayHeaderContent}
        nowIndicator={true}
        eventDisplay="block"
        eventOverlap={true}
        eventConstraint={{
          start: '00:00',
          end: '24:00'
        }}
        />
      </div>
      {selectedMeeting && (
        <MeetingPopup meeting={selectedMeeting} onClose={() => setSelectedMeeting(null)} />
      )}
    </div>
  );
}

export default Calendar;
