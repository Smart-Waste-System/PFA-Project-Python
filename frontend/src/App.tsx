import { useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import MapDashboard from './MapDashboard';
import DriverMobileView from './DriverMobileView';

// Configuration globale d'Axios pour injecter le Token JWT
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Intercepteur global pour gérer l'expiration du token (Erreurs 401)
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Le token est expiré ou invalide : on nettoie et on recharge
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

export default function App() {
    // On vérifie si un token est déjà sauvegardé dans le navigateur
    const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<{ first_name?: string, last_name?: string }>({});
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // Décodage du token pour extraire le rôle
    useEffect(() => {
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                setUserRole(decoded.role); // Bam ! Net, précis, sécurisé.
                setUserProfile({ first_name: decoded.first_name, last_name: decoded.last_name });
            } catch (e) {
                handleLogout(); // Si le token est corrompu, on déconnecte
            }
        }
    }, [token, email]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            // Appel à l'API Django que nous avons configurée à la Tâche 1.1
            const response = await axios.post('http://127.0.0.1:8000/api/token/', {
                email: email, // <-- On ruse en envoyant l'email sous le nom 'username'
                password: password
            });

            const { access, refresh } = response.data;

            // On sauvegarde les clés dans le navigateur
            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);
            setToken(access);

        } catch (err: any) {
            // Cela va afficher l'erreur brute renvoyée par le serveur Django
            const errorDetail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
            setError(`Erreur backend : ${errorDetail}`);
            console.error("Détails complets :", err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setToken(null);
        setUserRole(null);
        setEmail('');
        setPassword('');
    };

    // --- LE ROUTEUR (Aiguillage selon le statut) ---

    // 1. SI NON CONNECTÉ : Écran de Login
    if (!token) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center font-sans p-4 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>

                <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl z-10">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-lg text-emerald-400 mb-4">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Smart Waste System</h1>
                        <p className="text-sm text-slate-400 mt-1">Portail d'Authentification</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl text-center font-semibold">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email Professionnel</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all" placeholder="admin@smartwaste.ma" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Mot de passe</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-all" placeholder="••••••••" required />
                        </div>
                        <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-900/40 mt-4">
                            Se connecter
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // 2. SI CHAUFFEUR : On redirige vers l'interface mobile (Tâche 1.4)
    if (userRole === 'DRIVER') {
        return <DriverMobileView user={{ email, role: userRole, ...userProfile }} onLogout={handleLogout} />;
    }

    // 3. SI ADMIN OU SUPER_ADMIN : On charge le Dashboard !
    return <MapDashboard user={{ email, role: userRole, ...userProfile }} onLogout={handleLogout} />;
}