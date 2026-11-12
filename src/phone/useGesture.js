import { useEffect, useRef } from 'react';

const MOVE_EPSILON = 2;

// Tracks one pointer on ref.current and hands raw gesture samples to the callbacks.
export function useGesture(ref, handlers) {
    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    });

    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        let track = null;

        const sample = (e, moving) => {
            const now = performance.now();
            return {
                startX: track.startX,
                startY: track.startY,
                dx: e.clientX - track.startX,
                dy: e.clientY - track.startY,
                dt: now - track.startT,
                restMs: moving ? 0 : now - track.lastMoveT,
            };
        };

        const finish = () => {
            if (track && el.hasPointerCapture?.(track.id)) el.releasePointerCapture(track.id);
            track = null;
        };

        const onDown = (e) => {
            if (track) return;
            track = {
                id: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startT: performance.now(),
                lastMoveT: performance.now(),
                lastX: e.clientX,
                lastY: e.clientY,
            };
            try {
                el.setPointerCapture(e.pointerId);
            } catch {
                // capture is best effort (a synthetic pointer may not be active)
            }
        };

        const onMove = (e) => {
            if (!track || e.pointerId !== track.id) return;
            if (Math.hypot(e.clientX - track.lastX, e.clientY - track.lastY) > MOVE_EPSILON) {
                track.lastX = e.clientX;
                track.lastY = e.clientY;
                track.lastMoveT = performance.now();
            }
            handlersRef.current.onMove?.(sample(e, true));
        };

        const onUp = (e) => {
            if (!track || e.pointerId !== track.id) return;
            const s = sample(e, false);
            finish();
            handlersRef.current.onEnd?.(s);
        };

        const onCancel = (e) => {
            if (!track || e.pointerId !== track.id) return;
            finish();
            handlersRef.current.onCancel?.();
        };

        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onCancel);
        return () => {
            el.removeEventListener('pointerdown', onDown);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            el.removeEventListener('pointercancel', onCancel);
            finish();
        };
    }, [ref]);
}
