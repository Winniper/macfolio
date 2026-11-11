import { Search } from 'lucide-react';

import { hostnameOf } from '../../lib/browser';

// Shown for sites (Google, DuckDuckGo…) that answer Safari's proxy with a
// captcha or a block. Searches typed here go to the default engine.
const BlockedPage = ({ url, onSearch }) => {
    const submit = (event) => {
        event.preventDefault();

        const text = new FormData(event.currentTarget).get('q');

        if (typeof text === 'string' && text.trim() !== '') onSearch(text.trim());
    };

    return (
        <div className="browser-page browser-blocked">
            <h2 className="browser-page-title">This site can’t be opened here</h2>
            <p>
                {hostnameOf(url)} blocks visitors who arrive through a proxy, which is how Safari loads pages. Try the same search on Bing instead.
            </p>
            <form className="browser-blocked-search" onSubmit={submit}>
                <Search size={14} />
                <input name="q" aria-label="Search" placeholder="Search the web" autoComplete="off" spellCheck={false} />
            </form>
        </div>
    );
};

export default BlockedPage;
