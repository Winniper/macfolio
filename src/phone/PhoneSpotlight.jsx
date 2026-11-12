import { useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { phoneRegistry } from '../constants/apps';
import useProjects from '../hooks/useProjects';
import useSkills from '../hooks/useSkills';
import { swipeDirection } from '../lib/gestures';
import { runMenuAction } from '../lib/menuActions';
import { phoneSpotlightEntries } from '../lib/phone';
import { buildSpotlightIndex, flattenResults, searchSpotlight } from '../lib/spotlight';
import useSystemStore from '../store/system';
import { useGesture } from './useGesture';
import { useSheetMotion, useSheetMount } from './useSheet';

// The sheet mounts only while it is shown, so every open starts with an empty query.
const SpotlightSheet = ({ onClosed, returnFocus }) => {
    const open = useSystemStore((state) => state.spotlightOpen);
    const closeSpotlight = useSystemStore((state) => state.closeSpotlight);
    const tracks = useSystemStore((state) => state.library);
    const { projects } = useProjects();
    const { skills } = useSkills();
    const [query, setQuery] = useState('');
    const sheetRef = useRef(null);
    const backdropRef = useRef(null);
    const headerRef = useRef(null);
    const inputRef = useRef(null);

    const index = useMemo(
        () => phoneSpotlightEntries(buildSpotlightIndex({ apps: phoneRegistry, projects, skills, tracks })),
        [projects, skills, tracks],
    );
    const hasQuery = query.trim() !== '';
    // With nothing typed, the phone apps are the suggestions.
    const groups = useMemo(() => {
        if (hasQuery) return searchSpotlight(index, query);
        const apps = index.filter((entry) => entry.group === 'apps');
        return apps.length ? [{ id: 'apps', label: 'Suggestions', results: apps }] : [];
    }, [index, query, hasQuery]);
    const results = flattenResults(groups);

    useSheetMotion({ open, close: closeSpotlight, sheetRef, backdropRef, focusRef: inputRef, onClosed, returnFocus });

    // A swipe up on the header closes the sheet; the results list scrolls on its own.
    useGesture(headerRef, {
        onEnd: (sample) => {
            if (swipeDirection(sample) === 'up') closeSpotlight();
        },
    });

    const choose = (entry) => {
        closeSpotlight();
        runMenuAction(entry.action);
    };

    const handleKeyDown = (event) => {
        // Enter that confirms an IME composition is not a choice.
        if (event.nativeEvent.isComposing) return;

        if (event.key === 'Enter' && event.target === inputRef.current) {
            event.preventDefault();
            if (results[0]) choose(results[0]);
        }
    };

    return (
        <div className="phone-spotlight" data-closing={!open} onKeyDown={handleKeyDown}>
            <button
                ref={backdropRef}
                type="button"
                className="phone-spotlight-backdrop"
                aria-label="Close Spotlight"
                tabIndex={-1}
                onClick={closeSpotlight}
            />
            <div ref={sheetRef} className="phone-spotlight-sheet" role="dialog" aria-label="Spotlight">
                <div ref={headerRef} className="phone-spotlight-header">
                    <label className="phone-spotlight-field">
                        <Search size={17} aria-hidden="true" />
                        <input
                            ref={inputRef}
                            type="search"
                            value={query}
                            placeholder="Search"
                            aria-label="Spotlight Search"
                            autoCapitalize="none"
                            autoCorrect="off"
                            autoComplete="off"
                            spellCheck={false}
                            enterKeyHint="search"
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                    <button type="button" className="phone-spotlight-cancel" onClick={closeSpotlight}>Cancel</button>
                    <span className="phone-spotlight-handle" aria-hidden="true" />
                </div>
                <div className="phone-spotlight-results phone-scroll">
                    {groups.length === 0 ? (
                        <p className="phone-spotlight-empty">No results</p>
                    ) : groups.map((group) => (
                        <section key={group.id} aria-label={group.label}>
                            <h2 className="phone-spotlight-group">{group.label}</h2>
                            {group.results.map((entry) => (
                                <button
                                    key={entry.id}
                                    type="button"
                                    className="phone-spotlight-row"
                                    onClick={() => choose(entry)}
                                >
                                    <img src={entry.icon} alt="" draggable="false" />
                                    <span className="phone-spotlight-title">{entry.title}</span>
                                    <span className="phone-spotlight-subtitle">{entry.subtitle}</span>
                                </button>
                            ))}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};

const PhoneSpotlight = () => {
    const { render, onClosed, returnFocus } = useSheetMount('spotlightOpen');

    return render ? <SpotlightSheet onClosed={onClosed} returnFocus={returnFocus} /> : null;
};

export default PhoneSpotlight;
