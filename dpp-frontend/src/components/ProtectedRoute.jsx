import React from 'react';
import { Navigate } from 'react-router-dom';

// Protezione delle rotte basata su token JWT e ruoli ammessi
const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('dpp_token');
  const user = JSON.parse(localStorage.getItem('dpp_user') || '{}');

  // Se l'utente non è autenticato, reindirizza al login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Se il ruolo dell'utente non è tra quelli autorizzati per questa rotta, reindirizza
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'brand' ? '/create' : '/'} replace />;
  }

  return children;
};

export default ProtectedRoute;