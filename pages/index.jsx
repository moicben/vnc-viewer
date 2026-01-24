import Head from 'next/head';
import { useMemo } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout.jsx';
import { viewRegistry, DEFAULT_VIEW_ID } from '../components/views/registry.js';

export default function DashboardPage() {
    const router = useRouter();
    const queryView = typeof router.query.view === 'string' ? router.query.view : null;

    const activeView = useMemo(() => {
        const fallbackView =
            viewRegistry.find(view => view.id === DEFAULT_VIEW_ID) || viewRegistry[0];
        if (!queryView) return fallbackView;
        return viewRegistry.find(view => view.id === queryView) || fallbackView;
    }, [queryView]);

    const handleSelectView = viewId => {
        router.push(
            {
                pathname: '/',
                query: { view: viewId }
            },
            undefined,
            { shallow: true }
        );
    };

    const ActiveComponent = activeView.Component;

    return (
        <>
            <Head>
                <title>VNC Viewer Dashboard</title>
            </Head>
            <Layout views={viewRegistry} activeView={activeView} onSelectView={handleSelectView}>
                <ActiveComponent />
            </Layout>
        </>
    );
}
