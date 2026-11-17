const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');

// Salvo temporaneamente i file in memoria come buffer senza scrivere su disco
const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Formato non supportato. Caricare solo file immagine.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite 5MB per file
  fileFilter: imageFilter
});

exports.handleUpload = (req, res, next) => {
  const uploadArray = upload.array('images', 3);
  uploadArray(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Errore caricamento: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

// Analisi multimodale dell'etichetta con Gemini per estrarre la composizione
exports.analyzeMaterial = async (req, res) => {
  try {
    let files = req.files;
    
    if (!files || files.length === 0) {
      if (req.file) {
        files = [req.file];
      } else {
        return res.status(400).json({ success: false, message: 'Nessuna immagine caricata.' });
      }
    }

    const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        success: false, 
        error: 'Chiave API non configurata nel file .env (GOOGLE_CLOUD_API_KEY o GEMINI_API_KEY).' 
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Preparazione dei payload immagine nel formato canonico inlineData
    const imageParts = files.map((file) => ({
      inlineData: {
        mimeType: file.mimetype || 'image/jpeg',
        data: file.buffer.toString('base64')
      }
    }));

    // Regole tassative di estrazione per evitare testi discorsivi
    const promptText = `
      Analizza le immagini fornite (etichetta o capo di abbigliamento).
      Il tuo unico obiettivo è identificare la COMPOSIZIONE DEI MATERIALI (es. percentuali o fibre tessili come Cotone, Poliestere, Lana, Elastan, Denim, ecc.).

      REGOLE TASSATIVE DI OUTPUT:
      1. Rispondi UNICAMENTE con le percentuali e il nome delle fibre/tessuti (es. '100% Cotone' oppure '80% Cotone, 20% Poliestere').
      2. NON inserire MAI parole tra parentesi come '(stimato)', '(approssimativo)', '(stimata)', '(probabile)'.
      3. NON inserire commenti, spiegazioni, premesse o note sull'etichetta.
      4. NON dire che cos'è l'oggetto (NON dire 'Questa è una felpa' o 'T-shirt').
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: [...imageParts, promptText]
    });

    let rawAnswer = response.text ? response.text.trim() : "Composizione non identificata";

    // Pulisco eventuali residui come (stimato) prima di restituire il dato al frontend
    let cleanAnswer = rawAnswer
      .replace(/\s*\([^)]*stimat[^)]*\)/gi, '')
      .replace(/\s*\([^)]*probabil[^)]*\)/gi, '')
      .trim();

    return res.status(200).json({
      success: true,
      composition: cleanAnswer
    });

  } catch (error) {
    console.error("Errore analisi Gemini:", error.message || error);
    return res.status(500).json({
      success: false,
      error: "Errore durante l'analisi dell'immagine."
    });
  }
};