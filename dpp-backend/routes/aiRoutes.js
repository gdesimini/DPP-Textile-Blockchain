const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Endpoint per l'estrazione multimodale della composizione tessile
router.post('/analyze-material', aiController.handleUpload, aiController.analyzeMaterial);

module.exports = router;