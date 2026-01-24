import ContainersView from './ContainersView.jsx';
import CalendarView from './CalendarView.jsx';

export const viewRegistry = [
    {
        id: 'containers',
        label: 'Containers',
        title: 'Containers',
        description: 'Suivi VNC en temps réel',
        Component: ContainersView
    },
    {
        id: 'calendar',
        label: 'Calendar',
        title: 'Calendar',
        description: 'Planning et réunions',
        Component: CalendarView
    }
];

export const DEFAULT_VIEW_ID = 'containers';
