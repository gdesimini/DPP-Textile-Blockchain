const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Recupero l'header Authorization nel formato standard "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Se la richiesta non include il token, blocco l'accesso
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Accesso negato: Nessun token di autenticazione fornito.' 
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({
      success: false,
      message: 'Configurazione server incompleta: JWT_SECRET mancante.'
    });
  }

  try {
    // Verifico la validità della firma e la scadenza del token JWT
    const verified = jwt.verify(token, secret);
    
    // Salvo il payload decodificato (userId, email, role) nell'oggetto req per i controller
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({ 
      success: false, 
      message: 'Token non valido o scaduto.' 
    });
  }
};