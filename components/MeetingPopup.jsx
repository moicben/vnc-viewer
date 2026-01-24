import { useEffect } from 'react';

export default function MeetingPopup({ meeting, onClose }) {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    if (!meeting) return null;

    const identity = meeting.identities;
    const bookerName = identity?.fullname || meeting.participant_email || 'Inconnu';
    const company = identity?.company || '';
    // Email affiché: source unique = colonne meetings.participant_email
    const participantEmail = meeting.participant_email || '';

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        });
    };

    return (
        <div className="meeting-popup">
            <div className="meeting-popup-overlay" onClick={onClose} />
            <div className="meeting-popup-content">
                <button className="meeting-popup-close" onClick={onClose}>
                    &times;
                </button>
                <div className="meeting-popup-header">
                    <h2 className="meeting-popup-title">
                        {meeting.meeting_title || 'Meeting'}
                    </h2>
                </div>
                <div className="meeting-popup-body">
                    <div className="meeting-popup-info">
                        {meeting.internal_id && (
                            <div className="meeting-popup-field">
                                <span className="meeting-popup-label">Internal ID</span>
                                <span className="meeting-popup-value">{meeting.internal_id}</span>
                            </div>
                        )}
                        <div className="meeting-popup-field">
                            <span className="meeting-popup-label">Date et heure</span>
                            <span className="meeting-popup-value">
                                {formatDate(meeting.meeting_start_at)}
                            </span>
                        </div>
                        {meeting.created_at && (
                            <div className="meeting-popup-field">
                                <span className="meeting-popup-label">Date de création</span>
                                <span className="meeting-popup-value">
                                    {formatDate(meeting.created_at)}
                                </span>
                            </div>
                        )}
                        <div className="meeting-popup-field">
                            <span className="meeting-popup-label">Organisateur</span>
                            <span className="meeting-popup-value">
                                {bookerName}
                                {company ? ` (${company})` : ''}
                            </span>
                        </div>
                        {participantEmail && (
                            <div className="meeting-popup-field">
                                <span className="meeting-popup-label">Email participant</span>
                                <span className="meeting-popup-value">{participantEmail}</span>
                            </div>
                        )}
                        {meeting.meeting_url && (
                            <div className="meeting-popup-field">
                                <span className="meeting-popup-label">Lien du meeting</span>
                                <a
                                    id="meetingPopupUrl"
                                    className="meeting-popup-link"
                                    href={meeting.meeting_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {meeting.meeting_url}
                                </a>
                            </div>
                        )}
                        {meeting.comment && (
                            <div className="meeting-popup-field">
                                <span className="meeting-popup-label">Commentaire</span>
                                <span className="meeting-popup-value">{meeting.comment}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
