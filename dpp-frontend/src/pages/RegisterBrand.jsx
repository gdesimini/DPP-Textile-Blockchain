import React, { useState } from 'react';
import { registerBrand } from '../services/api';
import { Building2, CheckCircle, AlertCircle } from 'lucide-react';
import './RegisterBrand.css';

const RegisterBrand = () => {
  const [brandName, setBrandName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [loading, setLoading] = useState(false);

  // Invia i dati del nuovo produttore al backend (operazione riservata al SuperAdmin)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', msg: '' });
    setLoading(true);

    try {
      const res = await registerBrand({ brandName, email, password });
      if (res.success) {
        setStatus({ type: 'success', msg: res.message || 'Produttore registrato con successo!' });
        // Reset dei campi del form dopo l'avvenuto accreditamento
        setBrandName('');
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setStatus({ 
        type: 'error', 
        msg: err.response?.data?.message || 'Errore durante la registrazione del produttore.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-brand-container">
      <div className="register-brand-header">
        <Building2 size={48} className="brand-icon" />
        <h2>Accreditamento Nuovo Produttore</h2>
        <p>Pannello Riservato Ente Certificatore / SuperAdmin</p>
      </div>

      {status.msg && (
        <div className={`status-box ${status.type}`}>
          {status.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{status.msg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-label">
            Ragione Sociale / Produttore
          </label>
          <input 
            type="text" 
            required 
            value={brandName} 
            onChange={(e) => setBrandName(e.target.value)} 
            placeholder="Es. Nome Produttore"
            className="form-input"
          />
        </div>

        <div className="form-field">
          <label className="form-label">
            Email Referente Aziendale
          </label>
          <input 
            type="email" 
            required 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="referente@produttore.it"
            className="form-input"
          />
        </div>

        <div className="form-field last">
          <label className="form-label">
            Password Temporanea di Primo Accesso
          </label>
          <input 
            type="password" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            placeholder="••••••••"
            className="form-input"
          />
        </div>

        <button type="submit" disabled={loading} className="submit-brand-btn">
          {loading ? 'Accreditamento in corso...' : 'Accredita Produttore'}
        </button>
      </form>
    </div>
  );
};

export default RegisterBrand;