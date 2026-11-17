import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import PassportDetail from './pages/PassportDetail';
import CreatePassport from './pages/CreatePassport';
import RegisterBrand from './pages/RegisterBrand';
import ChangePassword from './pages/ChangePassword';
import PassportView from './pages/PassportView'; 
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { Search, PlusCircle, UserPlus, LogOut, LogIn } from 'lucide-react';
import './App.css';

const NavigationBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const token = localStorage.getItem('dpp_token');
  
  // Lettura protetta dei dati utente da localStorage
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('dpp_user') || '{}');
  } catch (error) {
    user = {};
  }

  // Nascondo la barra di navigazione nella vista pubblica del consumatore (scansione QR code)
  if (location.pathname.startsWith('/passport/')) {
    return null;
  }

  // Chiusura della sessione e pulizia dei dati locali
  const handleLogout = () => {
    localStorage.removeItem('dpp_token');
    localStorage.removeItem('dpp_user');
    navigate('/login');
  };

  const isSearchActive = location.pathname === '/' || location.pathname === '/search';
  const isCreateActive = location.pathname === '/create';
  const isRegisterActive = location.pathname === '/register-brand';
  const isLoginActive = location.pathname === '/login';

  return (
    <nav className="navbar">
      {/* Consultazione pubblica e ricerca passaporto */}
      <Link to="/" className="nav-link">
        <button className={`nav-btn ${isSearchActive ? 'active' : ''}`}>
          <Search size={18} /> Cerca Passaporto
        </button>
      </Link>

      {/* Creazione riservata agli utenti autenticati (Produttore o SuperAdmin) */}
      {token && (
        <Link to="/create" className="nav-link">
          <button className={`nav-btn ${isCreateActive ? 'active' : ''}`}>
            <PlusCircle size={18} /> Nuovo Passaporto
          </button>
        </Link>
      )}

      {/* Accreditamento produttori visibile esclusivamente al SuperAdmin (Ente Certificatore) */}
      {token && user.role === 'superadmin' && (
        <Link to="/register-brand" className="nav-link">
          <button className={`nav-btn ${isRegisterActive ? 'active-blue' : ''}`}>
            <UserPlus size={18} /> Accredita Produttore
          </button>
        </Link>
      )}

      {/* Gestione sessione: visualizzazione utente e logout o accesso */}
      {token ? (
        <button onClick={handleLogout} className="nav-btn logout-btn">
          <LogOut size={18} /> Logout ({user.name || 'Utente'})
        </button>
      ) : (
        <Link to="/login" className="nav-link logout-link">
          <button className={`nav-btn login-btn ${isLoginActive ? 'active' : ''}`}>
            <LogIn size={18} /> Login
          </button>
        </Link>
      )}
    </nav>
  );
};

function App() {
  return (
    <Router>
      <div className="App">
        <NavigationBar />

        <div className="main-content">
          <Routes>
            {/* Rotte ad accesso pubblico */}
            <Route path="/" element={<PassportDetail />} />
            <Route path="/search" element={<PassportDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/passport/:productId" element={<PassportView />} />
            
            {/* Rotta per il cambio password obbligatorio al primo accesso */}
            <Route 
              path="/change-password" 
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'brand']}>
                  <ChangePassword />
                </ProtectedRoute>
              } 
            />

            {/* Rotta protetta per la notarizzazione dei nuovi lotti */}
            <Route 
              path="/create" 
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'brand']}>
                  <CreatePassport />
                </ProtectedRoute>
              } 
            />

            {/* Rotta protetta ad alto privilegio (solo SuperAdmin) */}
            <Route 
              path="/register-brand" 
              element={
                <ProtectedRoute allowedRoles={['superadmin']}>
                  <RegisterBrand />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;