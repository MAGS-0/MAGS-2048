import React, { createContext, useState } from 'react';

export const AdContext = createContext();

export const AdProvider = ({ children }) => {
  const [adLoaded, setAdLoaded] = useState(false);

  return (
    <AdContext.Provider value={{ adLoaded, setAdLoaded }}>
      {children}
    </AdContext.Provider>
  );
};