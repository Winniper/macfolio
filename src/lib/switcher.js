import { switcherModifier } from './shortcuts';

// Open windows for the switcher: visible ones first, then minimized, each
// group most-recently-raised first.
export const switcherOrder = (windows) =>
    Object.entries(windows)
        .filter(([, window]) => window.isOpen)
        .sort(([, a], [, b]) =>
            Number(a.isMinimized) - Number(b.isMinimized) || b.zIndex - a.zIndex)
        .map(([key]) => key);

const result = (state, commit = null, handled = false) => ({ state, commit, handled });

// Keyboard state machine for the app switcher. `handled` tells the caller to
// preventDefault; `commit` is the app to switch to.
export const switcherReducer = (state, action, { isMac, order }) => {
    switch (action.type) {
        case 'keydown': {
            if (!state) {
                const modifier = switcherModifier(action, isMac);

                if (!modifier || order.length === 0) return result(null);

                return result({ order, index: order.length > 1 ? 1 : 0, modifier }, null, true);
            }

            if (action.key === 'Escape') return result(null, null, true);

            if (action.key === 'Tab' || action.code === 'Backquote') {
                const count = state.order.length;
                const step = action.shiftKey ? -1 : 1;

                return result({ ...state, index: (state.index + step + count) % count }, null, true);
            }

            return result(state);
        }

        case 'keyup':
            if (state && action.key === state.modifier) {
                return result(null, state.order[state.index], true);
            }

            return result(state);

        case 'blur':
            return result(null);

        default:
            return result(state);
    }
};
