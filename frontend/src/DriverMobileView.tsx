import { useState, useEffect } from 'react';
import axios from 'axios';

export default function DriverMobileView({ user, onLogout }: { user: any, onLogout: () => void }) {
    const [mission, setMission] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchMission = async () => {
        try {
            const response = await axios.get('http://127.0.0.1:8000/api/containers/');
            const urgentContainers = response.data.filter((c: any) => c.alert_status === 'FULL' || c.alert_status === 'PARTIAL');
            setMission(urgentContainers);
        } catch (error) {
            console.error("Erreur :", error);
        }
    };

    useEffect(() => { fetchMission(); }, []);

    const handleValidateCollection = async (containerId: string) => {
        setIsLoading(true);
        try {
            await axios.patch(`http://127.0.0.1:8000/api/containers/${containerId}/`, {
                fill_level: 0, alert_status: 'EMPTY'
            });
            setMission(mission.filter(c => (c.container_id || c.id) !== containerId));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // Arrière-plan avec un subtil dégradé radial
        <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 font-sans flex flex-col sm:max-w-md sm:mx-auto shadow-2xl relative overflow-hidden">
            
            {/* Header style "Glassmorphism" */}
            <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 p-5 pt-8">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <span className="font-bold text-white text-lg">{user.email?.charAt(0).toUpperCase()}</span>
                        </div>
                        <div>
                            <p className="text-emerald-400/80 text-[10px] font-black uppercase tracking-widest">Unité Mobile</p>
                            <h1 className="text-base font-bold text-white">{user.email?.split('@')[0]}</h1>
                        </div>
                    </div>
                    <button onClick={onLogout} className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-all border border-white/5">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    </button>
                </div>
                
                {/* Compteur d'objectifs design */}
                <div className="bg-black/40 rounded-2xl p-4 flex justify-between items-center border border-white/5 shadow-inner">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400">
                            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        </div>
                        <span className="text-sm font-medium text-slate-300">Points de collecte</span>
                    </div>
                    <span className="text-2xl font-black text-white">{mission.length}</span>
                </div>
            </header>

            <main className="flex-grow p-5 space-y-4 overflow-y-auto pb-8">
                <div className="flex justify-between items-end mb-6 mt-2">
                    <h2 className="text-slate-400 text-xs font-bold uppercase tracking-widest">Feuille de route</h2>
                    <button onClick={fetchMission} className="text-emerald-400 text-xs font-semibold hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-md">
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
                        Actualiser
                    </button>
                </div>

                {mission.length === 0 ? (
                    <div className="text-center p-8 bg-gradient-to-b from-slate-800/50 to-transparent border border-dashed border-slate-700 rounded-3xl mt-10">
                        <div className="text-5xl mb-4 opacity-80">☕</div>
                        <h3 className="text-lg font-bold text-white">Zone propre</h3>
                        <p className="text-sm text-slate-400 mt-2">Aucun point de collecte critique n'est assigné à votre véhicule.</p>
                    </div>
                ) : (
                    mission.map((container) => {
                        const cId = container.container_id || container.id;
                        const isFull = container.alert_status === 'FULL';
                        return (
                            <div key={cId} className="bg-slate-900 border border-white/5 rounded-2xl p-5 flex flex-col gap-5 shadow-lg relative overflow-hidden group">
                                {/* Effet de lumière interne (Glow) */}
                                <div className={`absolute -top-10 -right-10 w-32 h-32 blur-3xl opacity-20 rounded-full pointer-events-none ${isFull ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                                
                                <div className="flex justify-between items-start z-10">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-2 h-2 rounded-full ${isFull ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}></div>
                                            <h3 className="font-bold text-lg text-white">Bac #{container.name || String(cId).substring(0,4)}</h3>
                                        </div>
                                        <p className="text-slate-400 text-xs font-mono bg-black/30 w-fit px-2 py-1 rounded-md mt-2">
                                            {parseFloat(container.latitude).toFixed(5)}, {parseFloat(container.longitude).toFixed(5)}
                                        </p>
                                    </div>
                                    <div className={`px-3 py-1.5 rounded-xl text-sm font-black border backdrop-blur-md ${isFull ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                                        {Number(container.fill_level) || 0}%
                                    </div>
                                </div>

                                <button 
                                    onClick={() => handleValidateCollection(cId)}
                                    disabled={isLoading}
                                    className="w-full bg-slate-800/80 hover:bg-emerald-600 border border-slate-700 hover:border-emerald-500 text-slate-200 hover:text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-md flex justify-center items-center gap-2 active:scale-[0.98] z-10"
                                >
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    Valider l'intervention
                                </button>
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
}
