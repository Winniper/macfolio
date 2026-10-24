import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import useProjects from '../../hooks/useProjects';
import useSkills from '../../hooks/useSkills';
import { runMenuAction } from '../../lib/menuActions';
import { getPlatform, isMacPlatform, isSpotlightKey } from '../../lib/shortcuts';
import { buildSpotlightIndex, flattenResults, moveSelection, searchSpotlight } from '../../lib/spotlight';
import useSystemStore, { isDesktopPhase } from '../../store/system';

const isMac = isMacPlatform(getPlatform());

// The panel mounts only while open, so every open starts with an empty query.
const SpotlightPanel = () => {
    const closeSpotlight = useSystemStore((state) => state.closeSpotlight);
    const tracks = useSystemStore((state) => state.library);
    const { projects } = useProjects();
    const { skills } = useSkills();
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(0);
    const panelRef = useRef(null);

    // A failed fetch leaves an empty list, so apps are still found.
    const index = useMemo(() => buildSpotlightIndex({ projects, skills, tracks }), [projects, skills, tracks]);
    const groups = useMemo(() => searchSpotlight(index, query), [index, query]);
    const results = flattenResults(groups);
    const active = Math.min(selected, Math.max(results.length - 1, 0));
    const hasQuery = query.trim() !== '';

    // Close on a press outside (the magnifier toggles on its own) or leaving the page.
    useEffect(() => {
        const handlePointerDown = (event) => {
            if (panelRef.current?.contains(event.target)) return;
            if (event.target.closest?.('[data-spotlight-toggle]')) return;
            closeSpotlight();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('blur', closeSpotlight);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('blur', closeSpotlight);
        };
    }, [closeSpotlight]);

    useEffect(() => {
        document.getElementById(`spotlight-${active}`)?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const choose = (entry) => {
        closeSpotlight();
        runMenuAction(entry.action);
    };

    const handleKeyDown = (event) => {
        // Enter that confirms an IME composition is not a choice.
        if (event.nativeEvent.isComposing) return;

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected(moveSelection(active, event.key === 'ArrowDown' ? 1 : -1, results.length));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            if (results[active]) choose(results[active]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeSpotlight();
        }
    };

    return (
        <div
            ref={panelRef}
            className="spotlight"
            role="dialog"
            aria-label="Spotlight Search"
            // Keep focus in the input so Esc and the arrows still work after clicking the
            // padding, a label or a row. preventDefault on pointerdown only stops the focus
            // change (and text selection); click still fires, so rows still activate.
            onPointerDown={(event) => {
                if (event.target.tagName !== 'INPUT') event.preventDefault();
            }}
        >
            <div className="spotlight-field">
                <Search size={22} aria-hidden="true" />
                <input
                    autoFocus
                    type="text"
                    value={query}
                    placeholder="Spotlight Search"
                    aria-label="Spotlight Search"
                    role="combobox"
                    aria-expanded={results.length > 0}
                    aria-controls="spotlight-results"
                    aria-activedescendant={results[active] ? `spotlight-${active}` : undefined}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setSelected(0);
                    }}
                    onKeyDown={handleKeyDown}
                />
            </div>
            {hasQuery && (
                <div id="spotlight-results" className="spotlight-results" role="listbox">
                    {groups.length === 0 ? (
                        <p className="spotlight-empty">No results</p>
                    ) : groups.map((group) => (
                        <div key={group.id} role="group" aria-label={group.label}>
                            <p className="spotlight-group">{group.label}</p>
                            {group.results.map((entry) => {
                                const position = results.indexOf(entry);

                                return (
                                    <button
                                        key={entry.id}
                                        id={`spotlight-${position}`}
                                        type="button"
                                        role="option"
                                        tabIndex={-1}
                                        aria-selected={position === active}
                                        className={`spotlight-row${position === active ? ' is-selected' : ''}`}
                                        onPointerMove={() => setSelected(position)}
                                        onClick={() => choose(entry)}
                                    >
                                        <img src={entry.icon} alt="" />
                                        <span className="spotlight-title">{entry.title}</span>
                                        <span className="spotlight-subtitle">{entry.subtitle}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Owns the global shortcut; works even while a text field has focus.
const Spotlight = () => {
    const open = useSystemStore((state) => state.spotlightOpen);

    useEffect(() => {
        const handleKeyDown = (event) => {
            const system = useSystemStore.getState();

            if (!isDesktopPhase(system) || !isSpotlightKey(event, isMac)) return;

            event.preventDefault();
            // A held key repeats: stop the browser acting on it, but toggle only once.
            if (event.repeat) return;
            system.toggleSpotlight();
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, []);

    return open ? <SpotlightPanel /> : null;
};

export default Spotlight;
