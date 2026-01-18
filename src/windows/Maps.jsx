import React, { useEffect, useRef } from 'react';
import Map, { Marker } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from 'lucide-react';

import WindowWrapper from '../hoc/WindowWrapper';
import WindowControls from '../components/WindowControl';
import useMapStore from '../store/map';
import { mapLocations } from '../constants';

const Maps = () => {
    const mapRef = useRef(null);
    const { location, setLocation } = useMapStore();

    useEffect(() => {
        if (mapRef.current) {
            mapRef.current.flyTo({
                center: [location.lng, location.lat],
                zoom: 12,
                duration: 2000,
            });
        }
    }, [location]);

    return (
        <>
            <div id="window-header">
                <WindowControls target="maps" />
                <p>Maps</p>
                <div></div>
            </div>

            <div className="flex overflow-hidden h-[60vh]">
                <div className="w-48 overflow-y-auto border-r border-gray-300 bg-gray-100 p-2">
                    <p className="mb-2 text-xs font-semibold text-gray-500">FAVORITES</p>
                    <div className="space-y-1">
                        {mapLocations.map((loc) => (
                            <button
                                key={loc.id}
                                onClick={() => setLocation(loc)}
                                className={`flex w-full flex-col rounded px-3 py-2 text-left text-sm transition-colors ${location.id === loc.id
                                        ? 'bg-blue-500 text-white'
                                        : 'hover:bg-gray-200 text-gray-800'
                                    }`}
                            >
                                <span className="font-medium">{loc.name}</span>
                                <span className={`text-xs ${location.id === loc.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                    {loc.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 relative">
                    <Map
                        ref={mapRef}
                        initialViewState={{
                            longitude: location.lng,
                            latitude: location.lat,
                            zoom: 12,
                        }}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle="mapbox://styles/mapbox/streets-v11"
                        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
                    >
                        <Marker longitude={location.lng} latitude={location.lat} anchor="bottom">
                            <MapPin className="text-red-500 h-8 w-8 fill-current" />
                        </Marker>
                    </Map>
                </div>
            </div>
        </>
    );
};

export default WindowWrapper(Maps, 'maps');
