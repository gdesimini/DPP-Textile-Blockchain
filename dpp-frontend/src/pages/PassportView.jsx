import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPassportById, verifyPassport } from '../services/api';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, MapPin, Calendar, Layers, CheckCircle, 
  Hash, FileCode, ExternalLink, Droplet, Zap, Wind, Navigation,
  Info, Shirt, Scale, Sparkles, FileText, Loader2 
} from 'lucide-react';
import SupplyMap from '../components/SupplyMap';
import './PassportView.css';

const PassportView = () => {
  // Lettura dell'identificativo univoco del passaporto dai parametri URL della route pubblica
  const { productId } = useParams();
  const [passport, setPassport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stato per l'audit crittografico on-chain
  const [verification, setVerification] = useState({
    checked: false,
    isValid: null,
    loading: true
  });

  useEffect(() => {
    const fetchPassportAndAudit = async () => {
      try {
        setLoading(true);
        // Recupero dei metadati salvati su MongoDB
        const res = await getPassportById(productId);
        
        if (res && (res.success || res.data)) {
          const passportData = res.data?.data || res.data || res;
          setPassport(passportData);

          // Esecuzione automatica dell'audit: confronto dell'hash locale con lo smart contract
          try {
            const auditRes = await verifyPassport(productId);
            const auditData = auditRes.data || auditRes;
            setVerification({
              checked: true,
              isValid: auditData.isValid,
              loading: false
            });
          } catch {
            setVerification({ checked: true, isValid: false, loading: false });
          }

        } else {
          setError('Passaporto non trovato.');
        }
            } catch (err) {
        if (err.code === 'ERR_NETWORK') {
          setError('Impossibile contattare il server. Riprova più tardi.');
        } else if (err.response?.status === 404) {
          setError('Nessun passaporto trovato con questo identificativo.');
        } else {
          setError('Si è verificato un errore durante il recupero del passaporto.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchPassportAndAudit();
    }
  }, [productId]);

  if (loading) {
    return (
      <div className="passport-status-message">
        <h2>Caricamento Passaporto Digitale...</h2>
      </div>
    );
  }

  if (error || !passport) {
    return (
      <div className="passport-status-message error">
        <h2>❌ {error || 'Passaporto non trovato'}</h2>
      </div>
    );
  }

  const txHash = passport.blockchainTxHash || passport.txHash;
  const contractAddress = passport.contractAddress || (import.meta.env && import.meta.env.VITE_CONTRACT_ADDRESS) || "0xa0D6D239A29FD6450d6f8B976ac9deDBe6e55c14";
  const env = passport.environmentalAssessment;
  
  // Lettura unificata dall'oggetto ufficiale productDetails
  const details = passport.productDetails || {};

  const badgeStatusClass = verification.loading 
    ? '' 
    : (verification.isValid ? 'badge--valid' : 'badge--invalid');

  const titleStatusClass = verification.loading 
    ? '' 
    : (verification.isValid ? 'title--valid' : 'title--invalid');

  return (
    <div className="passport-view-container">
      
      {/* Badge di audit on-chain: segnala manomissioni se l'hash non coincide */}
      <div className={`blockchain-badge-container ${badgeStatusClass}`}>
        <div className="blockchain-badge-header">
          <div className={`blockchain-badge-title ${titleStatusClass}`}>
            {verification.loading ? (
              <>
                <Loader2 size={24} className="animate-spin" />
                <span>Verifica crittografica on-chain in corso...</span>
              </>
            ) : verification.isValid ? (
              <>
                <ShieldCheck size={26} color="#16a34a" />
                <span>Passaporto Verificato e Integro su Polygon</span>
              </>
            ) : (
              <>
                <ShieldAlert size={26} color="#dc2626" />
                <span>ATTENZIONE: Integrità Compromessa</span>
              </>
            )}
          </div>

          {!verification.loading && (
            verification.isValid ? (
              <CheckCircle size={24} color="#16a34a" />
            ) : (
              <AlertTriangle size={24} color="#dc2626" />
            )
          )}
        </div>

        {!verification.loading && !verification.isValid && (
          <div className="audit-alert-box">
            <strong>Discrepanza Rilevata:</strong> I dati attuali nel database non corrispondono all'impronta Keccak-256 registrata nel blocco Polygon.
          </div>
        )}

        <div className="blockchain-tech-details">
          <div className="tech-detail-row">
            <Hash size={14} className="tech-icon" />
            <span>
              <strong>Tx Hash:</strong>{' '}
              {txHash ? (
                <a
                  href={`https://amoy.polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-hash-link"
                  title="Verifica su PolygonScan Amoy"
                >
                  <code>{txHash}</code>
                  <ExternalLink size={12} />
                </a>
              ) : (
                <span className="pending-text">In attesa di notarizzazione</span>
              )}
            </span>
          </div>

          <div className="tech-detail-row">
            <FileCode size={14} className="tech-icon" />
            <span>
              <strong>Smart Contract:</strong>{' '}
              <code className="contract-code">{contractAddress}</code>
            </span>
          </div>
        </div>
      </div>

      {/* Scheda anagrafica del prodotto */}
      <div className="product-card">
        <span className="brand-badge">
          Produttore: {passport.brand || 'N/D'}
        </span>

        <h1 className="product-title">{passport.name || 'Prodotto Senza Nome'}</h1>
        
        <div className="product-info-grid">
          <div>
            <p className="info-label">ID Prodotto</p>
            <p className="info-value">{passport.productId}</p>
          </div>

          <div>
            <p className="info-label">Produttore</p>
            <p className="info-value">{passport.brand || 'N/D'}</p>
          </div>

          <div className="grid-col-full">
            <p className="info-label">Composizione Materiali</p>
            <p className="info-value composition">
              <Layers size={16} /> {passport.composition || 'N/D'}
            </p>
          </div>
        </div>

        {/* Dettagli tecnici e istruzioni di cura */}
        <div className="product-technical-section">
          <h3 className="tech-section-title">
            <Info size={16} color="#2563eb" /> Dettagli Tecnici e Cura
          </h3>

          <div className="tech-spec-grid">
            <div className="meta-item">
              <Shirt size={16} className="spec-icon" />
              <span><strong>Colore:</strong> {details.color || 'N/D'}</span>
            </div>
            <div className="meta-item">
              <Scale size={16} className="spec-icon" />
              <span><strong>Peso:</strong> {details.weight || 'N/D'}</span>
            </div>
          </div>

          <div className="tech-spec-row">
            <Sparkles size={16} className="spec-icon" />
            <span><strong>Istruzioni di Cura:</strong> {details.careInstructions || 'Lavare a mano o a 30°C con ciclo delicati.'}</span>
          </div>

          {details.notes && (
            <div className="tech-spec-row tech-spec-notes">
              <FileText size={16} className="spec-icon" />
              <span><strong>Note:</strong> {details.notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* Indicatori ambientali LCA */}
      <div className="environmental-card">
        <h3 className="card-section-title">Valutazione d'Impatto Ambientale (LCA)</h3>
        
        <div className="env-grid">
          <div className="env-box">
            <div className="env-box-header">
              <Wind size={18} color="#e74c3c" />
              <span>Carbon Footprint</span>
            </div>
            <p className="env-value">{(env?.carbonFootprintKg || 2.94)} kg CO₂eq</p>
            <small className="env-subtext">-{env?.globalWarmingReduction || 87}% vs Standard</small>
          </div>

          <div className="env-box">
            <div className="env-box-header">
              <Droplet size={18} color="#2980b9" />
              <span>Water Footprint</span>
            </div>
            <p className="env-value">{(env?.waterFootprintLiters || 126)} Litri</p>
            <small className="env-subtext">-{env?.waterScarcityReduction || 80}% vs Standard</small>
          </div>
        </div>

        <div className="env-equivalencies">
          <div className="equiv-item">
            <Zap size={16} color="#f39c12" />
            <span>Equivale al risparmio energetico di <strong>{env?.equivalencies?.ledBulbs || 984}</strong> lampadine LED</span>
          </div>
          <div className="equiv-item">
            <Droplet size={16} color="#3498db" />
            <span>Equivale a <strong>{env?.equivalencies?.waterBottles || 77}</strong> bottiglie d'acqua da 1.5L</span>
          </div>
        </div>
      </div>

      {/* Mappa georeferenziata della filiera */}
      <div className="map-card">
        <h3 className="card-section-title">
          <Navigation size={18} /> Mappa di Filiera Georeferenziata
        </h3>
        <SupplyMap steps={passport.regenerationSteps} />
      </div>

      {/* Cronistoria delle fasi di rigenerazione */}
      <div className="traceability-card">
        <h3 className="card-section-title">
          Fasi di Tracciabilità e Rigenerazione
        </h3>

        {passport.regenerationSteps && passport.regenerationSteps.length > 0 ? (
          <div className="timeline-container">
            {passport.regenerationSteps.map((step, index) => (
              <div key={index} className="timeline-item">
                <div className="timeline-content">
                  <h4>{step.process}</h4>
                  <div className="timeline-meta">
                    {step.location && (
                      <span className="meta-item">
                        <MapPin size={14} /> {step.location}
                      </span>
                    )}
                    {step.date && (
                      <span className="meta-item">
                        <Calendar size={14} /> {new Date(step.date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-timeline-text">Nessuna fase di rigenerazione registrata.</p>
        )}
      </div>

    </div>
  );
};

export default PassportView;