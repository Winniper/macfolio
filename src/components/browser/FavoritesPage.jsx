import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

import { favoritesFromProjects, hostnameOf } from '../../lib/browser';
import useProjects from '../../hooks/useProjects';

// Start page: one tile per project that has a deployed website.
const FavoritesPage = ({ onOpen }) => {
    const { projects, loading, error, retry } = useProjects();
    const favorites = favoritesFromProjects(projects);

    return (
        <div className="browser-page">
            <h2 className="browser-page-title">Favorites</h2>

            {loading && (
                <div className="browser-page-status">
                    <Loader2 size={28} className="animate-spin text-blue-400" />
                    <span>Loading projects…</span>
                </div>
            )}

            {!loading && error && (
                <div className="browser-page-status">
                    <span className="flex items-center gap-2 text-red-400">
                        <AlertTriangle size={20} />
                        {error}
                    </span>
                    <button type="button" className="browser-retry" onClick={retry}>
                        <RefreshCw size={14} />
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && favorites.length === 0 && (
                <p className="browser-page-status">No live projects yet.</p>
            )}

            {!loading && !error && favorites.length > 0 && (
                <div className="browser-favorites">
                    {favorites.map((favorite) => (
                        <button
                            key={favorite.id}
                            type="button"
                            className="browser-favorite"
                            onClick={() => onOpen(favorite)}
                        >
                            <span className="browser-favorite-icon">
                                {favorite.title.charAt(0).toUpperCase()}
                            </span>
                            <span className="browser-favorite-title">{favorite.title}</span>
                            <span className="browser-favorite-host">{hostnameOf(favorite.url)}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FavoritesPage;
