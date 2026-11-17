const { ethers } = require('ethers');
const Passport = require('../models/Passport');

const contractABI = require('../abis/DigitalProductPassport.json');
const contractAddress = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC);

let wallet = null;
let passportContract = null;

// Inizializzazione del wallet e del contratto su Polygon
if (process.env.PRIVATE_KEY) {
  try {
    let key = process.env.PRIVATE_KEY.trim();

    if (!key.startsWith('0x')) {
      key = `0x${key}`;
    }

    wallet = new ethers.Wallet(key, provider);

    if (contractAddress) {
      passportContract = new ethers.Contract(
        contractAddress,
        contractABI,
        wallet
      );
    }
  } catch (err) {
    console.error('Errore inizializzazione wallet:', err.message);
  }
}

/**
 * Normalizza le coordinate geografiche in una struttura canonica fissa { lat, lng }.
 * Gestisce sia array [lat, lng] che oggetti { lat, lng } / { latitude, longitude }.
 * Verifica che i valori siano numeri finiti e arrotonda a 6 decimali.
 */
const normalizeCoordinates = (coords) => {
  if (!coords) return null;

  let rawLat;
  let rawLng;

  // Supporto array [lat, lng]
  if (Array.isArray(coords) && coords.length >= 2) {
    rawLat = Number(coords[0]);
    rawLng = Number(coords[1]);
  } else if (typeof coords === 'object') {
    // Supporto oggetto { lat, lng } o { latitude, longitude }
    const latCandidate =
      coords.lat !== undefined ? coords.lat : coords.latitude;

    const lngCandidate =
      coords.lng !== undefined ? coords.lng : coords.longitude;

    rawLat = Number(latCandidate);
    rawLng = Number(lngCandidate);
  }

  if (Number.isFinite(rawLat) && Number.isFinite(rawLng)) {
    return {
      lat: Number(rawLat.toFixed(6)),
      lng: Number(rawLng.toFixed(6))
    };
  }

  return null;
};

/**
 * Verifica la coerenza cronologica di una sequenza di fasi.
 * Ogni fase successiva deve avere una data maggiore o uguale alla precedente.
 */
const validateStepsChronology = (steps) => {
  if (!Array.isArray(steps) || steps.length <= 1) return true;

  for (let i = 1; i < steps.length; i++) {
    const prevDate = new Date(steps[i - 1].date);
    const currDate = new Date(steps[i].date);

    if (
      isNaN(prevDate.getTime()) ||
      isNaN(currDate.getTime()) ||
      currDate < prevDate
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Genera la rappresentazione JSON canonica e deterministica
 * dei campi selezionati del passaporto.
 *
 * Include createdBy, in modo che l'identificativo dell'autore
 * partecipi al calcolo dell'hash insieme agli altri campi selezionati.
 */
const generatePassportDataString = (passportData) => {
  const doc =
    passportData && typeof passportData.toObject === 'function'
      ? passportData.toObject()
      : (passportData || {});

  // Gestisce sia un identificativo semplice sia un documento popolato.
  const createdByValue =
    doc.createdBy &&
    typeof doc.createdBy === 'object' &&
    doc.createdBy._id
      ? doc.createdBy._id
      : doc.createdBy;

  const normalized = {
    productId: String(doc.productId || '').trim(),
    brand: String(doc.brand || '').trim(),
    name: String(doc.name || '').trim(),
    composition: String(doc.composition || '').trim(),

    // MODIFICA: include l'identificativo dell'autore nell'hash.
    createdBy: String(createdByValue || '').trim(),

    productDetails: {
      color: String(doc.productDetails?.color || 'N/D'),
      weight: String(doc.productDetails?.weight || 'N/D'),
      careInstructions: String(
        doc.productDetails?.careInstructions ||
          'Lavare a mano o a 30°C con ciclo delicati.'
      ),
      notes: String(doc.productDetails?.notes || '')
    },

    environmentalAssessment: {
      carbonFootprintKg: Number(
        doc.environmentalAssessment?.carbonFootprintKg || 0
      ),
      waterFootprintLiters: Number(
        doc.environmentalAssessment?.waterFootprintLiters || 0
      ),
      globalWarmingReduction: Number(
        doc.environmentalAssessment?.globalWarmingReduction || 0
      ),
      waterScarcityReduction: Number(
        doc.environmentalAssessment?.waterScarcityReduction || 0
      )
    },

    regenerationSteps: Array.isArray(doc.regenerationSteps)
      ? doc.regenerationSteps.map((step) => ({
          process: String(step.process || '').trim(),
          location: String(step.location || '').trim(),
          coordinates: normalizeCoordinates(step.coordinates),
          date: step.date
            ? new Date(step.date).toISOString().split('T')[0]
            : ''
        }))
      : []
  };

  return JSON.stringify(normalized);
};

/**
 * Lettura dell'hash registrato on-chain.
 */
const fetchOnChainHash = async (productId) => {
  if (!passportContract) {
    throw new Error('Istanza del contratto non configurata.');
  }

  if (typeof passportContract.getPassport === 'function') {
    const result = await passportContract.getPassport(productId);
    return result.dataHash || result[0];
  } else if (typeof passportContract.getPassportHash === 'function') {
    return await passportContract.getPassportHash(productId);
  }

  throw new Error(
    "Metodo per la lettura del passaporto non presente nell'ABI."
  );
};

// ============================================================
// CREAZIONE DI UN NUOVO PASSAPORTO DIGITALE
// ============================================================

exports.createPassport = async (req, res) => {
  try {
    const {
      productId,
      brand,
      name,
      composition,
      productDetails,
      environmentalAssessment,
      regenerationSteps
    } = req.body;

    const existingPassport = await Passport.findOne({ productId });

    if (existingPassport) {
      return res.status(400).json({
        success: false,
        message: `L'ID Prodotto "${productId}" è già registrato nel sistema. Scegli un ID univoco.`
      });
    }

    // Controllo di coerenza cronologica delle fasi inserite alla creazione.
    if (
      regenerationSteps &&
      !validateStepsChronology(regenerationSteps)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Incongruenza temporale nelle fasi di filiera: ciascuna fase deve avere una data successiva o uguale alla precedente.'
      });
    }

    const userId = req.user
      ? (req.user.userId || req.user._id)
      : null;

    const newPassport = new Passport({
      productId,
      brand,
      name,
      composition,
      productDetails: {
        color: productDetails?.color || 'N/D',
        weight: productDetails?.weight || 'N/D',
        careInstructions:
          productDetails?.careInstructions ||
          'Lavare a mano o a 30°C con ciclo delicati.',
        notes: productDetails?.notes || ''
      },
      environmentalAssessment,
      regenerationSteps: regenerationSteps || [],
      createdBy: userId
    });

    let txHash = null;
    let notarizationError = null;

    // Notarizzazione on-chain.
    if (passportContract) {
      try {
        const dataString = generatePassportDataString(newPassport);
        const dataHash = ethers.id(dataString);

        const tx = await passportContract.notarizePassport(
          productId,
          dataHash
        );

        const receipt = await tx.wait();
        txHash = receipt.hash;

        newPassport.blockchainTxHash = txHash;
        newPassport.contractAddress = contractAddress;
      } catch (bcError) {
        notarizationError =
          bcError.message || 'Errore sconosciuto on-chain';

        console.error(
          'Errore notarizzazione blockchain:',
          notarizationError
        );
      }
    }

    await newPassport.save();

    return res.status(201).json({
      success: true,
      message: txHash
        ? 'Passaporto Digitale creato e notarizzato con successo!'
        : 'Passaporto salvato su DB, ma notarizzazione blockchain non completata.',
      data: newPassport,
      txHash: txHash,
      notarizationWarning: notarizationError
    });
  } catch (error) {
    console.error('Errore creazione passaporto:', error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Errore durante il salvataggio nel database.'
    });
  }
};

// ============================================================
// RECUPERO DATI PASSAPORTO
// ============================================================

exports.getPassportById = async (req, res) => {
  try {
    const id = req.params.productId || req.params.id;
    const passport = await Passport.findOne({ productId: id });

    if (!passport) {
      return res.status(404).json({
        success: false,
        message: 'Passaporto non trovato.'
      });
    }

    return res.status(200).json({
      success: true,
      data: passport
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.message || 'Errore nel recupero del passaporto.'
    });
  }
};

exports.getPublicPassportById = exports.getPassportById;

// ============================================================
// AGGIUNTA DI UNA FASE E AGGIORNAMENTO DELL'HASH ON-CHAIN
// ============================================================

exports.addRegenerationStep = async (req, res) => {
  try {
    const id = req.params.productId || req.params.id;

    const {
      process: stepProcess,
      location,
      coordinates,
      date
    } = req.body;

    if (!stepProcess || !location || !date) {
      return res.status(400).json({
        success: false,
        message: 'Processo, luogo e data sono obbligatori.'
      });
    }

    // Blocco se il contratto o il wallet non sono inizializzati.
    if (!passportContract) {
      return res.status(503).json({
        success: false,
        message:
          'Verifica blockchain non disponibile: smart contract non inizializzato. Operazione bloccata.'
      });
    }

    const passport = await Passport.findOne({ productId: id });

    if (!passport) {
      return res.status(404).json({
        success: false,
        message: 'Passaporto non trovato.'
      });
    }

    // Controllo autorizzazioni.
    const productOwnerId = passport.createdBy
      ? passport.createdBy.toString()
      : '';

    const currentUserId = req.user
      ? (req.user.userId || req.user._id)?.toString()
      : '';

    const isOwner =
      productOwnerId && productOwnerId === currentUserId;

    const isSuperAdmin =
      req.user && req.user.role === 'superadmin';

    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message:
          'Accesso negato: Non disponi dei permessi necessari per modificare questo passaporto.'
      });
    }

    // Controllo cronologico: la nuova fase non può precedere l'ultima.
    if (
      Array.isArray(passport.regenerationSteps) &&
      passport.regenerationSteps.length > 0
    ) {
      const lastStep =
        passport.regenerationSteps[
          passport.regenerationSteps.length - 1
        ];

      const prevDate = new Date(lastStep.date);
      const newStepDate = new Date(date);

      if (
        !isNaN(prevDate.getTime()) &&
        !isNaN(newStepDate.getTime()) &&
        newStepDate < prevDate
      ) {
        const formattedPrevDate = prevDate
          .toISOString()
          .split('T')[0];

        return res.status(400).json({
          success: false,
          message: `Incongruenza temporale: la data inserita (${date}) non può essere antecedente all'ultima fase registrata (${formattedPrevDate}).`
        });
      }
    }

    // Lettura dell'hash on-chain.
    // In caso di errore RPC, l'operazione viene bloccata.
    let onChainHash = null;

    try {
      onChainHash = await fetchOnChainHash(passport.productId);
    } catch (contractErr) {
      console.error(
        'Errore verifica stato on-chain:',
        contractErr.message
      );

      return res.status(503).json({
        success: false,
        message:
          'Impossibile verificare lo stato on-chain su blockchain (nodo RPC non disponibile). Operazione bloccata per sicurezza.'
      });
    }

    // Verifica dei dati attuali del database.
    const preDataString = generatePassportDataString(passport);
    const preCalculatedHash = ethers.id(preDataString);

    const isValidHexHash =
      typeof onChainHash === 'string' &&
      ethers.isHexString(onChainHash, 32);

    const isNotZeroHash = onChainHash !== ethers.ZeroHash;

    if (!isValidHexHash || !isNotZeroHash) {
      return res.status(409).json({
        success: false,
        message:
          'Operazione interrotta: il passaporto non risulta notarizzato on-chain o l\'hash registrato non è valido. Impossibile aggiungere nuove fasi.'
      });
    }

    if (
      onChainHash.toLowerCase() !==
      preCalculatedHash.toLowerCase()
    ) {
      return res.status(409).json({
        success: false,
        message:
          'Operazione interrotta: Rilevata discrepanza tra il database e l\'hash on-chain. Integrità compromessa o stato disallineato.'
      });
    }

    // Costruzione della nuova fase.
    const newStep = {
      process: stepProcess,
      location,
      coordinates: normalizeCoordinates(coordinates),
      date
    };

    // Simulazione del nuovo stato in memoria per calcolare l'hash successivo.
    const simulatedDoc = passport.toObject();

    simulatedDoc.regenerationSteps = [
      ...simulatedDoc.regenerationSteps,
      newStep
    ];

    const updatedDataString =
      generatePassportDataString(simulatedDoc);

    const newDataHash = ethers.id(updatedDataString);

    let txHash = null;

    // Notarizzazione su blockchain prima del salvataggio su MongoDB.
    try {
      const tx = await passportContract.notarizePassport(
        passport.productId,
        newDataHash
      );

      const receipt = await tx.wait();
      txHash = receipt.hash;
    } catch (bcError) {
      console.error(
        'Errore transazione blockchain:',
        bcError.message || bcError
      );

      return res.status(502).json({
        success: false,
        message:
          'Notarizzazione su blockchain fallita. Nessuna modifica salvata nel database.',
        error: bcError.message
      });
    }

    // Salvataggio su MongoDB solo dopo la conferma della transazione.
    passport.regenerationSteps.push(newStep);
    passport.blockchainTxHash = txHash;

    await passport.save();

    return res.status(200).json({
      success: true,
      message: 'Nuova fase aggiunta e notarizzata con successo!',
      data: passport,
      txHash: txHash
    });
  } catch (error) {
    console.error('Errore aggiunta fase:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.addStep = exports.addRegenerationStep;

// ============================================================
// VERIFICA CRITTOGRAFICA DEL PASSAPORTO
// ============================================================

exports.verifyPassport = async (req, res) => {
  try {
    const id = req.params.productId || req.params.id;
    const passport = await Passport.findOne({ productId: id });

    if (!passport) {
      return res.status(404).json({
        success: false,
        message: 'Passaporto non trovato su MongoDB.'
      });
    }

    if (!passportContract) {
      return res.status(503).json({
        success: false,
        message:
          'Contratto Blockchain non connesso o configurato.'
      });
    }

    // Calcolo dell'hash dei dati
    const currentDataString =
      generatePassportDataString(passport);

    const calculatedHash = ethers.id(currentDataString);

    let onChainHash = null;
    let blockTimestamp = null;

    try {
      if (typeof passportContract.getPassport === 'function') {
        const result = await passportContract.getPassport(
          passport.productId
        );

        onChainHash = result.dataHash || result[0];
        blockTimestamp = result.timestamp || result[1];
      } else if (
        typeof passportContract.getPassportHash === 'function'
      ) {
        onChainHash = await passportContract.getPassportHash(
          passport.productId
        );
      }
    } catch (contractError) {
      return res.status(200).json({
        success: true,
        productId: passport.productId,
        isValid: false,
        notarized: false,
        message:
          'Passaporto presente su database, ma non registrato su Polygon.',
        calculatedHash: calculatedHash,
        onChainHash: null
      });
    }

    const isNotarized = Boolean(
      onChainHash && onChainHash !== ethers.ZeroHash
    );

    const isValid =
      isNotarized &&
      calculatedHash.toLowerCase() ===
        onChainHash.toLowerCase();

    return res.status(200).json({
      success: true,
      productId: passport.productId,
      isValid: isValid,
      notarized: isNotarized,
      txHash: passport.blockchainTxHash,
      contractAddress: contractAddress,
      calculatedHash: calculatedHash,
      onChainHash: onChainHash,
      timestamp: blockTimestamp
        ? Number(blockTimestamp)
        : null
    });
  } catch (error) {
    console.error(
      'Errore verifica blockchain:',
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Errore durante la verifica della notarizzazione on-chain.'
    });
  }
};
