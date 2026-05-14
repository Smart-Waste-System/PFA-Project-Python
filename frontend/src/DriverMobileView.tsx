import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DriverMobileView({ user, onLogout }: { user: any; onLogout: () => void }) {
    const [mission, setMission] = useState<any[]>([]);
    const [activeRoute, setActiveRoute] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchMission = async () => {
        try {
            const routesResponse = await axios.get('http://127.0.0.1:8000/api/routes/');
            const pointsResponse = await axios.get('http://127.0.0.1:8000/api/collection-points/');

            const activeRoutes = routesResponse.data
                .filter((route: any) => route.status === 'PLANNED' || route.status === 'IN_PROGRESS')
                .sort((a: any, b: any) => {
                    const dateA = new Date(a.created_at || a.started_at || 0).getTime();
                    const dateB = new Date(b.created_at || b.started_at || 0).getTime();
                    return dateB - dateA;
                });

            if (activeRoutes.length === 0) {
                setActiveRoute(null);
                setMission([]);
                return;
            }

            const latestRoute = activeRoutes[0];
            const latestRouteId = latestRoute.route_id || latestRoute.id;

            setActiveRoute(latestRoute);

            const activePoints = pointsResponse.data
                .filter((point: any) => point.route === latestRouteId || point.route?.route_id === latestRouteId)
                .filter((point: any) => point.container_detail)
                .filter((point: any) => point.is_emptied === false)
                .sort((a: any, b: any) => a.stop_order - b.stop_order);

            setMission(activePoints);
        } catch (error) {
            console.error('Erreur récupération mission chauffeur :', error);
            setActiveRoute(null);
            setMission([]);
        }
    };

    useEffect(() => {
        fetchMission();
    }, []);

    const handleStartMission = async () => {
        if (!activeRoute) return;

        setIsLoading(true);

        try {
            const routeId = activeRoute.route_id || activeRoute.id;

            await axios.post(`http://127.0.0.1:8000/api/routes/${routeId}/start/`);

            await fetchMission();
        } catch (error: any) {
            console.error('Erreur démarrage mission :', error.response?.data || error.message);
            alert('Erreur lors du démarrage de la mission.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleValidateCollection = async (pointId: string) => {
        setIsLoading(true);

        try {
            await axios.post(`http://127.0.0.1:8000/api/collection-points/${pointId}/validate/`);

            setMission((previousMission) =>
                previousMission.filter((point) => {
                    const currentPointId = point.point_id || point.id;
                    return currentPointId !== pointId;
                })
            );

            await fetchMission();
        } catch (error: any) {
            console.error('Erreur validation collecte :', error.response?.data || error.message);
            alert("Erreur lors de la validation de l'intervention.");
        } finally {
            setIsLoading(false);
        }
    };

    const routeStatus = activeRoute?.status;

    return (
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 font-sans flex flex-col sm:max-w-md sm:mx-auto shadow-2xl relative overflow-hidden">
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 p-5 pt-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <span className="font-bold text-white text-lg">
                                {user.email?.charAt(0).toUpperCase()}
                            </span>
                        </div>

                        <div>
                            <p className="text-emerald-400/80 text-[10px] font-black uppercase tracking-widest">
                                Unité Mobile
                            </p>
                            <h1 className="text-base font-bold text-white">
                                {user.email?.split('@')[0]}
                            </h1>
                        </div>
                    </div>

                    <button
                        onClick={onLogout}
                        className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-all border border-white/5"
                    >
                        Déconnexion
                    </button>
                </div>

                <div className="bg-black/40 rounded-2xl p-4 flex justify-between items-center border border-white/5 shadow-inner">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                            ✓
                        </div>
                        <div>
                            <span className="text-sm font-medium text-slate-300">
                                Points de collecte
                            </span>
                            <p className="text-[11px] text-slate-500 mt-1">
                                {routeStatus ? `Mission : ${routeStatus}` : 'Aucune mission'}
                            </p>
                        </div>
                    </div>

                    <span className="text-2xl font-black text-white">
                        {mission.length}
                    </span>
                </div>

                {activeRoute && routeStatus === 'PLANNED' && (
                    <button
                        onClick={handleStartMission}
                        disabled={isLoading}
                        className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl transition-all disabled:opacity-50"
                    >
                        {isLoading ? 'Démarrage...' : 'Démarrer la mission'}
                    </button>
                )}
            </header>

            <main className="flex-grow p-5 space-y-4 overflow-y-auto pb-8">
                <div className="flex justify-between items-end mb-6 mt-2">
                    <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Feuille de route
                    </h2>

                    <button
                        onClick={fetchMission}
                        disabled={isLoading}
                        className="text-emerald-400 text-xs font-semibold hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md disabled:opacity-50"
                    >
                        Actualiser
                    </button>
                </div>

                {mission.length === 0 ? (
                    <div className="text-center p-8 bg-gradient-to-b from-slate-800/50 to-transparent border border-dashed border-slate-700 rounded-3xl mt-10">
                        <div className="text-5xl mb-4 opacity-80">☕</div>
                        <h3 className="text-lg font-bold text-white">
                            Zone propre
                        </h3>
                        <p className="text-sm text-slate-400 mt-2">
                            Aucun point de collecte n'est assigné à votre véhicule.
                        </p>
                    </div>
                ) : (
                    mission.map((point, index) => {
                        const pointId = point.point_id || point.id;
                        const container = point.container_detail || {};
                        const fillLevel = Number(container.fill_level) || 0;
                        const isFull = container.alert_status === 'FULL';
                        const isNextStop = index === 0;

                        return (
                            <div
                                key={pointId}
                                className={`bg-slate-900 border rounded-2xl p-5 flex flex-col gap-5 shadow-lg relative overflow-hidden group ${
                                    isNextStop ? 'border-emerald-500/40' : 'border-white/5'
                                }`}
                            >
                                <div
                                    className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl opacity-20 rounded-full pointer-events-none ${isFull ? 'bg-red-500' : 'bg-orange-500'
                                        }`}
                                />

                                {isNextStop && routeStatus === 'IN_PROGRESS' && (
                                    <div className="z-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest w-fit">
                                        Prochain arrêt
                                    </div>
                                )}

                                <div className="flex justify-between items-start z-10">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div
                                                className={`w-2 h-2 rounded-full ${isFull ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
                                                    }`}
                                            />
                                            <h3 className="font-bold text-lg text-white">
                                                Stop {point.stop_order}
                                            </h3>
                                        </div>

                                        <p className="text-sm text-slate-300">
                                            Bac {container.name || String(container.container_id || '').substring(0, 4)}
                                        </p>

                                        <p className="text-slate-400 text-xs font-mono bg-black/30 w-fit px-2 py-1 rounded-md mt-2">
                                            {Number(container.latitude).toFixed(5)}, {Number(container.longitude).toFixed(5)}
                                        </p>
                                    </div>

                                    <div
                                        className={`px-3 py-1.5 rounded-xl text-sm font-black border backdrop-blur-md ${isFull
                                                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                                : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                            }`}
                                    >
                                        {fillLevel}%
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleValidateCollection(pointId)}
                                    disabled={isLoading || routeStatus === 'PLANNED'}
                                    className={`w-full border font-bold py-3.5 rounded-xl transition-all duration-300 shadow-md flex justify-center items-center gap-2 active:scale-[0.98] z-10 disabled:opacity-50 ${routeStatus === 'PLANNED'
                                            ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-not-allowed'
                                            : 'bg-slate-800/80 hover:bg-emerald-600 border-slate-700 hover:border-emerald-500 text-slate-200 hover:text-white'
                                        }`}
                                >
                                    {routeStatus === 'PLANNED'
                                        ? "Démarrez d'abord la mission"
                                        : isLoading
                                            ? 'Validation...'
                                            : "Valider l'intervention"}
                                </button>
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
}
