const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET;

// Verifica criteri di robustezza: min. 8 caratteri, 1 maiuscola, 1 minuscola, 1 numero, 1 carattere speciale
const isPasswordStrong = (pwd) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
  return passwordRegex.test(pwd);
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Inserire email e password.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenziali non valide.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Credenziali non valide.' });
    }

    // Includo ruolo e id nel token per i controlli lato middleware
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      success: true,
      token,
      user: { 
        userId: user._id,
        name: user.name, 
        email: user.email, 
        role: user.role,
        isFirstLogin: user.isFirstLogin ?? false
      }
    });

  } catch (error) {
    console.error("Errore login:", error.message || error);
    return res.status(500).json({ success: false, message: 'Errore interno del server durante il login.' });
  }
};

// Registrazione del produttore riservata al SuperAdmin
exports.registerBrand = async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Accesso negato: Solo il Super Admin può registrare nuovi brand.' });
    }

    const { brandName, email, password } = req.body;

    if (!brandName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Tutti i campi sono obbligatori.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const existingBrand = await User.findOne({ email: cleanEmail });
    if (existingBrand) {
      return res.status(400).json({ success: false, message: 'Un brand con questa email esiste già.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // isFirstLogin serve per obbligare il produttore a cambiare password al primo accesso
    const newBrand = new User({
      name: brandName,
      email: cleanEmail,
      password: hashedPassword,
      role: 'brand',
      isFirstLogin: true
    });

    await newBrand.save();

    return res.json({
      success: true,
      message: `Produttore "${brandName}" registrato con successo!`,
      brand: { name: newBrand.name, email: newBrand.email }
    });

  } catch (error) {
    console.error("Errore registrazione produttore:", error.message || error);
    return res.status(500).json({ success: false, message: 'Errore interno durante la registrazione.' });
  }
};

// Cambio password obbligatorio al primo accesso con controlli di complessità e unicità
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Inserire sia la vecchia che la nuova password.' });
    }

    // Vincolo: la nuova password non può coincidere con la provvisoria
    if (oldPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'La nuova password deve essere diversa da quella temporanea precedente.'
      });
    }

    // Vincolo di robustezza formale
    if (!isPasswordStrong(newPassword)) {
      return res.status(400).json({
        success: false,
        message: 'La nuova password deve contenere almeno 8 caratteri, una lettera maiuscola, una minuscola, un numero e un carattere speciale.'
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato.' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'La password temporanea non è corretta.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.isFirstLogin = false; // Rimuovo il vincolo di primo accesso
    await user.save();

    return res.json({
      success: true,
      message: 'Password aggiornata con successo!'
    });

  } catch (error) {
    console.error("Errore cambio password:", error.message || error);
    return res.status(500).json({ success: false, message: 'Errore interno durante il cambio password.' });
  }
};