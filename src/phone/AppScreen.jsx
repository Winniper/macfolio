import { ChevronLeft } from 'lucide-react';

// The dark chrome inside a phone app: a large title (with a back link when the
// app has drilled into a sub-page), scrolling content and an optional toolbar
// pinned above the Home bar. `flush` drops the title and the content padding.
const AppScreen = ({ title, back, onBack, toolbar, flush = false, children }) => (
    <div className={`phone-appscreen${flush ? ' is-flush' : ''}`}>
        {!flush && (
            <header className="phone-appscreen-head">
                {back && (
                    <button type="button" className="phone-back" onClick={onBack}>
                        <ChevronLeft size={22} strokeWidth={2.4} aria-hidden="true" />
                        <span>{back}</span>
                    </button>
                )}
                <h1>{title}</h1>
            </header>
        )}
        <div className="phone-scroll phone-appscreen-content">{children}</div>
        {toolbar && <div className="phone-appscreen-toolbar">{toolbar}</div>}
    </div>
);

export default AppScreen;
