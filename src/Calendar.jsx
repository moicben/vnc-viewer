import React, { useEffect, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridWeek from '@fullcalendar/timegrid';
import frLocale from '@fullcalendar/core/locales/fr';

const MEETINGS_API_URL = '/api/meetings';

function Calendar({ currentWeekStart, onWeekChange }) {
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fonction pour charger les meetings
  const loadMeetings = async (startDate, endDate) => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const weekEnd = new Date(endDate);
      weekEnd.setHours(23, 59, 59, 999);
      
      const response = await fetch(
        `${MEETINGS_API_URL}?start=${startDate.toISOString()}&end=${weekEnd.toISOString()}`
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

  // Charger les meetings quand la semaine change
  useEffect(() => {
    if (currentWeekStart) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);
      loadMeetings(currentWeekStart, weekEnd);
    }
  }, [currentWeekStart]);

  // Gérer le changement de date dans FullCalendar
  const handleDatesSet = (dateInfo) => {
    const start = new Date(dateInfo.start);
    start.setHours(0, 0, 0, 0);
    
    // S'assurer que c'est un lundi
    const dayOfWeek = start.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(start);
    monday.setDate(start.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    
    // Notifier le composant parent du changement de semaine
    if (onWeekChange && monday.getTime() !== currentWeekStart?.getTime()) {
      onWeekChange(monday);
    }
  };

  // Naviguer vers une semaine spécifique
  useEffect(() => {
    if (calendarRef.current && currentWeekStart) {
      const calendarApi = calendarRef.current.getApi();
      calendarApi.gotoDate(currentWeekStart);
    }
  }, [currentWeekStart]);

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
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridWeek]}
        initialView="timeGridWeek"
        locale={frLocale}
        headerToolbar={false}
        allDaySlot={false}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        height="auto"
        events={events}
        datesSet={handleDatesSet}
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
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {meetingTitle}
              </div>
              <div style={{
                fontSize: '11px',
                color: '#999',
                lineHeight: '1.2',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
        firstDay={1} // Lundi comme premier jour
        weekNumbers={false}
        dayHeaderFormat={{ weekday: 'long' }}
        nowIndicator={true}
        eventDisplay="block"
        eventOverlap={true}
        eventConstraint={{
          start: '08:00',
          end: '20:00'
        }}
      />
    </div>
  );
}

export default Calendar;
