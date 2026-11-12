import { useEffect, useRef } from 'react';

import { TAP_SLOP } from '../lib/gestures';

const MOVE_EPSILON = 2;

// Tracks one pointer on ref.current and hands raw gesture samples to the callbacks.
// The pointer is captured only once it has moved past TAP_SLOP, so a tap on a
// button inside the element still lands on (and clicks) that button.
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

        // Clear the track before releasing, so the lostpointercapture that the
        // release causes is not mistaken for a cancel.
        const finish = () => {
            const ended = track;
            track = null;
            if (ended && el.hasPointerCapture?.(ended.id)) el.releasePointerCapture(ended.id);
        };

        const capture = (pointerId) => {
            try {
                el.setPointerCapture(pointerId);
            } catch {
                // capture is best effort (a synthetic pointer may not be active)
            }
        };

        const onDown = (e) => {
            // Only the primary button (or a touch/pen contact) starts a gesture.
            // An uncaptured track whose pointerup happened elsewhere is stale.
            if (track?.captured || e.button > 0) return;
            track = {
                id: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startT: performance.now(),
                lastMoveT: performance.now(),
                lastX: e.clientX,
                lastY: e.clientY,
                captured: false,
            };
        };

        const onMove = (e) => {
            if (!track || e.pointerId !== track.id) return;
            if (!track.captured
                && Math.hypot(e.clientX - track.startX, e.clientY - track.startY) > TAP_SLOP) {
                track.captured = true;
                capture(e.pointerId);
            }
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

        // lostpointercapture bubbles: a child losing its implicit touch capture
        // (to us, when we capture) is not the end of the gesture.
        const onLostCapture = (e) => {
            if (e.target === el) onCancel(e);
        };

        el.addEventListener('pointerdown', onDown);
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onCancel);
        el.addEventListener('lostpointercapture', onLostCapture);
        return () => {
            el.removeEventListener('pointerdown', onDown);
            el.removeEventListener('pointermove', onMove);
            el.removeEventListener('pointerup', onUp);
            el.removeEventListener('pointercancel', onCancel);
            el.removeEventListener('lostpointercapture', onLostCapture);
            finish();
        };
    }, [ref]);
}
