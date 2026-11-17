const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Autenticazione utente
router.post('/login', authController.login);

// Accreditamento nuovo produttore (riservato a SuperAdmin / Ente Certificatore)
router.post('/register-brand', authMiddleware, authController.registerBrand);

// Aggiornamento password obbligatorio al primo accesso
router.post('/change-password', authMiddleware, authController.changePassword);

module.exports = router;