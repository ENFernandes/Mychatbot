import React from 'react';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }>
  = ({ children, fallback }) => {
  const { token } = useAuth();
  if (!token) return <>{fallback || null}</>;
  return <>{children}</>;
};

export default ProtectedRoute;


