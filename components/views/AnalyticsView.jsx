import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import ViewShell from '../ViewShell.jsx';
import { fetchAnalytics } from '../../lib/api.js';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const PERIOD_OPTIONS = [
    { value: 'all', label: 'All-Time' },
    { value: 'last_month', label: 'Last month' },
    { value: 'last_2_weeks', label: 'Last 2 weeks' },
    { value: 'last_week', label: 'Last week' },
    { value: 'last_day', label: 'Last day' }
];

function getPeriodRange(periodValue) {
    if (!periodValue || periodValue === 'all') return { startDate: null, endDate: null };
    const endDate = new Date();

    const startDate = new Date(endDate);
    switch (periodValue) {
        case 'last_month':
            startDate.setDate(startDate.getDate() - 30);
            break;
        case 'last_2_weeks':
            startDate.setDate(startDate.getDate() - 14);
            break;
        case 'last_week':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'last_day':
            startDate.setDate(startDate.getDate() - 1);
            break;
        default:
            return { startDate: null, endDate: null };
    }

    return { startDate, endDate };
}

export default function AnalyticsView() {
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedIdentityId, setSelectedIdentityId] = useState(null);
    const [availableIdentities, setAvailableIdentities] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState('all');

    useEffect(() => {
        const loadAnalytics = async () => {
            setLoading(true);
            setError(null);
            try {
                const { startDate, endDate } = getPeriodRange(selectedPeriod);
                const data = await fetchAnalytics(startDate, endDate, selectedIdentityId);
                setAnalytics(data);

                const identities = Array.isArray(data?.availableIdentities)
                    ? data.availableIdentities
                    : [];
                setAvailableIdentities(identities);

                // Même comportement que Calendar : reset si l'identité n'est plus dispo sur la période.
                if (
                    selectedIdentityId &&
                    !identities.some((i) => String(i.id) === String(selectedIdentityId))
                ) {
                    setSelectedIdentityId(null);
                }
            } catch (err) {
                console.error('Erreur lors du chargement des analytics:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        loadAnalytics();
    }, [selectedIdentityId, selectedPeriod]);

    const funnel = analytics?.funnel ?? {
        meetingsPlanned: 0,
        participantsDetected: 0,
        loginsPerformed: 0,
        verificationStart: 0,
        adbPair: 0,
        adbConnect: 0
    };

    const conversions = analytics?.conversions ?? {
        toParticipants: 0,
        toLogins: 0,
        toVerificationStart: 0,
        toAdbPair: 0,
        toAdbConnect: 0
    };

    const steps = useMemo(
        () => [
            { key: 'meetingsPlanned', label: 'Meetings planifiés', value: funnel.meetingsPlanned },
            { key: 'participantsDetected', label: 'Participant détecté', value: funnel.participantsDetected },
            { key: 'loginsPerformed', label: 'Login effectué (meetings uniques)', value: funnel.loginsPerformed },
            { key: 'verificationStart', label: 'Verification start', value: funnel.verificationStart },
            { key: 'adbPair', label: 'ADB Pair', value: funnel.adbPair },
            { key: 'adbConnect', label: 'ADB Connect', value: funnel.adbConnect }
        ],
        [
            funnel.meetingsPlanned,
            funnel.participantsDetected,
            funnel.loginsPerformed,
            funnel.verificationStart,
            funnel.adbPair,
            funnel.adbConnect
        ]
    );

    const globalConversion = useMemo(() => {
        if (!funnel.meetingsPlanned) return 0;
        return Number(((funnel.adbConnect / funnel.meetingsPlanned) * 100).toFixed(1));
    }, [funnel.adbConnect, funnel.meetingsPlanned]);

    const funnelOption = useMemo(() => {
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                formatter: (params) => {
                    const value = Number(params?.value ?? 0);
                    return `${params?.name}<br/><b>${value.toLocaleString('fr-FR')}</b>`;
                }
            },
            series: [
                {
                    name: 'Funnel',
                    type: 'funnel',
                    left: '8%',
                    top: 24,
                    bottom: 24,
                    width: '84%',
                    min: 0,
                    max: Math.max(...steps.map((s) => s.value)),
                    sort: 'none',
                    gap: 6,
                    label: {
                        show: true,
                        position: 'inside',
                        color: '#fff',
                        fontSize: 12,
                        formatter: (p) => {
                            const v = Number(p?.value ?? 0);
                            return `${p.name}\n${v.toLocaleString('fr-FR')}`;
                        }
                    },
                    labelLine: { show: false },
                    itemStyle: {
                        borderColor: 'rgba(255,255,255,0.10)',
                        borderWidth: 1,
                        shadowBlur: 10,
                        shadowColor: 'rgba(0,0,0,0.25)'
                    },
                    emphasis: {
                        label: { fontWeight: '700' },
                        itemStyle: { borderColor: 'rgba(255,255,255,0.25)' }
                    },
                    data: steps.map((s, idx) => ({
                        name: s.label,
                        value: s.value,
                        itemStyle: {
                            color: [
                                '#667eea',
                                '#6f7ae6',
                                '#786ee2',
                                '#7f64dd',
                                '#875ad7',
                                '#764ba2'
                            ][idx]
                        }
                    }))
                }
            ]
        };
    }, [steps]);

    const conversionsOption = useMemo(() => {
        const labels = [
            'Détection',
            'Authentification',
            'Verification start',
            'ADB Pair',
            'ADB Connect'
        ];

        const values = [
            conversions.toParticipants,
            conversions.toLogins,
            conversions.toVerificationStart,
            conversions.toAdbPair,
            conversions.toAdbConnect
        ];

        return {
            backgroundColor: 'transparent',
            grid: { left: 90, right: 24, top: 24, bottom: 24 },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: (params) => {
                    const p = Array.isArray(params) ? params[0] : params;
                    const v = Number(p?.value ?? 0);
                    return `${p?.name}<br/><b>${v.toFixed(1)}%</b>`;
                }
            },
            xAxis: {
                type: 'value',
                min: 0,
                max: 100,
                axisLabel: { color: '#9a9a9a', formatter: '{value}%' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
            },
            yAxis: {
                type: 'category',
                data: labels,
                axisLabel: { color: '#cfcfcf' },
                axisTick: { show: false },
                axisLine: { show: false }
            },
            series: [
                {
                    name: 'Conversion',
                    type: 'bar',
                    data: values,
                    barWidth: 14,
                    itemStyle: {
                        borderRadius: [8, 8, 8, 8],
                        color: {
                            type: 'linear',
                            x: 0,
                            y: 0,
                            x2: 1,
                            y2: 0,
                            colorStops: [
                                { offset: 0, color: '#667eea' },
                                { offset: 1, color: '#764ba2' }
                            ]
                        }
                    }
                }
            ]
        };
    }, [
        conversions.toParticipants,
        conversions.toLogins,
        conversions.toVerificationStart,
        conversions.toAdbPair,
        conversions.toAdbConnect
    ]);

    const meta = analytics ? (
        <span>
            {analytics.funnel.meetingsPlanned} meetings • 
            {analytics.funnel.adbConnect} conversions finales
        </span>
    ) : null;

    if (loading) {
        return (
            <ViewShell title="Analytics" meta={meta}>
                <div className="analytics-loading">
                    <div className="spinner" />
                    <p>Chargement des analytics...</p>
                </div>
            </ViewShell>
        );
    }

    if (error) {
        return (
            <ViewShell title="Analytics" meta={meta}>
                <div className="analytics-error">
                    <p>Erreur lors du chargement des analytics</p>
                    <p style={{ fontSize: '12px', marginTop: '8px', color: '#999' }}>
                        {error}
                    </p>
                </div>
            </ViewShell>
        );
    }

    if (!analytics || !analytics.funnel) {
        return (
            <ViewShell title="Analytics" meta={meta}>
                <div className="analytics-empty">
                    <h3>Aucune donnée disponible</h3>
                    <p>Les métriques de conversion apparaîtront ici une fois les données disponibles.</p>
                </div>
            </ViewShell>
        );
    }

    return (
        <ViewShell title="Analytics" meta={meta}>
            <div className="analytics-container">
                <div className="analytics-filters">
                    {availableIdentities.length > 0 && (
                        <select
                            value={selectedIdentityId || ''}
                            onChange={(e) => setSelectedIdentityId(e.target.value || null)}
                            className="identity-filter"
                        >
                            <option value="">All identity</option>
                            {availableIdentities.map((identity) => (
                                <option key={identity.id} value={identity.id}>
                                    {identity.fullname || 'Inconnu'}
                                </option>
                            ))}
                        </select>
                    )}

                    <select
                        value={selectedPeriod}
                        onChange={(e) => setSelectedPeriod(e.target.value)}
                        className="period-filter"
                    >
                        {PERIOD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="analytics-grid">
                    <section className="analytics-card analytics-card--chart">
                        <header className="analytics-card-header">
                            <div>
                                <div className="analytics-card-title">Funnel de conversion</div>
                                <div className="analytics-card-subtitle">
                                    Sur la période sélectionnée (meetings passés)
                                </div>
                            </div>
                        </header>
                        <div className="analytics-chart">
                            <ReactECharts
                                option={funnelOption}
                                style={{ height: 420, width: '100%' }}
                                notMerge={true}
                                lazyUpdate={true}
                            />
                        </div>
                    </section>

                    <section className="analytics-card analytics-card--chart">
                        <header className="analytics-card-header">
                            <div>
                                <div className="analytics-card-title">Taux par étape</div>
                                <div className="analytics-card-subtitle">
                                    Conversion entre chaque étape (en %)
                                </div>
                            </div>
                        </header>
                        <div className="analytics-chart">
                            <ReactECharts
                                option={conversionsOption}
                                style={{ height: 420, width: '100%' }}
                                notMerge={true}
                                lazyUpdate={true}
                            />
                        </div>
                    </section>
                </div>

                <div className="funnel-stats">
                    <div className="funnel-stat-card">
                        <div className="funnel-stat-label">Taux global</div>
                        <div className="funnel-stat-value">
                            {globalConversion}
                            <span className="funnel-stat-unit">%</span>
                        </div>
                    </div>
                    <div className="funnel-stat-card">
                        <div className="funnel-stat-label">Détection</div>
                        <div className="funnel-stat-value">
                            {conversions.toParticipants}
                            <span className="funnel-stat-unit">%</span>
                        </div>
                    </div>
                    <div className="funnel-stat-card">
                        <div className="funnel-stat-label">Authentification</div>
                        <div className="funnel-stat-value">
                            {conversions.toLogins}
                            <span className="funnel-stat-unit">%</span>
                        </div>
                    </div>
                    <div className="funnel-stat-card">
                        <div className="funnel-stat-label">Verification Start</div>
                        <div className="funnel-stat-value">
                            {conversions.toVerificationStart}
                            <span className="funnel-stat-unit">%</span>
                        </div>
                    </div>
                    <div className="funnel-stat-card">
                        <div className="funnel-stat-label">ADB Pair</div>
                        <div className="funnel-stat-value">
                            {conversions.toAdbPair}
                            <span className="funnel-stat-unit">%</span>
                        </div>
                    </div>
                    <div className="funnel-stat-card">
                        <div className="funnel-stat-label">ADB Connect</div>
                        <div className="funnel-stat-value">
                            {conversions.toAdbConnect}
                            <span className="funnel-stat-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>
        </ViewShell>
    );
}
