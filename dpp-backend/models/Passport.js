const mongoose = require('mongoose');

const passportSchema = new mongoose.Schema({
  // Identificativo univoco del prodotto (usato come chiave on-chain)
  productId: { type: String, required: true, unique: true, trim: true },
  brand: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true },
  composition: { type: String, required: true, trim: true },
  
  // Dettagli tecnici e istruzioni per l'utente finale
  productDetails: {
    color: { type: String, default: 'N/D' },
    weight: { type: String, default: 'N/D' },
    careInstructions: { type: String, default: 'Lavare a mano o a 30°C con ciclo delicati.' },
    notes: { type: String, default: '' }
  },

  // Indicatori di impatto ambientale (LCA)
  environmentalAssessment: {
    carbonFootprintKg: { type: Number, default: 2.94 },
    waterFootprintLiters: { type: Number, default: 126 },
    globalWarmingReduction: { type: Number, default: 87 },
    waterScarcityReduction: { type: Number, default: 80 },
    equivalencies: {
      ledBulbs: { type: Number, default: 984 },
      waterBottles: { type: Number, default: 77.6 }
    }
  },

  // Fasi di filiera con coordinate geografiche per la visualizzazione su mappa Leaflet
  regenerationSteps: [{
    process: { type: String, required: true },
    location: { type: String, required: true },
    coordinates: {
      lat: Number,
      lng: Number
    },
    date: { type: String, required: true }
  }],

  // Hash della transazione registrata sul testnet Polygon Amoy
  blockchainTxHash: String,

  // Indirizzo dello Smart Contract associato alla notarizzazione
  contractAddress: String,

  // Riferimento al produttore che ha registrato il lotto
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Passport', passportSchema);