const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // Hash generato con bcrypt (salt a 10 round)
  password: {
    type: String,
    required: true
  },
  // Ruoli ammessi nel sistema di autorizzazione RBAC
  role: {
    type: String,
    enum: ['superadmin', 'brand'], 
    default: 'brand',
    required: true
  },
  // Flag di sicurezza: impone la modifica della password provvisoria al primo accesso
  isFirstLogin: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true 
});

module.exports = mongoose.model('User', userSchema);