export default function Sidebar({ views, activeViewId, collapsed, onToggle, onSelect }) {
    return (
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            <div className="sidebar-header">
                <span className="sidebar-title">{collapsed ? 'VM' : 'VNC Monitor'}</span>
                <button type="button" className="sidebar-toggle" onClick={onToggle}>
                    {collapsed ? '→' : '←'}
                </button>
            </div>
            <nav className="sidebar-nav">
                {views.map(view => (
                    <button
                        key={view.id}
                        type="button"
                        className={`sidebar-item${activeViewId === view.id ? ' active' : ''}`}
                        onClick={() => onSelect(view.id)}
                    >
                        <span className="sidebar-item-label">{view.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
}
