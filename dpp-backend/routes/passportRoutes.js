const express = require('express');
const router = express.Router();
const passportController = require('../controllers/passportController');
const authMiddleware = require('../middleware/authMiddleware');

// Creazione e notarizzazione iniziale del passaporto digitale
router.post('/create', authMiddleware, passportController.createPassport);
router.post('/', authMiddleware, passportController.createPassport);

// Aggiunta di una nuova fase di trasformazione con controllo anti-manomissione (Pre-audit)
router.post('/:productId/step', authMiddleware, passportController.addRegenerationStep);

// Audit crittografico on-chain per la verifica di integrità del passaporto
router.get('/verify/:productId', passportController.verifyPassport);

// Consultazione pubblica del passaporto tramite identificativo univoco (aperta ai consumatori)
router.get('/public/:productId', passportController.getPassportById);
router.get('/:productId', passportController.getPassportById);

module.exports = router;