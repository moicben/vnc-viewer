import ContainersView from './ContainersView.jsx';
import CalendarView from './CalendarView.jsx';
import AnalyticsView from './AnalyticsView.jsx';
import { AnalyticsIcon, CalendarIcon, ContainersIcon } from '../ViewIcons.jsx';

export const viewRegistry = [
    {
        id: 'analytics',
        label: 'Analytics',
        title: 'Analytics',
        description: 'Funnel de conversion',
        Component: AnalyticsView,
        Icon: AnalyticsIcon
    },
    {
        id: 'containers',
        label: 'Containers',
        title: 'Containers',
        description: 'Suivi VNC en temps réel',
        Component: ContainersView,
        Icon: ContainersIcon
    },
    {
        id: 'calendar',
        label: 'Calendar',
        title: 'Calendar',
        description: 'Planning et réunions',
        Component: CalendarView,
        Icon: CalendarIcon
    }
];

export const DEFAULT_VIEW_ID = 'analytics';
