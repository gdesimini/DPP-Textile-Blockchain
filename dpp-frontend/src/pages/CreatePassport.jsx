import { useState, useRef } from 'react';
import { createPassport, analyzeMaterialWithAI } from '../services/api';
import { 
  PlusCircle, Trash2, Send, Sparkles, Download, 
  ExternalLink, CheckCircle, Hash, Loader2 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './CreatePassport.css';

// Riduzione risoluzione immagine client-side per velocizzare l'upload verso Gemini
const compressImage = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const scaleSize = MAX_WIDTH / img.width;
        
        if (scaleSize < 1) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.7);
      };
    };
  });
};

// Geocodifica automatica tramite Nominatim (OpenStreetMap) per ottenere lat/lng
const fetchCoordinates = async (locationName) => {
  if (!locationName || !locationName.trim()) {
    throw new Error("Il campo 'Luogo' è obbligatorio per tutti gli step.");
  }

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}`
  );

  if (!res.ok) {
    throw new Error("Errore di connessione al servizio di geocodifica.");
  }

  const data = await res.json();

  if (data && data.length > 0) {
    return { 
      lat: parseFloat(data[0].lat), 
      lng: parseFloat(data[0].lon) 
    };
  }

  throw new Error(`Impossibile trovare le coordinate per la località: "${locationName}".`);
};

const CreatePassport = () => {
  const [formData, setFormData] = useState({
    productId: '',
    brand: '',
    name: '',
    composition: '',
    color: '',
    weight: '',
    careInstructions: '',
    notes: ''
  });

  const [regenerationSteps, setRegenerationSteps] = useState([
    { process: '', location: '', date: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState(null);
  const [createdPassport, setCreatedPassport] = useState(null);
  const qrRef = useRef(null);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleStepChange = (index, field, value) => {
    const updatedSteps = [...regenerationSteps];
    updatedSteps[index][field] = value;

    // Se si modifica una data, aggiorna a cascata quelle successive se diventano incoerenti
    if (field === 'date' && value) {
      for (let i = index + 1; i < updatedSteps.length; i++) {
        if (updatedSteps[i].date && updatedSteps[i].date < value) {
          updatedSteps[i].date = value;
        }
      }
    }

    setRegenerationSteps(updatedSteps);
  };

  const addStep = () => {
    // Pre-popola la data con quella dell'ultimo step, se presente
    const lastDate = regenerationSteps.length > 0 
      ? regenerationSteps[regenerationSteps.length - 1].date 
      : '';
    setRegenerationSteps([...regenerationSteps, { process: '', location: '', date: lastDate }]);
  };

  const removeStep = (index) => {
    setRegenerationSteps(regenerationSteps.filter((_, i) => i !== index));
  };

  // Invio foto etichetta al backend per estrazione composizione con Gemini
  const handleAIAnalysis = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      setLoadingAI(true);
      setError(null);

      const compressedFiles = await Promise.all(files.map(compressImage));

      const aiData = new FormData();
      compressedFiles.forEach((file) => aiData.append('images', file));

      const res = await analyzeMaterialWithAI(aiData);
      if (res.success && res.composition) {
        setFormData(prev => ({ ...prev, composition: res.composition }));
      } else {
        setError(res.message || "Impossibile analizzare l'immagine con AI.");
      }
    } catch (err) {
      setError("Errore durante l'analisi dell'immagine.");
    } finally {
      setLoadingAI(false);
    }
  };

  // Salvataggio del passaporto su DB e notarizzazione dell'hash su Polygon Amoy
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreatedPassport(null);

    const validSteps = regenerationSteps.filter(
      step => step.process.trim() !== '' || step.location.trim() !== '' || step.date.trim() !== ''
    );

    // Validazione campi e coerenza cronologica
    for (let i = 0; i < validSteps.length; i++) {
      if (!validSteps[i].location.trim()) {
        setError(`Inserire il luogo per lo Step #${i + 1}.`);
        setLoading(false);
        return;
      }
      if (!validSteps[i].date) {
        setError(`Inserire la data per lo Step #${i + 1}.`);
        setLoading(false);
        return;
      }
      if (i > 0 && validSteps[i].date < validSteps[i - 1].date) {
        setError(`La data dello Step #${i + 1} non può precedere quella dello Step #${i}.`);
        setLoading(false);
        return;
      }
    }

    try {
      // Risolvo le coordinate per ciascuna fase inserita
      const formattedSteps = await Promise.all(
        validSteps.map(async (step) => {
          const coords = await fetchCoordinates(step.location);
          return {
            process: step.process,
            location: step.location,
            coordinates: coords,
            date: step.date
          };
        })
      );

      // Costruisco il payload conforme allo schema Mongoose
      const payload = {
        productId: formData.productId,
        brand: formData.brand,
        name: formData.name,
        composition: formData.composition,
        productDetails: {
          color: formData.color || 'N/D',
          weight: formData.weight || 'N/D',
          careInstructions: formData.careInstructions || 'Lavare a mano o a 30°C con ciclo delicati.',
          notes: formData.notes || ''
        },
        environmentalAssessment: {
          carbonFootprintKg: 2.94,
          waterFootprintLiters: 126,
          globalWarmingReduction: 87,
          waterScarcityReduction: 80,
          equivalencies: { ledBulbs: 984, waterBottles: 77.6 }
        },
        regenerationSteps: formattedSteps
      };

      const res = await createPassport(payload);

      if (res.success || res.data?.success) {
        setCreatedPassport(res.data || res);
        setFormData({
          productId: '', brand: '', name: '', composition: '',
          color: '', weight: '', careInstructions: '', notes: ''
        });
        setRegenerationSteps([{ process: '', location: '', date: '' }]);
      } else {
        setError(res.message || 'Errore durante la creazione del passaporto.');
      }
    } catch (err) {
      const backendMessage = 
        err.response?.data?.message || 
        err.response?.data?.error || 
        err.message || 
        'Errore durante la creazione del passaporto.';

      setError(backendMessage);
    } finally {
      setLoading(false);
    }
  };

  // Generazione del file PNG dal QR Code vettoriale (SVG) per il download
  const downloadQRCode = () => {
    const svgElement = qrRef.current.querySelector('svg');
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
      downloadLink.download = `QRCode_${createdPassport.productId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const publicUrl = createdPassport 
    ? `${window.location.origin}/passport/${createdPassport.productId}`
    : '';

  const txHash = createdPassport?.blockchainTxHash || createdPassport?.txHash || createdPassport?.transactionHash;

  return (
    <div className="create-passport-container">
      
      {loading && (
        <div className="fullscreen-loading-overlay">
          <div className="loading-modal-box">
            <Loader2 size={54} className="spinning-loader-icon" />
            <h3>Notarizzazione in Corso...</h3>
            <p>Registrazione del passaporto digitale e transazione immutabile su Polygon Amoy.</p>
            <span className="loading-subnote">Attendere la conferma</span>
          </div>
        </div>
      )}

      <h1 className="page-title">Crea Nuovo Passaporto Digitale</h1>

      {error && <p className="error-message">{error}</p>}

      {createdPassport && (
        <div className="success-card">
          <CheckCircle size={48} className="success-icon" />
          <h2 className="success-title">Passaporto Creato con Successo!</h2>
          <p className="success-info">
            <strong>ID Prodotto:</strong> {createdPassport.productId} | <strong>Prodotto:</strong> {createdPassport.name}
          </p>

          {txHash && (
            <div className="tx-hash-badge">
              <Hash size={14} className="tx-hash-icon" />
              <span>
                <strong>Tx Hash:</strong>{' '}
                <a href={`https://amoy.polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="tx-hash-link">
                  <code>{txHash}</code>
                </a>
              </span>
            </div>
          )}
          <br />
          <div ref={qrRef} className="qr-code-wrapper">
            <QRCodeSVG value={publicUrl} size={180} level="H" includeMargin={true} />
          </div>
          <div className="actions-row">
            <button onClick={downloadQRCode} className="download-btn">
              <Download size={18} /> Scarica QR Code
            </button>
            <a href={`/passport/${createdPassport.productId}`} target="_blank" rel="noopener noreferrer" className="public-link-btn">
              <ExternalLink size={18} /> Apri Scheda Pubblica
            </a>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="passport-form">
        <h3 className="section-title">Dati Generali</h3>
        
        <div className="grid-2col">
          <div>
            <label className="field-label">ID Prodotto*:</label>
            <input 
              type="text" 
              name="productId" 
              placeholder="es. PROD_001" 
              value={formData.productId} 
              onChange={handleInputChange} 
              required 
              className="input-field" 
            />
          </div>
          <div>
            <label className="field-label">Produttore*:</label>
            <input 
              type="text" 
              name="brand" 
              placeholder="es. Nome Produttore" 
              value={formData.brand} 
              onChange={handleInputChange} 
              required 
              className="input-field" 
            />
          </div>
        </div>

        <div className="grid-2col last">
          <div>
            <label className="field-label">Nome Prodotto*:</label>
            <input 
              type="text" 
              name="name" 
              placeholder="es. Maglione" 
              value={formData.name} 
              onChange={handleInputChange} 
              required 
              className="input-field" 
            />
          </div>
          <div>
            <label className="field-label">Composizione*:</label>
            <div className="composition-wrapper">
              <input 
                type="text" 
                name="composition" 
                placeholder="es. 95% Cashmere rigenerato, 5% Lana" 
                value={formData.composition} 
                onChange={handleInputChange} 
                required 
                className="composition-input" 
              />
              <label className="ai-scan-btn">
                <Sparkles size={16} /> {loadingAI ? 'Analisi...' : 'Scansiona AI'}
                <input type="file" accept="image/*" multiple onChange={handleAIAnalysis} style={{ display: 'none' }} disabled={loadingAI} />
              </label>
            </div>
          </div>
        </div>

        <h3 className="section-title">Informazioni e Dettagli del Prodotto</h3>
        
        <div className="grid-2col">
          <div>
            <label className="field-label">Colore:</label>
            <input type="text" name="color" placeholder="es. Blu Notte" value={formData.color} onChange={handleInputChange} className="input-field" />
          </div>
          <div>
            <label className="field-label">Peso / Grammatura:</label>
            <input type="text" name="weight" placeholder="es. 350 g / 180 gr/mq" value={formData.weight} onChange={handleInputChange} className="input-field" />
          </div>
        </div>

        <div className="form-group-margin">
          <label className="field-label">Istruzioni di Lavaggio e Cura:</label>
          <input type="text" name="careInstructions" placeholder="es. Lavare a mano a freddo, non stirare a vapore" value={formData.careInstructions} onChange={handleInputChange} className="input-field" />
        </div>

        <div className="form-group-margin">
          <label className="field-label">Note Aggiuntive / Descrizione:</label>
          <textarea name="notes" rows="3" placeholder="Informazioni sulla vestibilità, certificazioni o storia del capo..." value={formData.notes} onChange={handleInputChange} className="input-field" />
        </div>

        <h3 className="section-title steps-title">Fasi di Tracciabilità e Rigenerazione</h3>

        {regenerationSteps.map((step, index) => {
          // Limite cronologico: la data non può precedere quella dello step precedente
          const minDate = index > 0 ? regenerationSteps[index - 1].date : undefined;

          return (
            <div key={index} className="step-card">
              <div className="step-header">
                <strong>Step #{index + 1}</strong>
                {regenerationSteps.length > 1 && (
                  <button type="button" onClick={() => removeStep(index)} className="remove-step-btn">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <div className="grid-3col">
                <input 
                  type="text" 
                  placeholder="Processo (es. Sfilacciatura)" 
                  value={step.process} 
                  onChange={(e) => handleStepChange(index, 'process', e.target.value)} 
                  required 
                  className="input-field" 
                />
                <input 
                  type="text" 
                  placeholder="Luogo (es. Roma, Italia)" 
                  value={step.location} 
                  onChange={(e) => handleStepChange(index, 'location', e.target.value)} 
                  required 
                  className="input-field" 
                />
                <input 
                  type="date" 
                  value={step.date} 
                  min={minDate} 
                  onChange={(e) => handleStepChange(index, 'date', e.target.value)} 
                  required 
                  className="input-field" 
                />
              </div>
            </div>
          );
        })}

        <button type="button" onClick={addStep} className="add-step-btn">
          <PlusCircle size={18} /> Aggiungi un'altra fase
        </button>

        <button type="submit" disabled={loading || loadingAI} className="submit-passport-btn">
          <Send size={18} /> {loading ? 'Creazione in corso...' : 'Salva Passaporto'}
        </button>
      </form>
    </div>
  );
};

export default CreatePassport;