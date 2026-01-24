import { useMemo, useState } from 'react';
import ViewShell from '../ViewShell.jsx';
import Calendar from '../Calendar.jsx';

export default function CalendarView() {
    const [currentDate, setCurrentDate] = useState(null);

    const meta = useMemo(() => {
        if (!currentDate) {
            return <span>Chargement du planning…</span>;
        }
        return <span>{currentDate.toLocaleDateString('fr-FR')}</span>;
    }, [currentDate]);

    return (
        <ViewShell title="Calendar" meta={meta}>
            <Calendar currentDate={currentDate} onDateChange={setCurrentDate} />
        </ViewShell>
    );
}
