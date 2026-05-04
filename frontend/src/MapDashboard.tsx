import { useState, useEffect } from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiaTR5YiIsImEiOiJjbW9xNzRvaW4xaHduMnFxeW42dXQzYmFuIn0.4WOm3T2-zp5_TodiH-Dlbg';

export default function MapDashboard() {
    const [containers, setContainers] = useState<any[]>([]);
    const [routeData, setRouteData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewState, setViewState] = useState({
        longitude: -7.5898,
        latitude: 33.5731,
        zoom: 12
    });

    // Récupération initiale des conteneurs
    const fetchContainers = async () => {
        try {
            const response = await axios.get('http://localhost:8000/api/containers/');
            setContainers(response.data);
        } catch (error) {
            console.error("Erreur de récupération des données:", error);
        }
    };

    // LOGIQUE DE NAVIGATION RÉALISTE (Type Google Maps)
    const calculateOptimization = async () => {
        setIsLoading(true);
        try {
            // 1. Appel à ton algorithme VRP (Backend Django)
            const response = await axios.post('http://localhost:8000/api/routing/calculate/', {});
            const points = response.data.ordered_points;

            if (points && points.length > 1) {
                // 2. Préparation des coordonnées pour l'API Directions de Mapbox
                // Format attendu par Mapbox : lng,lat;lng,lat...
                const waypoints = points
                    .map((p: any) => `${p.longitude},${p.latitude}`)
                    .join(';');

                // 3. Appel à l'API Directions de Mapbox pour obtenir le tracé routier
                const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
                
                const routeResponse = await axios.get(directionsUrl);
                const routeGeoJSON = routeResponse.data.routes[0].geometry;

                // 4. On stocke le tracé routier exact dans le state
                setRouteData({
                    type: 'Feature',
                    properties: {},
                    geometry: routeGeoJSON
                });
            }
        } catch (error: any) {
            console.error("Erreur lors de l'optimisation:", error.response?.data || error.message);
            alert("Erreur de calcul. Vérifiez que les camions et conteneurs sont bien localisés.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchContainers();
    }, []);

    const getMarkerColor = (status: string) => {
        if (status === 'FULL') return '#ef4444';
        if (status === 'PARTIAL') return '#f97316';
        return '#22c55e';
    };

    return (
        <div className="w-full h-screen flex flex-col bg-gray-100 font-sans">
            {/* Header Moderne */}
            <header className="bg-slate-900 text-white p-4 shadow-xl flex justify-between items-center z-10 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-500 rounded-lg flex items-center justify-center shadow-lg shadow-sky-500/20">
                        <span className="text-xl">🚛</span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold leading-none">Smart Waste System</h1>
                        <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Casablanca Smart City</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setViewState({ longitude: -7.5898, latitude: 33.5731, zoom: 12.5 })}
                        className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-md text-sm transition-all border border-slate-600 flex items-center gap-2"
                    >
                        📍 Recentre
                    </button>
                    <button 
                        onClick={calculateOptimization}
                        disabled={isLoading}
                        className={`${isLoading ? 'bg-slate-600 cursor-not-allowed' : 'bg-sky-600 hover:bg-sky-500 hover:scale-105'} px-6 py-2 rounded-md text-sm font-bold transition-all shadow-lg shadow-sky-900/20 flex items-center gap-2`}
                    >
                        {isLoading ? '⌛ Calcul...' : '🚀 Optimiser la Tournée'}
                    </button>
                    <button 
                        onClick={fetchContainers}
                        className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-md text-sm transition-all shadow-lg shadow-emerald-900/20"
                    >
                        🔄 Actualiser
                    </button>
                </div>
            </header>

            {/* Zone Carte */}
            <main className="flex-grow relative overflow-hidden">
                <Map
                    {...viewState}
                    onMove={evt => setViewState(evt.viewState)}
                    mapStyle="mapbox://styles/mapbox/dark-v11" // Style sombre pour faire ressortir le tracé
                    mapboxAccessToken={MAPBOX_TOKEN}
                    style={{ width: '100%', height: '100%' }}
                >
                    <NavigationControl position="top-right" />

                    {/* Le Tracé Routier Réel (Style InDrive) */}
                    {routeData && (
                        <Source id="route-source" type="geojson" data={routeData}>
                            <Layer
                                id="route-layer"
                                type="line"
                                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                paint={{
                                    'line-color': '#0ea5e9', // Bleu électrique
                                    'line-width': 6,
                                    'line-opacity': 0.8,
                                    'line-blur': 1
                                }}
                            />
                        </Source>
                    )}

                    {/* Marqueurs avec halo lumineux */}
                    {containers.map((container) => (
                        <Marker
                            key={container.container_id}
                            longitude={parseFloat(container.longitude)}
                            latitude={parseFloat(container.latitude)}
                            anchor="bottom"
                        >
                            <div className="relative group">
                                <div 
                                    className="absolute -inset-1 rounded-full blur opacity-25 group-hover:opacity-50 transition-opacity"
                                    style={{ backgroundColor: getMarkerColor(container.alert_status) }}
                                ></div>
                                <div
                                    className="relative w-6 h-6 rounded-full border-2 border-white shadow-md cursor-pointer transform hover:scale-125 transition-all"
                                    style={{ backgroundColor: getMarkerColor(container.alert_status) }}
                                    title={`Conteneur ${container.name || container.container_id}: ${container.fill_level}%`}
                                />
                            </div>
                        </Marker>
                    ))}
                </Map>

                {/* Légende flottante */}
                <div className="absolute bottom-6 left-6 bg-slate-900/90 backdrop-blur text-white p-4 rounded-xl border border-slate-700 shadow-2xl text-xs space-y-2">
                    <p className="font-bold border-b border-slate-700 pb-2 mb-2">Statut des Points</p>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div> <span>Plein (Prioritaire)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div> <span>Partiel</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div> <span>Vide / Opérationnel</span>
                    </div>
                </div>
            </main>
        </div>
    );
}