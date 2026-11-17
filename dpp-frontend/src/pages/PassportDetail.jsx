import React, { useState, useRef } from 'react';
import { getPassportById, addRegenerationStep, verifyPassport } from '../services/api';
import { 
  Search, ShieldCheck, ShieldAlert, AlertTriangle, Factory, Calendar, MapPin, Tag, 
  PlusCircle, MinusCircle, CheckCircle, Navigation, Info, Download, Loader2 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import SupplyMap from '../components/SupplyMap';
import './PassportDetail.css';

// Geocodifica automatica dell'indirizzo dello stabilimento tramite Nominatim
const fetchCoordinates = async (locationName) => {
  if (!locationName?.trim()) {
    throw new Error("Il campo 'Luogo' è obbligatorio.");
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}`
  );

  if (!res.ok) {
    throw new Error("Errore durante il recupero delle coordinate.");
  }

  const data = await res.json();
  if (data?.length > 0) {
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  }

  throw new Error(`Impossibile trovare le coordinate per la località: "${locationName}".`);
};

const PassportDetail = () => {
  const [productId, setProductId] = useState('');
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stato per l'audit di integrità (confronto tra hash DB e stato su Polygon)
  const [verification, setVerification] = useState({
    checked: false,
    isValid: null,
    loading: false
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newProcess, setNewProcess] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newDate, setNewDate] = useState('');
  const [addingStep, setAddingStep] = useState(false);
  const [stepSuccess, setStepSuccess] = useState('');

  const qrRef = useRef(null);

  // Recupero credenziali di sessione
  const token = localStorage.getItem('dpp_token');
  const user = JSON.parse(localStorage.getItem('dpp_user') || '{}');

  // Interroga il backend per verificare se l'hash dei dati attuali coincide con quello on-chain
  const executeAudit = async (targetId) => {
    setVerification({ checked: false, isValid: null, loading: true });
    try {
      const auditRes = await verifyPassport(targetId);
      const auditData = auditRes.data || auditRes;
      setVerification({ checked: true, isValid: auditData.isValid, loading: false });
    } catch {
      setVerification({ checked: true, isValid: false, loading: false });
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!productId.trim()) return;

    setLoading(true);
    setError(null);
    setPassport(null);
    setShowAddForm(false);
    setStepSuccess('');

    try {
      const result = await getPassportById(productId.trim());
      if (result.success || result.data) {
        const passportData = result.data?.data || result.data || result;
        setPassport(passportData);
        // Eseguo l'audit crittografico non appena il passaporto viene caricato
        await executeAudit(passportData.productId);
      } else {
        setError(result.message || 'Passaporto non trovato.');
      }
    } catch (err) {
  if (err.code === 'ERR_NETWORK') {
    setError('Impossibile contattare il server. Riprova più tardi.');
  } else if (err.response?.status === 404) {
    setError('Nessun passaporto trovato con questo identificativo.');
  } else {
    setError(
      err.response?.data?.message ||
      'Si è verificato un errore durante il recupero del passaporto.'
    );
  }
} finally {
  setLoading(false);
}
  };

  // Invia la nuova fase di rigenerazione; se il DB è compromesso, il backend risponde con HTTP 409
  const handleAddStep = async (e) => {
    e.preventDefault();
    setAddingStep(true);
    setStepSuccess('');
    setError(null);

    try {
      const coords = await fetchCoordinates(newLocation);
      const stepPayload = {
        process: newProcess,
        location: newLocation,
        coordinates: coords,
        date: newDate
      };

      const res = await addRegenerationStep(passport.productId, stepPayload);

      if (res.success) {
        const updatedPassport = res.data?.data || res.data || res;
        setPassport(updatedPassport);
        setStepSuccess('Nuova fase aggiunta e notarizzata con successo su Polygon!');
        setNewProcess('');
        setNewLocation('');
        setNewDate('');
        setShowAddForm(false);
        await executeAudit(passport.productId);
      } else {
        setError(res.message || "Errore durante l'aggiunta della nuova fase.");
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Errore durante l'aggiunta della nuova fase.");
    } finally {
      setAddingStep(false);
    }
  };

  const downloadQRCode = () => {
    const svgElement = qrRef.current?.querySelector('svg');
    if (!svgElement) return;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);

      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngFile;
      downloadLink.download = `QRCode_${passport.productId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  // Verifica permessi per abilitare l'aggiunta di nuove fasi (SuperAdmin o proprietario del passaporto)
  const loggedUserId = user.userId || user._id || '';
  const createdById = typeof passport?.createdBy === 'object' ? passport?.createdBy?._id : passport?.createdBy;
  const isOwner = createdById && loggedUserId && (String(createdById) === String(loggedUserId));
  const isSuperAdmin = user.role === 'superadmin';
  const isBrandMatch = passport?.brand && user.name && (passport.brand.toLowerCase() === user.name.toLowerCase());
  const canEdit = token && (isSuperAdmin || isOwner || isBrandMatch);
  
  const publicUrl = passport ? `${window.location.origin}/passport/${passport.productId}` : '';
  const auditStatusClass = verification.loading ? '' : (verification.isValid ? 'valid' : 'invalid');

  return (
    <div className="passport-detail-container">
      <h1 className="page-title">Passaporto Digitale del Prodotto</h1>
      
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          placeholder="Inserisci ID Prodotto"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="search-input"
        />
        <button type="submit" className="search-btn">
          <Search size={18} /> Cerca
        </button>
      </form>

      {loading && <p className="status-loading">Caricamento passaporto...</p>}

      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} className="error-banner-icon" />
          <span>{error}</span>
        </div>
      )}

      {stepSuccess && (
        <div className="status-success-box">
          <CheckCircle size={18} /> {stepSuccess}
        </div>
      )}

      {passport && (
        <div className="passport-card">
          <div ref={qrRef} className="hidden-qr-export">
            <QRCodeSVG value={publicUrl} size={250} level="H" includeMargin={true} />
          </div>

          <div className={`audit-badge-box ${auditStatusClass}`}>
            <div className="audit-badge-content">
              <div className={`audit-badge-title ${auditStatusClass}`}>
                {verification.loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" color="#64748b" />
                    <span>Verifica crittografica on-chain in corso...</span>
                  </>
                ) : verification.isValid ? (
                  <>
                    <ShieldCheck size={22} color="#16a34a" />
                    <span>Passaporto Verificato e Integro su Polygon Amoy</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={22} color="#dc2626" />
                    <span>ATTENZIONE: Integrità Compromessa (Manomissione DB)</span>
                  </>
                )}
              </div>

              {!verification.loading && (
                verification.isValid ? (
                  <CheckCircle size={20} color="#16a34a" />
                ) : (
                  <AlertTriangle size={20} color="#dc2626" />
                )
              )}
            </div>

            {!verification.loading && !verification.isValid && (
              <div className="audit-discrepancy-msg">
                <strong>Discrepanza Rilevata:</strong> I dati attuali nel database non corrispondono all'impronta Keccak-256 registrata nel blocco Polygon.
              </div>
            )}
          </div>

          <div className="passport-card-header">
            <div>
              <h2 className="passport-card-title">{passport.name}</h2>
              <p className="passport-card-meta">
                <Tag size={16} /> <strong>Produttore:</strong> {passport.brand} | <strong>ID:</strong> {passport.productId}
              </p>
            </div>

            {canEdit && (
              <button onClick={downloadQRCode} className="download-qr-action-btn">
                <Download size={15} /> Scarica QR Code
              </button>
            )}
          </div>

          <div className="passport-composition-section">
            <p className="composition-text"><strong>Composizione:</strong> {passport.composition}</p>
          </div>

          {/* Dettagli tecnici letti esclusivamente dalla struttura ufficiale productDetails */}
          <div className="product-details-box">
            <h4 className="product-details-heading">
              <Info size={16} /> Dettagli del Prodotto
            </h4>
            <div className="product-specs-grid">
              <p className="spec-item"><strong>Colore:</strong> {passport.productDetails?.color || 'N/D'}</p>
              <p className="spec-item"><strong>Peso:</strong> {passport.productDetails?.weight || 'N/D'}</p>
            </div>
            <p className="care-instructions-text">
              <strong>Istruzioni di Cura:</strong> {passport.productDetails?.careInstructions || 'Lavare a mano o a 30°C con ciclo delicati.'}
            </p>
            {passport.productDetails?.notes && (
              <p className="notes-text">
                <strong>Note:</strong> {passport.productDetails.notes}
              </p>
            )}
          </div>

          <div className="map-section">
            <h3 className="section-subtitle">
              <Navigation size={18} /> Mappa Georeferenziata della Filiera
            </h3>
            <SupplyMap steps={passport.regenerationSteps} />
          </div>

          <div className="section-header-row">
            <h3 className="section-subtitle">
              <Factory size={20} /> Tracciabilità e Rigenerazione
            </h3>

            {canEdit && (
              <button onClick={() => setShowAddForm(!showAddForm)} className="toggle-add-btn">
                {showAddForm ? <MinusCircle size={16} /> : <PlusCircle size={16} />}
                {showAddForm ? 'Annulla' : 'Aggiungi Fase'}
              </button>
            )}
          </div>

          {showAddForm && (
            <form onSubmit={handleAddStep} className="add-step-form">
              <h4 className="form-subheading">Nuova Fase di Rigenerazione</h4>
              <div className="grid-3col">
                <input
                  type="text"
                  required
                  placeholder="Processo"
                  value={newProcess}
                  onChange={(e) => setNewProcess(e.target.value)}
                  className="form-input"
                />
                <input
                  type="text"
                  required
                  placeholder="Luogo (es. Roma, Italia)"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="form-input"
                />
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="form-input"
                />
              </div>

              <button type="submit" disabled={addingStep} className="save-step-btn">
                {addingStep ? 'Notarizzazione On-Chain in corso...' : 'Salva e Notarizza Fase'}
              </button>
            </form>
          )}

          <ul className="steps-list">
            {passport.regenerationSteps && passport.regenerationSteps.map((step, index) => (
              <li key={index} className="step-item">
                <strong>{step.process}</strong>
                <div className="step-details">
                  <span><MapPin size={14} /> {step.location}</span> | 
                  <span><Calendar size={14} /> {step.date}</span>
                </div>
              </li>
            ))}
          </ul>

          <div className="blockchain-footer">
            {passport.blockchainTxHash ? (
              <div className="blockchain-success">
                <p className="blockchain-success-title">
                  <ShieldCheck size={18} /> Notarizzato su Blockchain Polygon Amoy
                </p>
                <a 
                  href={`https://amoy.polygonscan.com/tx/${passport.blockchainTxHash}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="tx-link"
                >
                  Tx Hash: {passport.blockchainTxHash}
                </a>
              </div>
            ) : (
              <p className="blockchain-pending">
                <ShieldCheck size={18} /> Notarizzazione Blockchain: In attesa di registrazione
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PassportDetail;