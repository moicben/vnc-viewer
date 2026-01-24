import { useState } from 'react';
import Sidebar from './Sidebar.jsx';

export default function Layout({ views, activeView, onSelectView, children }) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="dashboard">
            <Sidebar
                views={views}
                activeViewId={activeView.id}
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(prev => !prev)}
                onSelect={onSelectView}
            />
            <main className="dashboard-main">
                <div className="dashboard-content">{children}</div>
            </main>
        </div>
    );
}
