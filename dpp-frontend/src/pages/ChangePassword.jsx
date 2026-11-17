import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changePassword } from '../services/api';
import { KeyRound, Lock, ShieldAlert, CheckCircle } from 'lucide-react';
import './ChangePassword.css';

// Controllo robustezza: 8 caratteri, 1 maiuscola, 1 minuscola, 1 numero, 1 carattere speciale
const isPasswordStrong = (pwd) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
  return passwordRegex.test(pwd);
};

const ChangePassword = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 1. Vincolo di corrispondenza tra i due campi
    if (newPassword !== confirmPassword) {
      return setError('La conferma della password non coincide con la nuova password.');
    }

    // 2. Vincolo di unicità: la nuova non può coincidere con quella provvisoria
    if (oldPassword === newPassword) {
      return setError('La nuova password deve essere diversa da quella temporanea ricevuta.');
    }

    // 3. Vincolo di complessità crittografica
    if (!isPasswordStrong(newPassword)) {
      return setError(
        'La nuova password deve contenere almeno 8 caratteri, una lettera maiuscola, una minuscola, un numero e un carattere speciale.'
      );
    }

    setLoading(true);

    try {
      const res = await changePassword({ oldPassword, newPassword });
      if (res.success) {
        // Rimuovo il flag di primo login nel local storage e reindirizzo al pannello di creazione
        const user = JSON.parse(localStorage.getItem('dpp_user') || '{}');
        user.isFirstLogin = false;
        localStorage.setItem('dpp_user', JSON.stringify(user));

        navigate('/create');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Errore durante il cambio password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-container">
      
      <div className="change-password-header">
        <div className="key-icon-wrapper">
          <KeyRound size={32} color="#f39c12" />
        </div>
        <h2>Primo Accesso Rilevato</h2>
        <p>
          Per motivi di sicurezza, imposta una <strong>nuova password personale</strong> al posto di quella provvisoria fornita dall'Ente Certificatore / Amministratore.
        </p>
      </div>

      {error && (
        <div className="error-box">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        
        <div className="form-field">
          <label className="form-label">Password Temporanea Ricevuta</label>
          <div className="input-box">
            <Lock size={18} className="input-icon neutral" />
            <input 
              type="password" 
              required 
              autoComplete="current-password"
              value={oldPassword} 
              onChange={(e) => setOldPassword(e.target.value)} 
              placeholder="Inserisci la password temporanea" 
              className="input-element" 
            />
          </div>
        </div>

        <div className="form-field">
          <label className="form-label">Nuova Password </label>
          <div className="input-box">
            <Lock size={18} className="input-icon success" />
            <input 
              type="password" 
              required 
              autoComplete="new-password"
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              placeholder="Min. 8 car. (A-Z, a-z, 0-9, !@#$)" 
              className="input-element" 
            />
          </div>
        </div>

        <div className="form-field last">
          <label className="form-label">Conferma Nuova Password</label>
          <div className="input-box">
            <Lock size={18} className="input-icon success" />
            <input 
              type="password" 
              required 
              autoComplete="new-password"
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              placeholder="Ripeti la nuova password" 
              className="input-element" 
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className="save-btn">
          <CheckCircle size={18} />
          {loading ? 'Aggiornamento in corso...' : 'Salva e Accedi al Pannello'}
        </button>

      </form>
    </div>
  );
};

export default ChangePassword;