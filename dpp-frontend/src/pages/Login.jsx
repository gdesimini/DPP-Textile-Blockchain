import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../services/api'; 
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await loginUser({ email, password });

      if (res.success && res.token) {
        // Salvo il token JWT e il profilo utente per la gestione delle sessioni e RBAC
        localStorage.setItem('dpp_token', res.token);
        localStorage.setItem('dpp_user', JSON.stringify(res.user));

        // Se è il primo accesso reindirizzo al cambio password obbligatorio, altrimenti al form
        if (res.user?.isFirstLogin) {
          navigate('/change-password');
        } else {
          navigate('/create');
        }
      } else {
        setError(res.message || 'Credenziali non valide');
      }
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.message || `Errore del server (${err.response.status})`);
      } else if (err.request) {
        setError('Impossibile contattare il server backend. Verifica che Node.js sia attivo.');
      } else {
        setError('Errore durante l\'invio della richiesta.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <ShieldCheck size={48} color="#27ae60" />
        <h2>Accesso Gestore DPP</h2>
        <p>Area riservata per la notarizzazione dei capi</p>
      </div>

      {error && <div className="login-error-box">{error}</div>}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label">Email Operatore</label>
          <div className="input-wrapper">
            <Mail size={18} className="input-icon" />
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="admin@brand.com"
              className="input-field"
            />
          </div>
        </div>

        <div className="form-group last">
          <label className="form-label">Password</label>
          <div className="input-wrapper">
            <Lock size={18} className="input-icon" />
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              className="input-field"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Autenticazione in corso...' : 'Accedi'}
        </button>
      </form>
    </div>
  );
};

export default Login;