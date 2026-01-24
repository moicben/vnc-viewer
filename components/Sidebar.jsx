export default function Sidebar({ views, activeViewId, collapsed, onToggle, onSelect }) {
    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            <div className="sidebar-header">
                <button
                    type="button"
                    className="sidebar-title sidebar-brand"
                    onClick={onToggle}
                    aria-label={collapsed ? 'Déplier la barre latérale' : 'Rétracter la barre latérale'}
                    title={collapsed ? 'Déplier' : 'Rétracter'}
                >
                    AGI
                </button>
            </div>
            <nav className="sidebar-nav">
                {views.map(view => (
                    <button
                        key={view.id}
                        type="button"
                        className={`sidebar-item${activeViewId === view.id ? ' active' : ''}`}
                        onClick={() => onSelect(view.id)}
                        aria-label={collapsed ? view.label : undefined}
                        title={collapsed ? view.label : undefined}
                    >
                        {view.Icon ? (
                            <span className="sidebar-item-icon" aria-hidden="true">
                                <view.Icon />
                            </span>
                        ) : null}
                        <span className="sidebar-item-label">{view.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
}
