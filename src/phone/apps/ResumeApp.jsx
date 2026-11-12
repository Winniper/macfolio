import { Component, lazy, Suspense, useMemo, useState } from 'react';
import { AlertTriangle, Download, Loader2, RefreshCw } from 'lucide-react';

import useResume from '../../hooks/useResume';
import AppScreen from '../AppScreen';

// A failed chunk load rejects inside Suspense; without a boundary it would
// unmount the whole phone UI. The boundary reports it as a render error.
class PdfBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error('Error loading the PDF renderer:', error);
        this.props.onError();
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}

const Loading = () => (
    <div className="phone-terminal-state">
        <Loader2 size={30} className="phone-spin" aria-hidden="true" />
        <span>Loading resume...</span>
    </div>
);

// The resume as a scrolling stack of rendered pages, with Download in the toolbar.
const ResumeApp = () => {
    const { resume, loading, error, retry } = useResume();
    const [renderError, setRenderError] = useState(false);
    const [attempt, setAttempt] = useState(0);

    const toolbar = resume && (
        <a className="phone-toolbar-link" href={resume.downloadUrl} download="Resume.pdf">
            <Download size={18} aria-hidden="true" />
            <span>Download</span>
        </a>
    );

    // A new lazy() per attempt, so Retry re-requests a chunk that failed to load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const PdfPages = useMemo(() => lazy(() => import('./PdfPages')), [attempt]);

    const retryRender = () => {
        setRenderError(false);
        setAttempt((value) => value + 1);
    };

    return (
        <AppScreen title="Resume" toolbar={toolbar}>
            {loading ? (
                <Loading />
            ) : error ? (
                <div className="phone-terminal-state is-error">
                    <div className="phone-terminal-error">
                        <AlertTriangle size={18} aria-hidden="true" />
                        <span>Error: {error}</span>
                    </div>
                    <button type="button" onClick={retry}>
                        <RefreshCw size={14} aria-hidden="true" />
                        <span>Retry</span>
                    </button>
                </div>
            ) : !resume ? (
                <p className="phone-empty">No resume yet.</p>
            ) : renderError ? (
                <div className="phone-terminal-state is-error">
                    <div className="phone-terminal-error">
                        <AlertTriangle size={18} aria-hidden="true" />
                        <span>Couldn't display the PDF.</span>
                    </div>
                    <button type="button" onClick={retryRender}>
                        <RefreshCw size={14} aria-hidden="true" />
                        <span>Retry</span>
                    </button>
                </div>
            ) : (
                <PdfBoundary key={attempt} onError={() => setRenderError(true)}>
                    <Suspense fallback={<Loading />}>
                        <PdfPages url={resume.url} onError={() => setRenderError(true)} />
                    </Suspense>
                </PdfBoundary>
            )}
        </AppScreen>
    );
};

export default ResumeApp;
