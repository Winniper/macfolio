// Holds at most one running GSAP animation (tween or timeline). Playing a new
// one kills the previous outright — unlike gsap.killTweensOf(), which leaves an
// emptied timeline behind that still fires its onComplete on the next tick.
export const createAnimationSlot = () => {
    let current = null;

    return {
        play(animation) {
            current?.kill();
            current = animation;
            return animation;
        },
        // Jump the running animation to its end values, then drop it.
        finish() {
            current?.progress(1).kill();
            current = null;
        },
        // Drop the running animation where it is.
        stop() {
            current?.kill();
            current = null;
        },
    };
};
