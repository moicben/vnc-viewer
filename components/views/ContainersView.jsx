import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ViewShell from '../ViewShell.jsx';
import { fetchConfig, fetchContainers } from '../../lib/api.js';
import { buildVncUrl, REFRESH_INTERVAL } from '../../lib/utils.js';

const DEV_CONTAINERS = new Set(['c-template', 'b-template', 'wireguard', 'android', 'c-test']);

function getContainersToDisplay(containers, mode) {
    if (mode === 'dev') {
        return containers.filter(container => DEV_CONTAINERS.has(container.name));
    }
    return containers.filter(
        container => !DEV_CONTAINERS.has(container.name) && container.status === 'Running'
    );
}

function getContainersToPreload(containers) {
    return containers.filter(
        container =>
            DEV_CONTAINERS.has(container.name) ||
            (!DEV_CONTAINERS.has(container.name) && container.status === 'Running')
    );
}

export default function ContainersView() {
    const [config, setConfig] = useState(null);
    const [containers, setContainers] = useState([]);
    const [mode, setMode] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [timeUntilRefresh, setTimeUntilRefresh] = useState(REFRESH_INTERVAL / 1000);

    const refreshTimerRef = useRef(null);
    const refreshIntervalRef = useRef(null);
    const modeSwitcherRef = useRef(null);

    const containersToDisplay = useMemo(
        () => getContainersToDisplay(containers, mode),
        [containers, mode]
    );

    const containersToPreload = useMemo(
        () => getContainersToPreload(containers),
        [containers]
    );

    const loadInitialData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const loadedConfig = await fetchConfig();
            setConfig(loadedConfig);

            const loadedContainers = await fetchContainers();
            setContainers(loadedContainers);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshContainers = useCallback(async () => {
        try {
            const newContainers = await fetchContainers();
            setContainers(newContainers);
            setTimeUntilRefresh(REFRESH_INTERVAL / 1000);
        } catch (err) {
            console.error('Erreur lors du rafraîchissement automatique:', err);
        }
    }, []);

    const stopTimers = useCallback(() => {
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
        }
        if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
    }, []);

    const startTimers = useCallback(() => {
        stopTimers();
        setTimeUntilRefresh(REFRESH_INTERVAL / 1000);
        refreshTimerRef.current = setInterval(() => {
            setTimeUntilRefresh(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        refreshIntervalRef.current = setInterval(() => {
            refreshContainers();
        }, REFRESH_INTERVAL);
    }, [refreshContainers, stopTimers]);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    useEffect(() => {
        if (!config) return;
        startTimers();

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopTimers();
            } else {
                startTimers();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopTimers();
        };
    }, [config, startTimers, stopTimers]);

    const headerMeta = (
        <>
            <span>{containersToDisplay.length}/{containers.length} containers</span>
            <span>Refresh dans {timeUntilRefresh}s</span>
        </>
    );

    const modeSwitcher = (
        <div className="mode-switcher" ref={modeSwitcherRef}>
            <button type="button" className="mode-switcher-btn" data-mode={mode}>
                <span className="mode-switcher-indicator" />
                <span
                    className={`mode-option${mode === 'all' ? ' active' : ''}`}
                    data-mode="all"
                    onClick={() => setMode('all')}
                >
                    All
                </span>
                <span
                    className={`mode-option${mode === 'dev' ? ' active' : ''}`}
                    data-mode="dev"
                    onClick={() => setMode('dev')}
                >
                    Dev
                </span>
            </button>
        </div>
    );

    const updateModeIndicator = useCallback(() => {
        const switcher = modeSwitcherRef.current;
        if (!switcher) return;

        const options = switcher.querySelectorAll('.mode-option');
        const indicator = switcher.querySelector('.mode-switcher-indicator');
        if (!indicator || options.length === 0) return;

        options.forEach((option, index) => {
            if (option.dataset.mode === mode) {
                let left = 0;
                for (let i = 0; i < index; i += 1) {
                    left += options[i].offsetWidth;
                }
                indicator.style.width = `${option.offsetWidth}px`;
                indicator.style.transform = `translateX(${left}px)`;
            }
        });
    }, [mode]);

    useEffect(() => {
        updateModeIndicator();
        window.addEventListener('resize', updateModeIndicator);
        return () => window.removeEventListener('resize', updateModeIndicator);
    }, [updateModeIndicator]);

    if (loading) {
        return (
            <ViewShell title="Containers" meta={headerMeta}>
                <div className="loading">
                    <div className="spinner" />
                    <p>Chargement...</p>
                </div>
            </ViewShell>
        );
    }

    if (error) {
        return (
            <ViewShell title="Containers" meta={headerMeta}>
                <div className="error">Erreur lors du chargement: {error}</div>
            </ViewShell>
        );
    }

    return (
        <ViewShell title="Containers" meta={headerMeta} filters={modeSwitcher}>
            <div className="grid">
                {containersToPreload.length === 0 ? (
                    <div className="empty-state">
                        <h2>Aucun container</h2>
                        <p>
                            {mode === 'dev'
                                ? 'Aucun container dev disponible'
                                : 'Aucun container disponible (mode All)'}
                        </p>
                    </div>
                ) : (
                    containersToPreload.map(container => {
                        const isVisible = containersToDisplay.some(
                            item => item.name === container.name
                        );
                        const hiddenStyle = isVisible
                            ? {}
                            : {
                                  display: 'block',
                                  position: 'absolute',
                                  left: '-9999px',
                                  top: '0',
                                  opacity: 0,
                                  pointerEvents: 'none'
                              };
                        return (
                            <div
                                key={container.name}
                                className={`grid-item${isVisible ? '' : ' hidden'}`}
                                data-container-name={container.name}
                                style={hiddenStyle}
                            >
                                <div className="grid-item-header">
                                    <span>{container.name}</span>
                                    <span className="ip">{container.ip}</span>
                                </div>
                                <iframe
                                    src={buildVncUrl(config?.incusServer, container.ip)}
                                    className="grid-item-iframe"
                                    title={container.name}
                                    allow="fullscreen"
                                    loading="eager"
                                />
                            </div>
                        );
                    })
                )}
            </div>
        </ViewShell>
    );
}
