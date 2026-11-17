# 🌍 Digital Product Passport (DPP) per il Tessile Rigenerato

Prototipo software full-stack sviluppato come progetto di tesi triennale in Ingegneria Informatica e dell'Automazione (Politecnico di Bari). Il sistema implementa un Passaporto Digitale di Prodotto, focalizzandosi sulla filiera del tessile rigenerato e ispirandosi ai processi operativi di aziende circolari come Rifò.

## 🚀 Live Demo & Test Immediato
Puoi testare l'applicazione in produzione al seguente indirizzo:
[👉 Accedi al Passaporto Digitale del Prodotto](https://dpp-textile-blockchain.vercel.app)

*💡 **Nota per la consultazione:** Non avendo le credenziali per il login amministrativo, puoi testare subito il sistema inserendo l'ID **`PROD_001`** nella barra di ricerca della pagina pubblica.*

## 🛠️ Stack Tecnologico e Architettura
L'applicazione adotta un'architettura ibrida a tre livelli (Presentation, Application, Data Tier):
- **Frontend (`dpp-frontend`):** Sviluppato in React (Vite), interfaccia responsive multi-ruolo (Brand e SuperAdmin) e scheda pubblica di consultazione per il consumatore. Integra mappe interattive (React Leaflet) per la geolocalizzazione delle tappe di filiera e generazione dinamica di codici QR.
- **Backend (`dpp-backend`):** Server Node.js / Express. Gestisce l'autenticazione basata su ruoli con JWT e bcryptjs, la geocodifica tramite OpenStreetMap Nominatim API, e l'integrazione con l'intelligenza artificiale.
- **Intelligenza Artificiale (Vision-AI):** Integrazione dell'SDK Google Gemini (gemini-3.5-flash-lite) per l'estrazione automatica e la precompilazione della composizione fibrosa a partire da fotografie di etichette e capi.
- **Database (Off-Chain Tier):** MongoDB Atlas (Mongoose ODM) per la persistenza dei dati anagrafici, metriche ambientali, dettagli tecnici e storico delle fasi di rigenerazione.
- **Blockchain (On-Chain Tier):** Polygon PoS Testnet (Amoy) e Smart Contract in Solidity. Viene utilizzata una strategia di notarizzazione ibrida: sul registro distribuito viene salvata un'impronta crittografica (Keccak-256 hash) dei dati associata all'ID del prodotto, garantendo immutabilità e verificabilità a costo di transazione prossimo allo zero (~0,002006 POL / < 0,001 €).

## ✨ Funzionalità Principali
1. **Creazione guidata del DPP:** Inserimento dei dati del capo, validazione dell'unicità dell'ID e calcolo dell'hash canonico.
2. **AI Label Recognition:** Scansione tramite IA delle etichette per ricavare in automatico le percentuali di fibre tessili.
3. **Tracciamento della Filiera e Mappa:** Aggiunta sequenziale di tappe di rigenerazione geolocalizzate su mappa.
4. **Audit e Audit di Integrità (Tamper-Detection):** Funzione di controllo che ricalcola l'hash off-chain e lo confronta in tempo reale con lo stato on-chain sulla blockchain.
5. **Consultazione Pubblica via QR Code:** Accesso immediato da parte del consumatore finale alla scheda trasparente del capo senza necessità di autenticazione.
