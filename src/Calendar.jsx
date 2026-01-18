import React, { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import frLocale from '@fullcalendar/core/locales/fr';

const MEETINGS_API_URL = '/api/meetings';

function Calendar({ currentDate, onDateChange }) {
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    // Initialiser avec aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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

  // Calculer la date de début de la vue (aujourd'hui)
  const getViewStartDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  // Calculer la date de fin de la vue (aujourd'hui + 3 jours)
  const getViewEndDate = () => {
    const end = new Date(currentViewDate);
    end.setDate(currentViewDate.getDate() + 3);
    end.setHours(23, 59, 59, 999);
    return end;
  };

  // Charger les meetings quand la date change
  useEffect(() => {
    const startDate = currentViewDate;
    const endDate = getViewEndDate();
    loadMeetings(startDate, endDate);
  }, [currentViewDate]);

  // Gérer le changement de date dans FullCalendar
  const handleDatesSet = (dateInfo) => {
    const start = new Date(dateInfo.start);
    start.setHours(0, 0, 0, 0);
    
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
      targetDate.setHours(0, 0, 0, 0);
      calendarApi.gotoDate(targetDate);
      setCurrentViewDate(targetDate);
    }
  }, [currentDate]);

  // Navigation précédent/suivant
  const navigateDays = (days) => {
    const newDate = new Date(currentViewDate);
    newDate.setDate(currentViewDate.getDate() + days);
    newDate.setHours(0, 0, 0, 0);
    
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
    today.setHours(0, 0, 0, 0);
    
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(today);
    }
    setCurrentViewDate(today);
    if (onDateChange) {
      onDateChange(today);
    }
  };

  // Formater la plage de dates affichée
  const formatDateRange = () => {
    const start = new Date(currentViewDate);
    const end = new Date(currentViewDate);
    end.setDate(currentViewDate.getDate() + 3);
    
    const options = { day: 'numeric', month: 'long', timeZone: 'UTC' };
    const startStr = start.toLocaleDateString('fr-FR', options);
    const endStr = end.toLocaleDateString('fr-FR', options);
    
    // Vérifier si aujourd'hui est dans la plage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isTodayInRange = today >= start && today <= end;
    
    if (isTodayInRange && start.getTime() === today.getTime()) {
      return `Aujourd'hui - ${endStr}`;
    }
    
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className="calendar-wrapper">
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

      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin]}
        initialView="timeGridFourDay"
        locale={frLocale}
        headerToolbar={false}
        allDaySlot={false}
        slotMinTime="08:00:00"
        slotMaxTime="17:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        height="auto"
        events={events}
        datesSet={handleDatesSet}
        initialDate={currentViewDate}
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
        eventContent={(eventInfo) => {
          const { meetingTitle, bookerName, company } = eventInfo.event.extendedProps;
          return (
            <div className="fc-event-main-frame" style={{
              padding: '4px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#e0e0e0',
                lineHeight: '1.3',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}>
                {meetingTitle}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#999',
                lineHeight: '1.2',
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}>
                {bookerName}{company ? ` • ${company}` : ''}
              </div>
            </div>
          );
        }}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }}
        dayHeaderFormat={{ weekday: 'long', day: 'numeric', month: 'short' }}
        nowIndicator={true}
        eventDisplay="block"
        eventOverlap={true}
        eventConstraint={{
          start: '08:00',
          end: '17:00'
        }}
      />
    </div>
  );
}

export default Calendar;
