import { useState, useEffect } from 'react';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiaTR5YiIsImEiOiJjbW9xNzRvaW4xaHduMnFxeW42dXQzYmFuIn0.4WOm3T2-zp5_TodiH-Dlbg';

export default function MapDashboard({ user, onLogout }: any) {
    const [activeTab, setActiveTab] = useState<'map' | 'crud' | 'dispatch' | 'overview'>('map');
    const [crudTab, setCrudTab] = useState<'containers' | 'trucks'>('containers');
    const [containers, setContainers] = useState<any[]>([]);

    // États pour le Dispatch Logistique
    const [drivers, setDrivers] = useState<any[]>([]);
    const [trucks, setTrucks] = useState<any[]>([]);

    // Fonction pour charger les ressources (à appeler dans un useEffect si tu as les endpoints, 
    // ou on les mock temporairement pour le design du MVP)
    const loadResources = async () => {
        try {
            // Remplace par tes vrais endpoints si tu les as créés, sinon ça garde une liste vide/mockée
            const dRes = await axios.get('http://127.0.0.1:8000/api/users/?role=DRIVER').catch(() => ({ data: [{ id: '1', email: 'driver1@smartwaste.ma' }] }));
            const tRes = await axios.get('http://127.0.0.1:8000/api/trucks/').catch(() => ({ data: [{ id: '1', license_plate: '1234-A-50', capacity: 100 }] }));
            setDrivers(dRes.data);
            setTrucks(tRes.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        if (user?.role === 'ADMIN') loadResources();
    }, [user]);
    const [selectedContainer, setSelectedContainer] = useState<any>(null);
    const [routeData, setRouteData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [viewState, setViewState] = useState({
        longitude: -7.5898,
        latitude: 33.5731,
        zoom: 12
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [formEntity, setFormEntity] = useState<'containers' | 'trucks'>('containers');
    const [formData, setFormData] = useState<any>({});

    const openModal = (mode: 'add' | 'edit', entity: 'containers' | 'trucks', data: any = {}) => {
        setModalMode(mode);
        setFormEntity(entity);
        setFormData(data);
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (modalMode === 'add') {
                // On s'assure d'envoyer un fill_level par défaut pour éviter les bugs
                const payload = { ...formData };
                if (formEntity === 'containers' && !payload.fill_level) payload.fill_level = 0;

                await axios.post(`http://localhost:8000/api/${formEntity}/`, payload);
            } else {
                // SÉCURITÉ : on vérifie les noms des ID (Django utilise parfois id au lieu de container_id)
                const id = formEntity === 'containers'
                    ? (formData.container_id || formData.id)
                    : (formData.truck_id || formData.id || formData.license_plate);

                await axios.patch(`http://localhost:8000/api/${formEntity}/${id}/`, formData);
            }

            setIsModalOpen(false);
            if (formEntity === 'containers') fetchContainers();
            else fetchTrucks();

        } catch (error: any) {
            console.error("Erreur complète :", error);
            alert("Erreur Django : " + JSON.stringify(error.response?.data || error.message));
        }
    };

    const handleDelete = async (entity: 'containers' | 'trucks', id: string) => {
        if (!window.confirm("Es-tu sûr de vouloir supprimer cet élément ?")) return;
        try {
            await axios.delete(`http://localhost:8000/api/${entity}/${id}/`);
            if (entity === 'containers') fetchContainers();
            else fetchTrucks();
        } catch (error) {
            console.error("Erreur lors de la suppression :", error);
        }
    };

    const fetchContainers = async () => {
        try {
            const response = await axios.get('http://localhost:8000/api/containers/');
            setContainers(response.data);
        } catch (error) {
            console.error("Erreur de récupération des données:", error);
        }
    };

    const calculateOptimization = async () => {
        setIsLoading(true);
        try {
            const response = await axios.post('http://localhost:8000/api/routing/calculate/', {});
            const points = response.data.ordered_points;

            if (points && points.length > 1) {
                const waypoints = points.map((p: any) => `${p.longitude},${p.latitude}`).join(';');
                const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;

                const routeResponse = await axios.get(directionsUrl);
                const routeGeoJSON = routeResponse.data.routes[0].geometry;

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

    const fetchTrucks = async () => {
        try {
            const response = await axios.get('http://localhost:8000/api/trucks/');
            setTrucks(response.data);
        } catch (error) {
            console.error("Erreur de récupération des camions:", error);
        }
    };



    useEffect(() => {
        fetchContainers();
        fetchTrucks();
        const intervalId = setInterval(() => {
            fetchTrucks();
            fetchContainers();
        }, 2000);
        return () => clearInterval(intervalId);
    }, []);

    const getMarkerColor = (status: string) => {
        if (status === 'FULL') return '#ef4444';
        if (status === 'PARTIAL') return '#f97316';
        return '#22c55e';
    };

    // Vérifie s'il y a au moins un conteneur en statut critique
    const hasCriticalContainers = containers.some(c => c.alert_status === 'FULL');

    return (
        <div className="w-full h-screen flex flex-col bg-slate-950 font-sans overflow-hidden">
            <header className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 flex justify-between items-center z-50 shadow-md w-full gap-2">

                {/* Zone Gauche : Branding & Logo (Ajustée et fixée) */}
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center shadow-sm text-emerald-400">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                        </svg>
                    </div>
                    <div className="flex flex-col justify-center">
                        <h1 className="text-xl font-black text-white leading-none tracking-tight whitespace-nowrap">Smart Waste System</h1>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">PFA MVP</p>
                    </div>
                </div>

                {/* Centre : Navigation principale (Uniquement pour l'ADMIN) */}
                <div className="hidden lg:flex bg-slate-900/50 rounded-lg p-1 border border-slate-800 gap-1 mx-auto flex-shrink">
                    {user?.role === 'ADMIN' ? (
                        <>
                            <button onClick={() => setActiveTab('map')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'map' ? 'bg-emerald-900/40 text-emerald-400 shadow-inner' : 'text-slate-400 hover:text-slate-200'}`}>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                Carte & Alertes
                            </button>
                            <button onClick={() => setActiveTab('dispatch')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'dispatch' ? 'bg-emerald-900/40 text-emerald-400 shadow-inner' : 'text-slate-400 hover:text-slate-200'}`}>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                Dispatch & Flotte
                            </button>
                            {/* LE NOUVEL ONGLET CRUD LOGISTIQUE */}
                            <button onClick={() => setActiveTab('overview')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-emerald-900/40 text-emerald-400 shadow-inner' : 'text-slate-400 hover:text-slate-200'}`}>
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                État du Réseau
                            </button>
                        </>
                    ) : (
                        // Bouton raccourci pour le SuperAdmin
                        <button onClick={() => window.open('http://127.0.0.1:8000/admin/', '_blank')} className="px-4 py-2 rounded-md text-sm font-bold text-slate-300 hover:text-white bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 transition-all flex items-center gap-2">
                            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            Administration Système
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1 opacity-50"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                        </button>
                    )}
                </div>

                {/* Zone Droite : Boutons d'Action (Optimiser caché pour le SuperAdmin) */}
                <div className="flex justify-end items-center gap-2 md:gap-4 flex-shrink-0">
                    {user?.role === 'ADMIN' && activeTab === 'map' && (
                        <button
                            onClick={calculateOptimization}
                            disabled={isLoading || !hasCriticalContainers}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${isLoading || !hasCriticalContainers ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'}`}
                        >
                            {isLoading ? 'Calcul...' : 'Optimiser VRP'}
                        </button>
                    )}

                    <button onClick={fetchContainers} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5">
                        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        Sync
                    </button>

                    {/* Profil Utilisateur */}
                    {user && (
                        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-800">
                            <div className="text-right flex flex-col justify-center hidden sm:flex max-w-[120px]">
                                <p className="text-sm font-bold text-white leading-tight truncate">
                                    {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : (user.email ? user.email.split('@')[0] : 'Administrateur')}
                                </p>
                                <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${user.role === 'SUPER_ADMIN' ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                    {user.role ? user.role.replace('_', ' ') : 'UTILISATEUR'}
                                </p>
                            </div>
                            <button onClick={onLogout} className="text-slate-500 hover:text-red-400 bg-slate-900 hover:bg-red-500/10 p-2.5 rounded-lg border border-slate-800 hover:border-red-500/30 transition-all flex items-center justify-center ml-1" title="Se déconnecter">
                                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-grow relative overflow-hidden">
                {/* L'interface Dispatch (Visible uniquement si l'onglet est actif) */}
                {activeTab === 'dispatch' && user?.role === 'ADMIN' && (
                    <div className="absolute inset-0 z-40 bg-slate-950 p-6 overflow-y-auto pt-24">
                        <h2 className="text-2xl font-black text-white mb-6">Centre de Commandement Logistique</h2>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Colonne Gauche : Les Tournées */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                                <h3 className="text-emerald-400 font-bold mb-4 flex items-center gap-2">
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                                    Tournées VRP Calculées (En attente)
                                </h3>
                                {routeData ? (
                                    <div className="bg-slate-950 border border-emerald-500/30 p-4 rounded-xl">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-white font-bold">Route Alpha-1</span>
                                            <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-xs font-bold">Non Assignée</span>
                                        </div>
                                        <p className="text-slate-400 text-sm">Points de collecte : {hasCriticalContainers ? "Urgent" : "Standard"}</p>
                                    </div>
                                ) : (
                                    <div className="text-slate-500 text-sm text-center py-8 border border-dashed border-slate-700 rounded-xl">
                                        Aucune tournée calculée. Allez sur la carte et lancez l'optimisation.
                                    </div>
                                )}
                            </div>

                            {/* Colonne Droite : L'Assignation (Le cœur du métier) */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                                <h3 className="text-white font-bold mb-4">Affectation de la Mission</h3>
                                <form className="space-y-4" onSubmit={(e) => {
                                    e.preventDefault();
                                    alert("Mission affectée avec succès au chauffeur !");
                                    // ON NE MET PLUS clearRoute() ICI ! La ligne restera sur la carte.
                                    setActiveTab('map');
                                }}>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">1. Sélectionner un Chauffeur</label>
                                        <select className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-3 focus:border-emerald-500 outline-none" required disabled={!routeData}>
                                            <option value="">-- Choisir un chauffeur disponible --</option>
                                            {drivers.map(d => {
                                                const driverName = (d.first_name && d.last_name) ? `${d.first_name} ${d.last_name}` : d.email.split('@')[0];
                                                return <option key={d.user_id || d.id} value={d.user_id || d.id}>{driverName} (Disponible)</option>
                                            })}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">2. Assigner un Camion</label>
                                        <select className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-3 focus:border-emerald-500 outline-none" required disabled={!routeData}>
                                            <option value="">-- Choisir un véhicule opérationnel --</option>
                                            {trucks.map(t => <option key={t.id} value={t.id}>Camion {t.license_plate} - Capacité {t.capacity}%</option>)}
                                        </select>
                                    </div>
                                    <button type="submit" disabled={!routeData} className={`w-full py-3 mt-4 rounded-xl font-bold text-sm transition-all ${!routeData ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50'}`}>
                                        Confirmer et Déployer sur le Terrain
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* L'interface "État du Réseau" (Overview Logistique) */}
                {activeTab === 'overview' && user?.role === 'ADMIN' && (
                    <div className="absolute inset-0 z-40 bg-slate-950 p-6 overflow-y-auto pt-24">
                        <h2 className="text-2xl font-black text-white mb-6">État Global du Réseau</h2>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Bloc Chauffeurs */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> Effectif</h3>
                                <div className="space-y-3">
                                    {drivers.map(d => {
                                        const driverName = (d.first_name && d.last_name) ? `${d.first_name} ${d.last_name}` : d.email.split('@')[0];
                                        return (
                                            <div key={d.user_id || d.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                                                <span className="text-sm font-semibold text-slate-300">{driverName}</span>
                                                <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold">Actif</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Bloc Camions */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg> Flotte Véhicules</h3>
                                <div className="space-y-3">
                                    {trucks.map(t => (
                                        <div key={t.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <span className="text-sm font-semibold text-slate-300">{t.license_plate}</span>
                                            <span className="bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded text-xs font-bold">Disponible</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Bloc Conteneurs */}
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2"><svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Liste des Poubelles</h3>
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {containers.map(c => (
                                        <div key={c.container_id || c.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <span className="text-sm font-semibold text-slate-300">{c.name || `Bac #${String(c.container_id || c.id).substring(0, 4)}`}</span>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${c.alert_status === 'FULL' ? 'bg-red-500/20 text-red-400' : c.alert_status === 'PARTIAL' ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                {c.fill_level}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'map' ? (
                    <>
                        <Map {...viewState} onMove={evt => setViewState(evt.viewState)} mapStyle="mapbox://styles/mapbox/dark-v11" mapboxAccessToken={MAPBOX_TOKEN} style={{ width: '100%', height: '100%' }}>
                            <NavigationControl position="top-right" />

                            {routeData && (
                                <Source id="route-source" type="geojson" data={routeData}>
                                    <Layer id="route-layer" type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#0ea5e9', 'line-width': 6, 'line-opacity': 0.8, 'line-blur': 1 }} />
                                </Source>
                            )}

                            {containers.map((container) => {
                                // SÉCURITÉ ANTI-CRASH : On convertit en nombre et on met 0 par défaut
                                const lat = parseFloat(container.latitude);
                                const lng = parseFloat(container.longitude);
                                const fill = Number(container.fill_level) || 0;
                                const cId = container.container_id || container.id || Math.random();

                                // Mapbox plante si les coordonnées sont invalides, on ignore les mauvais points
                                if (isNaN(lat) || isNaN(lng)) return null;

                                return (
                                    <Marker key={cId} longitude={lng} latitude={lat} anchor="bottom">
                                        <div onClick={(e) => { e.stopPropagation(); setSelectedContainer(container); }} className="relative group cursor-pointer flex flex-col items-center">
                                            {container.alert_status === 'FULL' && (
                                                <div className="absolute top-2 w-12 h-12 bg-red-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                                            )}
                                            <div className="relative z-10 bg-slate-900 p-2 rounded-xl border border-slate-700 shadow-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 group-hover:border-slate-500">
                                                <svg width="28" height="32" viewBox="0 0 24 24" className="text-slate-400">
                                                    <path d="M4 7H20M5 7L6 21C6 21.5523 6.44772 22 7 22H17C17.5523 22 18 21.5523 18 21L19 7M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                                    <rect x="6" y={22 - (15 * (fill / 100))} width="12" height={15 * (fill / 100)} fill={getMarkerColor(container.alert_status)} className="transition-all duration-1000 ease-in-out" rx="1" />
                                                </svg>
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-600 shadow-lg">
                                                    {fill}%
                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-b border-r border-slate-600"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </Marker>
                                );
                            })}

                            {trucks.map((truck) => {
                                const lat = parseFloat(truck.latitude);
                                const lng = parseFloat(truck.longitude);
                                if (isNaN(lat) || isNaN(lng)) return null;

                                return (
                                    <Marker key={truck.truck_id || truck.id || truck.license_plate} longitude={lng} latitude={lat} anchor="center" style={{ transition: 'transform 2s linear' }}>
                                        <div className="bg-emerald-500 p-2 rounded-xl border-2 border-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.5)] z-50">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                                <path d="M20 8h-3V4H3v13h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM8 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-2-5H4V6h11v7h3.5l2.5 3.3V13z" />
                                            </svg>
                                        </div>
                                    </Marker>
                                );
                            })}

                            {selectedContainer && (
                                <Popup longitude={parseFloat(selectedContainer.longitude)} latitude={parseFloat(selectedContainer.latitude)} anchor="bottom" offset={45} onClose={() => setSelectedContainer(null)} closeButton={false} className="z-40">
                                    <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl min-w-[220px]">
                                        <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                                            <h3 className="font-bold text-emerald-400">Bac #{selectedContainer.name || String(selectedContainer.container_id || selectedContainer.id).substring(0, 4)}</h3>
                                            <button onClick={() => setSelectedContainer(null)} className="text-slate-500 hover:text-white">✕</button>
                                        </div>
                                        <div className="text-xs text-slate-300 space-y-2 mt-3">
                                            <div className="flex justify-between">
                                                <span>Remplissage:</span>
                                                <span className={`font-bold ${(Number(selectedContainer.fill_level) || 0) >= 80 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {Number(selectedContainer.fill_level) || 0}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Statut:</span>
                                                <span className="font-bold text-white">{selectedContainer.alert_status || 'EMPTY'}</span>
                                            </div>
                                            <button className="mt-4 w-full bg-slate-800 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-500 text-white font-bold py-2 rounded-lg transition-colors">
                                                Forcer la Collecte
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            )}
                        </Map>

                        <div className="absolute bottom-6 left-6 bg-slate-900/90 backdrop-blur text-white p-4 rounded-xl border border-slate-700 shadow-2xl text-xs space-y-2">
                            <p className="font-bold border-b border-slate-700 pb-2 mb-2">Statut des Points</p>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div> <span>Plein (Prioritaire)</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500"></div> <span>Partiel</span></div>
                            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div> <span>Vide / Opérationnel</span></div>
                        </div>
                    </>
                ) : (
                    <div className="p-8 h-full bg-slate-950 overflow-auto">
                        <div className="max-w-6xl mx-auto">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-white">Gestion des Données</h2>
                                    <p className="text-slate-400 text-sm mt-1">Gérez votre parc de conteneurs et votre flotte de camions.</p>
                                </div>
                                <button onClick={() => openModal('add', crudTab)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-900/40 flex items-center gap-2">
                                    <span>+</span> Ajouter un {crudTab === 'containers' ? 'Conteneur' : 'Camion'}
                                </button>
                            </div>

                            <div className="flex gap-6 mb-6 border-b border-slate-800">
                                <button
                                    onClick={() => setCrudTab('containers')}
                                    className={`pb-3 text-sm font-bold transition-colors flex items-center gap-2 ${crudTab === 'containers' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    Liste des Conteneurs
                                </button>
                                <button
                                    onClick={() => setCrudTab('trucks')}
                                    className={`pb-3 text-sm font-bold transition-colors flex items-center gap-2 ${crudTab === 'trucks' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                                    Flotte de Camions
                                </button>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-widest">
                                            <th className="p-4 font-semibold">ID / Référence</th>
                                            <th className="p-4 font-semibold">Localisation (Lat, Lng)</th>
                                            <th className="p-4 font-semibold">Statut / Niveau</th>
                                            <th className="p-4 font-semibold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {crudTab === 'containers' && containers.map((c) => {
                                            const cId = c.container_id || c.id;
                                            return (
                                                <tr key={cId} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-4 text-white font-medium">{c.name || String(cId).substring(0, 8)}</td>
                                                    {/* SÉCURITÉ : Arrondi à 4 chiffres après la virgule sans crasher si vide */}
                                                    <td className="p-4 text-slate-400 text-sm font-mono">
                                                        {(parseFloat(c.latitude) || 0).toFixed(4)}, {(parseFloat(c.longitude) || 0).toFixed(4)}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${c.alert_status === 'FULL' ? 'bg-red-500/10 text-red-400 border-red-500/20' : c.alert_status === 'PARTIAL' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                                                {c.alert_status || 'EMPTY'}
                                                            </span>
                                                            <span className="text-slate-300 text-sm font-bold">{Number(c.fill_level) || 0}%</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right space-x-3">
                                                        <button onClick={() => openModal('edit', 'containers', c)} className="text-sky-400 hover:text-sky-300 text-sm font-semibold transition-colors">Éditer</button>
                                                        <button onClick={() => handleDelete('containers', cId)} className="text-red-400 hover:text-red-300 text-sm font-semibold transition-colors">Supprimer</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {crudTab === 'trucks' && trucks.map((t) => {
                                            const tId = t.truck_id || t.id || t.license_plate;
                                            return (
                                                <tr key={tId} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className="p-4 text-white font-medium">{t.license_plate}</td>
                                                    <td className="p-4 text-slate-400 text-sm font-mono">
                                                        {(parseFloat(t.latitude) || 0).toFixed(4)}, {(parseFloat(t.longitude) || 0).toFixed(4)}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${t.status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                                            {t.status || 'AVAILABLE'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right space-x-3">
                                                        <button onClick={() => openModal('edit', 'trucks', t)} className="text-sky-400 hover:text-sky-300 text-sm font-semibold transition-colors">Éditer</button>
                                                        <button onClick={() => handleDelete('trucks', tId)} className="text-red-400 hover:text-red-300 text-sm font-semibold transition-colors">Supprimer</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {((crudTab === 'containers' && containers.length === 0) || (crudTab === 'trucks' && trucks.length === 0)) && (
                                    <div className="p-10 text-center text-slate-500">Aucune donnée trouvée.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100]">
                        <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-md">
                            <h3 className="text-xl font-bold text-white mb-6">
                                {modalMode === 'add' ? 'Ajouter un nouveau ' : 'Modifier le '}
                                <span className="text-emerald-400">{formEntity === 'containers' ? 'Conteneur' : 'Camion'}</span>
                            </h3>

                            <form onSubmit={handleSave} className="space-y-4 text-sm">
                                {formEntity === 'containers' ? (
                                    <>
                                        <div>
                                            <label className="block text-slate-400 mb-1">Nom / Référence</label>
                                            <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none" required />
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="w-1/2">
                                                <label className="block text-slate-400 mb-1">Latitude</label>
                                                <input type="number" step="any" value={formData.latitude || ''} onChange={(e) => setFormData({ ...formData, latitude: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none" required />
                                            </div>
                                            <div className="w-1/2">
                                                <label className="block text-slate-400 mb-1">Longitude</label>
                                                <input type="number" step="any" value={formData.longitude || ''} onChange={(e) => setFormData({ ...formData, longitude: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none" required />
                                            </div>
                                        </div>
                                        {modalMode === 'edit' && (
                                            <div>
                                                <label className="block text-slate-400 mb-1">Niveau de remplissage (%)</label>
                                                <input type="number" min="0" max="100" value={formData.fill_level || 0} onChange={(e) => setFormData({ ...formData, fill_level: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none" />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-slate-400 mb-1">Plaque d'immatriculation</label>
                                            <input type="text" value={formData.license_plate || ''} onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none" required />
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 mb-1">Capacité</label>
                                            <input type="number" value={formData.capacity || ''} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none" required />
                                        </div>
                                        <div>
                                            <label className="block text-slate-400 mb-1">Statut</label>
                                            <select value={formData.status || 'AVAILABLE'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none">
                                                <option value="AVAILABLE">Disponible</option>
                                                <option value="ON_MISSION">En Mission</option>
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="flex justify-end gap-3 mt-8">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white font-semibold transition-colors">Annuler</button>
                                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg">
                                        {modalMode === 'add' ? 'Créer' : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}