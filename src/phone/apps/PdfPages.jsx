import { useEffect, useRef } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

// Renders every page of a PDF as a full-width canvas, one after another.
// iOS shows only page one of a PDF inside an iframe, hence pdf.js.
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
                container.appendChild(canvas);

                renderTask = page.render({ canvas, viewport });
                await renderTask.promise;
                renderTask = null;
            }
        };

        run().catch((error) => {
            if (!cancelled) onErrorRef.current?.(error);
        });

        return () => {
            cancelled = true;
            renderTask?.cancel();
            task.destroy().catch(() => {});
            container.replaceChildren();
        };
    }, [url]);

    return <div ref={containerRef} className="phone-pdf" />;
};

export default PdfPages;
