import { useState, useEffect } from 'react';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import axios from 'axios';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

const GARAGE_LOCATION = {
    name: 'Garage Smart Waste',
    latitude: 33.5731,
    longitude: -7.5898,
};

export default function MapDashboard({ user, onLogout }: any) {
    const [activeTab, setActiveTab] = useState<'map' | 'crud' | 'dispatch' | 'overview'>('map');
    const [crudTab, setCrudTab] = useState<'containers' | 'trucks'>('containers');

    const [containers, setContainers] = useState<any[]>([]);
    const [trucks, setTrucks] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [routes, setRoutes] = useState<any[]>([]);
    const [collectionPoints, setCollectionPoints] = useState<any[]>([]);

    const [selectedContainer, setSelectedContainer] = useState<any>(null);
    const [routeDataList, setRouteDataList] = useState<any[]>([]);
    const [activeTruckPositions, setActiveTruckPositions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const [selectedTruckId, setSelectedTruckId] = useState('');
    const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>([]);

    const [viewState, setViewState] = useState({
        longitude: -7.5898,
        latitude: 33.5731,
        zoom: 12,
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [formEntity, setFormEntity] = useState<'containers' | 'trucks'>('containers');
    const [formData, setFormData] = useState<any>({});

    const isAdminOnly = user?.role === 'ADMIN';

    const openModal = (mode: 'add' | 'edit', entity: 'containers' | 'trucks', data: any = {}) => {
        setModalMode(mode);
        setFormEntity(entity);
        setFormData(data);
        setIsModalOpen(true);
    };

    const getRouteId = (route: any) => route?.route_id || route?.id;
    const getPointRouteId = (point: any) => point?.route?.route_id || point?.route;
    const getContainerId = (container: any) => String(container?.container_id || container?.id || '');
    const getTruckId = (truck: any) => String(truck?.truck_id || truck?.id || '');

    const getTruckFromRoute = (route: any, trucksList: any[]) => {
        if (route?.truck_detail) return route.truck_detail;
        if (route?.truck && typeof route.truck === 'object') return route.truck;

        return trucksList.find((truck: any) => {
            const truckId = truck.truck_id || truck.id;
            return truckId === route?.truck;
        });
    };

    const fetchContainers = async () => {
        try {
            const response = await axios.get('http://localhost:8001/api/containers/');
            setContainers(response.data);
            return response.data;
        } catch (error) {
            console.error('Erreur de récupération des conteneurs:', error);
            return [];
        }
    };

    const fetchTrucks = async () => {
        try {
            const response = await axios.get('http://localhost:8001/api/trucks/');
            setTrucks(response.data);
            return response.data;
        } catch (error) {
            console.error('Erreur de récupération des camions:', error);
            return [];
        }
    };

    const fetchRoutes = async () => {
        try {
            const response = await axios.get('http://localhost:8001/api/routes/');
            setRoutes(response.data);
            return response.data;
        } catch (error) {
            console.error('Erreur de récupération des tournées:', error);
            return [];
        }
    };

    const fetchCollectionPoints = async () => {
        try {
            const response = await axios.get('http://localhost:8001/api/collection-points/');
            setCollectionPoints(response.data);
            return response.data;
        } catch (error) {
            console.error('Erreur de récupération des points de collecte:', error);
            return [];
        }
    };

    const loadResources = async () => {
        try {
            const dRes = await axios
                .get('http://127.0.0.1:8001/api/users/?role=DRIVER')
                .catch(() => ({ data: [{ id: '1', email: 'driver1@smartwaste.ma' }] }));

            setDrivers(dRes.data);
            return dRes.data;
        } catch (error) {
            console.error('Erreur ressources:', error);
            return [];
        }
    };

    const getOriginForRemainingRoute = (
        activeRoute: any,
        remainingPoints: any[],
        allPoints: any[],
        trucksList: any[]
    ) => {
        const nextStop = remainingPoints[0];

        const completedBeforeNext = allPoints
            .filter((point: any) => point.container_detail)
            .filter((point: any) => point.is_emptied === true)
            .filter((point: any) => Number(point.stop_order) < Number(nextStop?.stop_order || 0))
            .sort((a: any, b: any) => Number(b.stop_order) - Number(a.stop_order));

        const lastCollectedPoint = completedBeforeNext[0];
        const lastCollectedContainer = lastCollectedPoint?.container_detail;

        if (lastCollectedContainer?.latitude && lastCollectedContainer?.longitude) {
            return {
                latitude: lastCollectedContainer.latitude,
                longitude: lastCollectedContainer.longitude,
                source: 'LAST_COLLECTED_STOP',
                label: `Stop ${lastCollectedPoint.stop_order} collecté`,
            };
        }

        const truck = getTruckFromRoute(activeRoute, trucksList);

        if (truck?.latitude && truck?.longitude) {
            return {
                latitude: truck.latitude,
                longitude: truck.longitude,
                source: 'TRUCK',
                label: truck.license_plate || 'Position camion',
            };
        }

        return {
            ...GARAGE_LOCATION,
            source: 'GARAGE',
            label: 'Garage',
        };
    };

    const buildMapboxRouteFeature = async (locations: any[]) => {
        const validLocations = locations.filter((location: any) => {
            return location?.latitude && location?.longitude && !isNaN(Number(location.latitude)) && !isNaN(Number(location.longitude));
        });

        if (validLocations.length < 2) return null;

        const waypoints = validLocations
            .map((location: any) => `${location.longitude},${location.latitude}`)
            .join(';');

        const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
        const routeResponse = await axios.get(directionsUrl);

        if (!routeResponse.data.routes || routeResponse.data.routes.length === 0) return null;

        return {
            type: 'Feature',
            properties: {},
            geometry: routeResponse.data.routes[0].geometry,
        };
    };

    const syncActiveRoutesOnAdminMap = async () => {
        try {
            const [routesResponse, pointsResponse, trucksResponse] = await Promise.all([
                axios.get('http://localhost:8001/api/routes/'),
                axios.get('http://localhost:8001/api/collection-points/'),
                axios.get('http://localhost:8001/api/trucks/'),
            ]);

            const routesList = routesResponse.data || [];
            const pointsList = pointsResponse.data || [];
            const trucksList = trucksResponse.data || [];

            setRoutes(routesList);
            setCollectionPoints(pointsList);
            setTrucks(trucksList);

            const activeRoutes = routesList
                .filter((route: any) => route.status === 'PLANNED' || route.status === 'IN_PROGRESS')
                .sort((a: any, b: any) => {
                    const dateA = new Date(a.created_at || a.started_at || 0).getTime();
                    const dateB = new Date(b.created_at || b.started_at || 0).getTime();
                    return dateB - dateA;
                });

            if (activeRoutes.length === 0) {
                setRouteDataList([]);
                setActiveTruckPositions([]);
                return;
            }

            const nextRouteDataList: any[] = [];
            const nextTruckPositions: any[] = [];

            for (const activeRoute of activeRoutes) {
                const activeRouteId = getRouteId(activeRoute);

                const routePoints = pointsList
                    .filter((point: any) => getPointRouteId(point) === activeRouteId)
                    .filter((point: any) => point.container_detail)
                    .sort((a: any, b: any) => Number(a.stop_order) - Number(b.stop_order));

                const remainingPoints = routePoints
                    .filter((point: any) => point.is_emptied === false)
                    .sort((a: any, b: any) => Number(a.stop_order) - Number(b.stop_order));

                if (remainingPoints.length === 0) continue;

                const origin = getOriginForRemainingRoute(activeRoute, remainingPoints, routePoints, trucksList);
                const truck = getTruckFromRoute(activeRoute, trucksList);

                const remainingLocations = remainingPoints.map((point: any) => ({
                    latitude: point.container_detail.latitude,
                    longitude: point.container_detail.longitude,
                }));

                const feature = await buildMapboxRouteFeature([origin, ...remainingLocations]);

                if (feature) {
                    nextRouteDataList.push({
                        routeId: activeRouteId,
                        truckId: truck?.truck_id || truck?.id || activeRoute.truck,
                        truckLabel: truck?.license_plate || 'Camion',
                        data: feature,
                    });

                    nextTruckPositions.push({
                        routeId: activeRouteId,
                        truckId: truck?.truck_id || truck?.id || activeRoute.truck,
                        truckLabel: truck?.license_plate || 'Camion actuel',
                        latitude: origin.latitude,
                        longitude: origin.longitude,
                        label: origin.label,
                    });
                }
            }

            setRouteDataList(nextRouteDataList);
            setActiveTruckPositions(nextTruckPositions);
        } catch (error) {
            console.error('Erreur synchronisation des tournées actives sur la carte admin:', error);
        }
    };

    const refreshAll = async () => {
        await Promise.all([
            fetchContainers(),
            fetchTrucks(),
            fetchRoutes(),
            loadResources(),
            fetchCollectionPoints(),
        ]);

        await syncActiveRoutesOnAdminMap();
    };

    useEffect(() => {
        refreshAll();

        const intervalId = setInterval(() => {
            fetchContainers();
            fetchTrucks();
            fetchRoutes();
            fetchCollectionPoints();
            syncActiveRoutesOnAdminMap();
        }, 2000);

        return () => clearInterval(intervalId);
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (modalMode === 'add') {
                const payload = { ...formData };

                if (formEntity === 'containers' && !payload.fill_level) {
                    payload.fill_level = 0;
                }

                if (formEntity === 'trucks') {
                    if (!payload.latitude) payload.latitude = GARAGE_LOCATION.latitude;
                    if (!payload.longitude) payload.longitude = GARAGE_LOCATION.longitude;
                    if (!payload.status) payload.status = 'AVAILABLE';
                    if (!payload.physical_status) payload.physical_status = 'OPERATIONAL';
                }

                await axios.post(`http://localhost:8001/api/${formEntity}/`, payload);
            } else {
                const id =
                    formEntity === 'containers'
                        ? formData.container_id || formData.id
                        : formData.truck_id || formData.id || formData.license_plate;

                await axios.patch(`http://localhost:8001/api/${formEntity}/${id}/`, formData);
            }

            setIsModalOpen(false);
            await refreshAll();
        } catch (error: any) {
            console.error('Erreur complète:', error);
            alert('Erreur Django : ' + JSON.stringify(error.response?.data || error.message));
        }
    };

    const handleDelete = async (entity: 'containers' | 'trucks', id: string) => {
        if (!window.confirm('Es-tu sûr de vouloir supprimer cet élément ?')) return;

        try {
            await axios.delete(`http://localhost:8001/api/${entity}/${id}/`);
            await refreshAll();
        } catch (error) {
            console.error('Erreur lors de la suppression:', error);
        }
    };

    const calculateOptimization = async () => {
        setIsLoading(true);

        try {
            const response = await axios.post('http://localhost:8001/api/routing/calculate/', {});
            console.log('Réponse backend VRP automatique:', response.data);

            await refreshAll();
            setActiveTab('map');
        } catch (error: any) {
            console.error("Erreur lors de l'optimisation:", error.response?.data || error.message);
            alert('Erreur de calcul. Vérifiez les camions disponibles, chauffeurs et conteneurs critiques.');
        } finally {
            setIsLoading(false);
        }
    };

    const createManualRoute = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedTruckId) {
            alert('Sélectionnez un camion.');
            return;
        }

        if (selectedContainerIds.length === 0) {
            alert('Sélectionnez au moins une poubelle critique.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post('http://localhost:8001/api/routing/calculate/', {
                truck_id: selectedTruckId,
                container_ids: selectedContainerIds,
            });

            console.log('Tournée manuelle créée:', response.data);

            setSelectedTruckId('');
            setSelectedContainerIds([]);
            await refreshAll();
            setActiveTab('map');
        } catch (error: any) {
            console.error('Erreur création tournée manuelle:', error.response?.data || error.message);
            alert('Erreur création tournée : ' + JSON.stringify(error.response?.data || error.message));
        } finally {
            setIsLoading(false);
        }
    };

    const toggleContainerSelection = (containerId: string) => {
        setSelectedContainerIds((previous) => {
            if (previous.includes(containerId)) {
                return previous.filter((id) => id !== containerId);
            }

            return [...previous, containerId];
        });
    };

    const getMarkerColor = (status: string) => {
        if (status === 'FULL') return '#ef4444';
        if (status === 'PARTIAL') return '#f97316';
        return '#22c55e';
    };

    const hasCriticalContainers = containers.some(c => c.alert_status === 'FULL');

    const activeAssignedContainerIds = collectionPoints
        .filter((point: any) => point.is_emptied === false)
        .map((point: any) => String(point.container || point.container_detail?.container_id || point.container_detail?.id));

    const selectableContainers = containers.filter((container: any) => {
        const containerId = getContainerId(container);
        return (
            container.alert_status === 'FULL' &&
            container.physical_status !== 'MAINTENANCE' &&
            container.physical_status !== 'BROKEN' &&
            !activeAssignedContainerIds.includes(containerId)
        );
    });

    const availableTrucks = trucks.filter((truck: any) => {
        return (
            truck.status === 'AVAILABLE' &&
            truck.physical_status !== 'MAINTENANCE' &&
            truck.physical_status !== 'BROKEN' &&
            truck.latitude !== null &&
            truck.longitude !== null
        );
    });

    const activeRoutes = routes.filter((route: any) => route.status === 'PLANNED' || route.status === 'IN_PROGRESS');
const getVisualTruckPosition = (latitude: any, longitude: any, index: number) => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
        return null;
    }

    const isAtGarage =
        Math.abs(lat - GARAGE_LOCATION.latitude) < 0.00001 &&
        Math.abs(lng - GARAGE_LOCATION.longitude) < 0.00001;

    if (!isAtGarage) {
        return {
            latitude: lat,
            longitude: lng,
        };
    }

    /*
        Décalage uniquement visuel :
        - En base de données, tous les camions restent au garage.
        - Sur la carte, on les décale légèrement pour éviter la superposition.
    */
    const offsets = [
        { latitude: 0.00025, longitude: 0.00025 },
        { latitude: -0.00025, longitude: 0.00025 },
        { latitude: 0.00025, longitude: -0.00025 },
        { latitude: -0.00025, longitude: -0.00025 },
        { latitude: 0.00040, longitude: 0 },
        { latitude: -0.00040, longitude: 0 },
    ];

    const offset = offsets[index % offsets.length];

    return {
        latitude: lat + offset.latitude,
        longitude: lng + offset.longitude,
    };
};
    return (
        <div className="w-full h-screen flex flex-col bg-slate-950 font-sans overflow-hidden">
            <header className="bg-slate-900 border-b border-slate-800 px-4 md:px-6 py-3 flex justify-between items-center z-50 shadow-md w-full gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-center shadow-sm text-emerald-400">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
                        </svg>
                    </div>

                    <div className="flex flex-col justify-center">
                        <h1 className="text-xl font-black text-white leading-none tracking-tight whitespace-nowrap">
                            Smart Waste System
                        </h1>
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">
                            PFA MVP
                        </p>
                    </div>
                </div>

                <div className="hidden lg:flex bg-slate-900/50 rounded-lg p-1 border border-slate-800 gap-1 mx-auto flex-shrink">
                    {user?.role === 'ADMIN' ? (
                        <>
                            <button
                                onClick={() => setActiveTab('map')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'map'
                                        ? 'bg-emerald-900/40 text-emerald-400 shadow-inner'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Carte & Alertes
                            </button>

                            <button
                                onClick={() => setActiveTab('crud')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'crud'
                                        ? 'bg-emerald-900/40 text-emerald-400 shadow-inner'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                 CRUD
                            </button>

                            <button
                                onClick={() => setActiveTab('dispatch')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'dispatch'
                                        ? 'bg-emerald-900/40 text-emerald-400 shadow-inner'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                Dispatch & Flotte
                            </button>

                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'overview'
                                        ? 'bg-emerald-900/40 text-emerald-400 shadow-inner'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                            >
                                État du Réseau
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => window.open('http://127.0.0.1:8001/admin/', '_blank')}
                            className="px-4 py-2 rounded-md text-sm font-bold text-slate-300 hover:text-white bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 transition-all"
                        >
                            Administration Système
                        </button>
                    )}
                </div>

                <div className="flex justify-end items-center gap-2 md:gap-4 flex-shrink-0">
                    {isAdminOnly && activeTab === 'map' && (
                        <button
                            onClick={calculateOptimization}
                            disabled={isLoading || !hasCriticalContainers}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${isLoading || !hasCriticalContainers
                                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
                                }`}
                        >
                            {isLoading ? 'Calcul...' : 'Optimiser Auto'}
                        </button>
                    )}

                    <button
                        onClick={refreshAll}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                        Sync
                    </button>

                    {user && (
                        <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-800">
                            <div className="text-right flex flex-col justify-center hidden sm:flex max-w-[120px]">
                                <p className="text-sm font-bold text-white leading-tight truncate">
                                    {user.first_name || user.last_name
                                        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                                        : user.email
                                            ? user.email.split('@')[0]
                                            : 'Administrateur'}
                                </p>

                                <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${user.role === 'SUPER_ADMIN' ? 'text-indigo-400' : 'text-emerald-400'
                                    }`}>
                                    {user.role ? user.role.replace('_', ' ') : 'UTILISATEUR'}
                                </p>
                            </div>

                            <button
                                onClick={onLogout}
                                className="text-slate-500 hover:text-red-400 bg-slate-900 hover:bg-red-500/10 p-2.5 rounded-lg border border-slate-800 hover:border-red-500/30 transition-all"
                                title="Se déconnecter"
                            >
                                ↪
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="flex-grow relative overflow-hidden">
                {activeTab === 'dispatch' && user?.role === 'ADMIN' && (
                    <div className="absolute inset-0 z-40 bg-slate-950 p-6 overflow-y-auto pt-24">
                        <h2 className="text-2xl font-black text-white mb-6">
                            Centre de Commandement Logistique
                        </h2>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl xl:col-span-2">
                                <h3 className="text-emerald-400 font-bold mb-4">
                                    Créer une tournée par camion
                                </h3>

                                <form className="space-y-5" onSubmit={createManualRoute}>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                                            1. Choisir un camion disponible
                                        </label>

                                        <select
                                            value={selectedTruckId}
                                            onChange={(e) => setSelectedTruckId(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-3 focus:border-emerald-500 outline-none"
                                            required
                                        >
                                            <option value="">-- Sélectionner un camion --</option>
                                            {availableTrucks.map((truck: any) => (
                                                <option key={getTruckId(truck)} value={getTruckId(truck)}>
                                                    {truck.license_plate} - {truck.driver ? 'Chauffeur assigné' : 'Sans chauffeur'} - {truck.status}
                                                </option>
                                            ))}
                                        </select>

                                        {availableTrucks.length === 0 && (
                                            <p className="text-xs text-orange-400 mt-2">
                                                Aucun camion disponible. Vérifiez que le camion est AVAILABLE, localisé et avec chauffeur.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                                            2. Sélectionner les poubelles à collecter
                                        </label>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-2">
                                            {selectableContainers.map((container: any) => {
                                                const containerId = getContainerId(container);
                                                const checked = selectedContainerIds.includes(containerId);

                                                return (
                                                    <label
                                                        key={containerId}
                                                        className={`cursor-pointer bg-slate-950 border rounded-xl p-4 transition-all ${
                                                            checked
                                                                ? 'border-emerald-500 bg-emerald-500/10'
                                                                : 'border-slate-800 hover:border-slate-600'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleContainerSelection(containerId)}
                                                                className="mt-1 accent-emerald-500"
                                                            />

                                                            <div className="flex-1">
                                                                <p className="text-white font-bold text-sm">
                                                                    {container.name || `Bac #${containerId.substring(0, 6)}`}
                                                                </p>
                                                                <p className="text-slate-400 text-xs mt-1">
                                                                    {Number(container.fill_level) || 0}% · {container.alert_status}
                                                                </p>
                                                                <p className="text-slate-500 text-[11px] font-mono mt-1">
                                                                    {(parseFloat(container.latitude) || 0).toFixed(4)}, {(parseFloat(container.longitude) || 0).toFixed(4)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {selectableContainers.length === 0 && (
                                            <div className="text-slate-500 text-sm text-center py-8 border border-dashed border-slate-700 rounded-xl">
                                                Aucune poubelle FULL disponible pour une nouvelle tournée.
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isLoading || !selectedTruckId || selectedContainerIds.length === 0}
                                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                                            isLoading || !selectedTruckId || selectedContainerIds.length === 0
                                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50'
                                        }`}
                                    >
                                        {isLoading ? 'Création...' : `Créer tournée optimisée (${selectedContainerIds.length} stops)`}
                                    </button>
                                </form>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                                <h3 className="text-white font-bold mb-4">Tournées actives</h3>

                                <div className="space-y-3">
                                    {activeRoutes.length === 0 ? (
                                        <div className="text-slate-500 text-sm text-center py-8 border border-dashed border-slate-700 rounded-xl">
                                            Aucune tournée active.
                                        </div>
                                    ) : (
                                        activeRoutes.map((route: any) => {
                                            const routeId = getRouteId(route);
                                            const truck = getTruckFromRoute(route, trucks);
                                            const pointsForRoute = collectionPoints.filter((point: any) => getPointRouteId(point) === routeId);
                                            const remaining = pointsForRoute.filter((point: any) => !point.is_emptied).length;

                                            return (
                                                <div key={routeId} className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <div>
                                                            <p className="text-white font-bold text-sm">
                                                                {truck?.license_plate || 'Camion'}
                                                            </p>
                                                            <p className="text-slate-400 text-xs mt-1">
                                                                Route #{String(routeId).substring(0, 8)}
                                                            </p>
                                                        </div>
                                                        <span className="bg-sky-500/20 text-sky-400 px-2 py-1 rounded text-xs font-bold">
                                                            {route.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-300 text-xs mt-3">
                                                        Stops restants : <span className="font-bold text-emerald-400">{remaining}</span>
                                                    </p>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'overview' && user?.role === 'ADMIN' && (
                    <div className="absolute inset-0 z-40 bg-slate-950 p-6 overflow-y-auto pt-24">
                        <h2 className="text-2xl font-black text-white mb-6">
                            État Global du Réseau
                        </h2>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                                <h3 className="text-white font-bold mb-4">Effectif</h3>
                                <div className="space-y-3">
                                    {drivers.map(d => (
                                        <div key={d.user_id || d.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <span className="text-sm font-semibold text-slate-300">
                                                {d.email || 'Chauffeur'}
                                            </span>
                                            <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold">
                                                Actif
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                                <h3 className="text-white font-bold mb-4">Flotte Véhicules</h3>
                                <div className="space-y-3">
                                    {trucks.map(t => (
                                        <div key={t.truck_id || t.id || t.license_plate} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <span className="text-sm font-semibold text-slate-300">
                                                {t.license_plate}
                                            </span>
                                            <span className="bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded text-xs font-bold">
                                                {t.status || 'AVAILABLE'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                                <h3 className="text-white font-bold mb-4">Liste des Poubelles</h3>
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {containers.map(c => (
                                        <div key={c.container_id || c.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <span className="text-sm font-semibold text-slate-300">
                                                {c.name || `Bac #${String(c.container_id || c.id).substring(0, 4)}`}
                                            </span>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${c.alert_status === 'FULL'
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : c.alert_status === 'PARTIAL'
                                                        ? 'bg-orange-500/20 text-orange-400'
                                                        : 'bg-emerald-500/20 text-emerald-400'
                                                }`}>
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
                    <Map
                        {...viewState}
                        onMove={evt => setViewState(evt.viewState)}
                        mapStyle="mapbox://styles/mapbox/dark-v11"
                        mapboxAccessToken={MAPBOX_TOKEN}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <NavigationControl position="top-right" />

                        <Marker
                            longitude={GARAGE_LOCATION.longitude}
                            latitude={GARAGE_LOCATION.latitude}
                            anchor="bottom"
                        >
                            <div className="relative flex flex-col items-center">
                                <div className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[10px] font-black shadow-lg border border-indigo-300 mb-1">
                                    GARAGE
                                </div>

                                <div className="w-10 h-10 bg-indigo-500 border-2 border-white rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.6)]">
                                    🏢
                                </div>
                            </div>
                        </Marker>

                        {routeDataList.map((routeItem: any, index: number) => (
                            <Source key={`route-source-${routeItem.routeId}`} id={`route-source-${routeItem.routeId}`} type="geojson" data={routeItem.data}>
                                <Layer
                                    id={`route-layer-${routeItem.routeId}`}
                                    type="line"
                                    layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                                    paint={{
                                        'line-color': index % 2 === 0 ? '#0ea5e9' : '#22c55e',
                                        'line-width': 6,
                                        'line-opacity': 0.8,
                                        'line-blur': 1,
                                    }}
                                />
                            </Source>
                        ))}

                        {containers.map(container => {
                            const lat = parseFloat(container.latitude);
                            const lng = parseFloat(container.longitude);
                            const fill = Number(container.fill_level) || 0;
                            const cId = container.container_id || container.id || Math.random();

                            if (isNaN(lat) || isNaN(lng)) return null;

                            return (
                                <Marker key={cId} longitude={lng} latitude={lat} anchor="bottom">
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedContainer(container);
                                        }}
                                        className="relative group cursor-pointer flex flex-col items-center"
                                    >
                                        {container.alert_status === 'FULL' && (
                                            <div className="absolute top-2 w-12 h-12 bg-red-500 rounded-full blur-xl opacity-50 animate-pulse"></div>
                                        )}

                                        <div className="relative z-10 bg-slate-900 p-2 rounded-xl border border-slate-700 shadow-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2 group-hover:border-slate-500">
                                            <svg width="28" height="32" viewBox="0 0 24 24" className="text-slate-400">
                                                <path
                                                    d="M4 7H20M5 7L6 21C6 21.5523 6.44772 22 7 22H17C17.5523 22 18 21.5523 18 21L19 7M9 7V4C9 3.44772 9.44772 3 10 3H14C14.5523 3 15 3.44772 15 4V7"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    fill="none"
                                                />
                                                <rect
                                                    x="6"
                                                    y={22 - (15 * (fill / 100))}
                                                    width="12"
                                                    height={15 * (fill / 100)}
                                                    fill={getMarkerColor(container.alert_status)}
                                                    rx="1"
                                                />
                                            </svg>
                                        </div>
                                    </div>
                                </Marker>
                            );
                        })}

                        {activeTruckPositions.map((position: any) => (
                            <Marker
                                key={`active-truck-${position.routeId}`}
                                longitude={parseFloat(position.longitude)}
                                latitude={parseFloat(position.latitude)}
                                anchor="center"
                            >
                                <div className="relative flex flex-col items-center">
                                    <div className="bg-emerald-600 text-white px-2 py-1 rounded-md text-[9px] font-black mb-1 border border-emerald-300">
                                        {position.truckLabel}
                                    </div>

                                    <div className="bg-emerald-500 p-2 rounded-xl border-2 border-white shadow-[0_0_18px_rgba(16,185,129,0.8)] z-50">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                            <path d="M20 8h-3V4H3v13h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM8 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-2-5H4V6h11v7h3.5l2.5 3.3V13z" />
                                        </svg>
                                    </div>
                                </div>
                            </Marker>
                        ))}
{trucks.map((truck, index) => {
    const truckId = String(truck.truck_id || truck.id || '');

    const isTruckAlreadyActive = activeTruckPositions.some((position: any) => {
        return String(position.truckId || '') === truckId;
    });

    if (isTruckAlreadyActive) return null;

    const visualPosition = getVisualTruckPosition(truck.latitude, truck.longitude, index);

    if (!visualPosition) return null;

    return (
        <Marker
            key={truck.truck_id || truck.id || truck.license_plate}
            longitude={visualPosition.longitude}
            latitude={visualPosition.latitude}
            anchor="center"
        >
            <div className="relative flex flex-col items-center">
                <div className="bg-slate-800 text-white px-2 py-1 rounded-md text-[9px] font-black mb-1 border border-slate-600">
                    {truck.license_plate}
                </div>

                <div className="bg-emerald-500 p-2 rounded-xl border-2 border-slate-900 shadow-[0_0_15px_rgba(16,185,129,0.5)] z-50">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                        <path d="M20 8h-3V4H3v13h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM8 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-2-5H4V6h11v7h3.5l2.5 3.3V13z" />
                    </svg>
                </div>
            </div>
        </Marker>
    );
})}

{selectedContainer && (
                            <Popup
                                longitude={parseFloat(selectedContainer.longitude)}
                                latitude={parseFloat(selectedContainer.latitude)}
                                anchor="bottom"
                                offset={45}
                                onClose={() => setSelectedContainer(null)}
                                closeButton={false}
                                className="z-40"
                            >
                                <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl min-w-[220px]">
                                    <div className="flex justify-between items-center mb-2 border-b border-slate-800 pb-2">
                                        <h3 className="font-bold text-emerald-400">
                                            Bac #{selectedContainer.name || String(selectedContainer.container_id || selectedContainer.id).substring(0, 4)}
                                        </h3>
                                        <button onClick={() => setSelectedContainer(null)} className="text-slate-500 hover:text-white">
                                            ✕
                                        </button>
                                    </div>

                                    <div className="text-xs text-slate-300 space-y-2 mt-3">
                                        <div className="flex justify-between">
                                            <span>Remplissage:</span>
                                            <span className={`font-bold ${(Number(selectedContainer.fill_level) || 0) >= 80
                                                    ? 'text-red-400'
                                                    : 'text-emerald-400'
                                                }`}>
                                                {Number(selectedContainer.fill_level) || 0}%
                                            </span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span>Statut:</span>
                                            <span className="font-bold text-white">
                                                {selectedContainer.alert_status || 'EMPTY'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        )}
                    </Map>
                ) : (
                    <div className="p-8 h-full bg-slate-950 overflow-auto">
                        <div className="max-w-6xl mx-auto">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-2xl font-black text-white">Gestion des Données</h2>
                                    <p className="text-slate-400 text-sm mt-1">
                                        Gérez votre parc de conteneurs et votre flotte de camions.
                                    </p>
                                </div>

                                <button
                                    onClick={() => openModal('add', crudTab)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-900/40"
                                >
                                    + Ajouter un {crudTab === 'containers' ? 'Conteneur' : 'Camion'}
                                </button>
                            </div>

                            <div className="flex gap-6 mb-6 border-b border-slate-800">
                                <button
                                    onClick={() => setCrudTab('containers')}
                                    className={`pb-3 text-sm font-bold transition-colors ${crudTab === 'containers'
                                            ? 'text-emerald-400 border-b-2 border-emerald-400'
                                            : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    Liste des Conteneurs
                                </button>

                                <button
                                    onClick={() => setCrudTab('trucks')}
                                    className={`pb-3 text-sm font-bold transition-colors ${crudTab === 'trucks'
                                            ? 'text-emerald-400 border-b-2 border-emerald-400'
                                            : 'text-slate-500 hover:text-slate-300'
                                        }`}
                                >
                                    Flotte de Camions
                                </button>
                            </div>

                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-widest">
                                            <th className="p-4 font-semibold">ID / Référence</th>
                                            <th className="p-4 font-semibold">Localisation</th>
                                            <th className="p-4 font-semibold">Statut / Niveau</th>
                                            <th className="p-4 font-semibold text-right">Actions</th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-800/50">
                                        {crudTab === 'containers' &&
                                            containers.map(c => {
                                                const cId = c.container_id || c.id;

                                                return (
                                                    <tr key={cId} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-4 text-white font-medium">
                                                            {c.name || String(cId).substring(0, 8)}
                                                        </td>
                                                        <td className="p-4 text-slate-400 text-sm font-mono">
                                                            {(parseFloat(c.latitude) || 0).toFixed(4)}, {(parseFloat(c.longitude) || 0).toFixed(4)}
                                                        </td>
                                                        <td className="p-4 text-slate-300">
                                                            {c.alert_status || 'EMPTY'} - {Number(c.fill_level) || 0}%
                                                        </td>
                                                        <td className="p-4 text-right space-x-3">
                                                            <button
                                                                onClick={() => openModal('edit', 'containers', c)}
                                                                className="text-sky-400 hover:text-sky-300 text-sm font-semibold"
                                                            >
                                                                Éditer
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete('containers', cId)}
                                                                className="text-red-400 hover:text-red-300 text-sm font-semibold"
                                                            >
                                                                Supprimer
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}

                                        {crudTab === 'trucks' &&
                                            trucks.map(t => {
                                                const tId = t.truck_id || t.id || t.license_plate;

                                                return (
                                                    <tr key={tId} className="hover:bg-slate-800/50 transition-colors">
                                                        <td className="p-4 text-white font-medium">
                                                            {t.license_plate}
                                                        </td>
                                                        <td className="p-4 text-slate-400 text-sm font-mono">
                                                            {(parseFloat(t.latitude) || 0).toFixed(4)}, {(parseFloat(t.longitude) || 0).toFixed(4)}
                                                        </td>
                                                        <td className="p-4 text-slate-300">
                                                            {t.status || 'AVAILABLE'}
                                                        </td>
                                                        <td className="p-4 text-right space-x-3">
                                                            <button
                                                                onClick={() => openModal('edit', 'trucks', t)}
                                                                className="text-sky-400 hover:text-sky-300 text-sm font-semibold"
                                                            >
                                                                Éditer
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete('trucks', tId)}
                                                                className="text-red-400 hover:text-red-300 text-sm font-semibold"
                                                            >
                                                                Supprimer
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {isModalOpen && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100]">
                        <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl w-full max-w-md">
                            <h3 className="text-xl font-bold text-white mb-6">
                                {modalMode === 'add' ? 'Ajouter un nouveau ' : 'Modifier le '}
                                <span className="text-emerald-400">
                                    {formEntity === 'containers' ? 'Conteneur' : 'Camion'}
                                </span>
                            </h3>

                            <form onSubmit={handleSave} className="space-y-4 text-sm">
                                {formEntity === 'containers' ? (
                                    <>
                                        <div>
                                            <label className="block text-slate-400 mb-1">Nom / Référence</label>
                                            <input
                                                type="text"
                                                value={formData.name || ''}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none"
                                                required
                                            />
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="w-1/2">
                                                <label className="block text-slate-400 mb-1">Latitude</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={formData.latitude || ''}
                                                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none"
                                                    required
                                                />
                                            </div>

                                            <div className="w-1/2">
                                                <label className="block text-slate-400 mb-1">Longitude</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={formData.longitude || ''}
                                                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {modalMode === 'edit' && (
                                            <div>
                                                <label className="block text-slate-400 mb-1">Niveau de remplissage (%)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={formData.fill_level || 0}
                                                    onChange={(e) => setFormData({ ...formData, fill_level: e.target.value })}
                                                    className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none"
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-slate-400 mb-1">Plaque d'immatriculation</label>
                                            <input
                                                type="text"
                                                value={formData.license_plate || ''}
                                                onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-slate-400 mb-1">Capacité</label>
                                            <input
                                                type="number"
                                                value={formData.capacity || ''}
                                                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none"
                                                required
                                            />
                                        </div>

                                        <div>
    <label className="block text-slate-400 mb-1">Chauffeur assigné</label>
    <select
        value={formData.driver || ''}
        onChange={(e) => setFormData({ ...formData, driver: e.target.value })}
        className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-4 py-2 focus:border-emerald-500 focus:outline-none"
    >
        <option value="">-- Choisir un chauffeur --</option>
        {drivers.map((driver: any) => (
            <option key={driver.user_id || driver.id} value={driver.user_id || driver.id}>
                {driver.first_name || driver.last_name
                    ? `${driver.first_name || ''} ${driver.last_name || ''}`.trim()
                    : driver.email}
            </option>
        ))}
    </select>
</div>
                                    </>
                                )}

                                <div className="flex justify-end gap-3 mt-8">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-lg text-slate-400 hover:text-white font-semibold transition-colors"
                                    >
                                        Annuler
                                    </button>

                                    <button
                                        type="submit"
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg"
                                    >
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
