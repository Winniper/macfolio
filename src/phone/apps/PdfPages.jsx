import { useEffect, useRef } from 'react';
// The legacy build bundles polyfills: the modern one needs Safari 18.2+.
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

// Renders every page of a PDF as a full-width canvas, one after another.
// iOS shows only page one of a PDF inside an iframe, hence pdf.js.
const NO_RENDER_TIMEOUT = 15000;

const PdfPages = ({ url, onError }) => {
    const containerRef = useRef(null);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onErrorRef.current = onError;
    });

    useEffect(() => {
        const container = containerRef.current;
        let cancelled = false;
        let renderTask = null;
        const task = getDocument({ url });
        // A render that never starts (a worker that failed silently) ends in the error state.
        let guard = setTimeout(() => {
            guard = null;
            if (!cancelled) onErrorRef.current?.(new Error('The resume did not render in time.'));
        }, NO_RENDER_TIMEOUT);
        const clearGuard = () => {
            clearTimeout(guard);
            guard = null;
        };

        const run = async () => {
            const pdf = await task.promise;
            const scale = Math.min(window.devicePixelRatio || 1, 2);

            for (let number = 1; number <= pdf.numPages; number += 1) {
                const page = await pdf.getPage(number);
                if (cancelled) return;

                const base = page.getViewport({ scale: 1 });
                const cssWidth = container.clientWidth || base.width;
                const viewport = page.getViewport({ scale: (cssWidth / base.width) * scale });

                const canvas = document.createElement('canvas');
                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                canvas.style.width = '100%';
                canvas.style.height = 'auto';
                canvas.className = 'phone-pdf-page';
                canvas.setAttribute('role', 'img');
                canvas.setAttribute('aria-label', `Resume page ${number}`);
                container.appendChild(canvas);

                renderTask = page.render({ canvas, viewport });
                await renderTask.promise;
                renderTask = null;
                clearGuard();
            }
        };

        run().catch((error) => {
            clearGuard();
            if (!cancelled) onErrorRef.current?.(error);
        });

        return () => {
            cancelled = true;
            clearGuard();
            renderTask?.cancel();
            task.destroy().catch(() => {});
            container.replaceChildren();
        };
    }, [url]);

    return <div ref={containerRef} className="phone-pdf" />;
};

export default PdfPages;
