const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const passportRoutes = require('./routes/passportRoutes');
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware globali: abilitazione CORS e parsing del body JSON
app.use(cors());
app.use(express.json());

// Connessione al database MongoDB Atlas
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.error('Configurazione DB assente: MONGODB_URI non definita nel file .env');
} else {
  mongoose.connect(mongoUri)
    .then(() => console.log('Connessione a MongoDB completata.'))
    .catch((err) => console.error('Errore di connessione a MongoDB:', err.message));
}

// Registrazione degli endpoint RESTful
app.use('/api/passports', passportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);

// Gestione rotte non definite (404)
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Risorsa non trovata.' });
});

// Middleware centralizzato di gestione errori
app.use((err, req, res, next) => {
  console.error('Errore non gestito:', err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Errore interno del server.'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server attivo sulla porta ${PORT}`);
});