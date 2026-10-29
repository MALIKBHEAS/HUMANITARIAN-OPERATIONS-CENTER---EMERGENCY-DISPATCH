import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session from localStorage
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('eoc_auth_token');
      const storedUser = localStorage.getItem('eoc_auth_user');
      if (storedToken && storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (err) {
      console.warn('Failed to restore auth session:', err);
      localStorage.removeItem('eoc_auth_token');
      localStorage.removeItem('eoc_auth_user');
    } finally {
      setLoading(false);
    }
  }, []);

  // Frictionless SSO / Agency Passcode authentication
  const login = (token) => {
    if (!token || !token.trim()) {
      throw new Error('Valid agency ID or tactical passcode is required.');
    }

    const cleanToken = token.trim().toUpperCase();
    
    let callSign = 'DISPATCH-COMMANDER';
    let agency = 'TACTICAL EMERGENCY OPS';

    if (cleanToken.includes('HEBRON') || cleanToken.includes('PAL')) {
      callSign = 'AL-KHALIL-EOC';
      agency = 'CIVIL DEFENSE PALESTINE';
    } else if (cleanToken.includes('TOKYO')) {
      callSign = 'TOKYO-EOC';
      agency = 'DISASTER PREVENTION TOKYO';
    } else if (cleanToken.includes('MADRID')) {
      callSign = 'MADRID-112';
      agency = 'PROTECCION CIVIL MADRID';
    } else if (cleanToken.includes('NY')) {
      callSign = 'NY-OPS';
      agency = 'NYC EMERGENCY MANAGEMENT';
    }

    const userData = {
      token: cleanToken,
      callSign,
      agency,
      terminalId: `TERM-${Math.floor(1000 + Math.random() * 9000)}`,
      authenticatedAt: new Date().toISOString(),
    };

    localStorage.setItem('eoc_auth_token', cleanToken);
    localStorage.setItem('eoc_auth_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('eoc_auth_token');
    localStorage.removeItem('eoc_auth_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
