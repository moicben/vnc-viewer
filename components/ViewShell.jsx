export default function ViewShell({ title, meta, actions, filters, children }) {
    return (
        <section className="view-shell">
            {filters ? <div className="view-section">{filters}</div> : null}
            {actions ? <div className="view-section">{actions}</div> : null}
            <div className="view-content">{children}</div>
        </section>
    );
}
