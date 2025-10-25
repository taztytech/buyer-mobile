import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '@/services/storage.service';

export type VegModeType = 'off' | 'pure' | 'all';

interface VegModeContextType {
  vegMode: VegModeType;
  setVegMode: (mode: VegModeType) => Promise<void>;
  isVegModeEnabled: boolean;
}

const VegModeContext = createContext<VegModeContextType | undefined>(undefined);

export const VegModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vegMode, setVegModeState] = useState<VegModeType>('off');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load veg mode preference from storage on mount
  useEffect(() => {
    const loadVegMode = async () => {
      try {
        const savedMode = await storageService.getVegMode();
        if (savedMode) {
          setVegModeState(savedMode as VegModeType);
        }
      } catch (error) {
        console.error('Error loading veg mode:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadVegMode();
  }, []);

  const setVegMode = async (mode: VegModeType) => {
    try {
      setVegModeState(mode);
      await storageService.saveVegMode(mode);
    } catch (error) {
      console.error('Error saving veg mode:', error);
    }
  };

  const isVegModeEnabled = vegMode !== 'off';

  // Don't render children until veg mode is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <VegModeContext.Provider value={{ vegMode, setVegMode, isVegModeEnabled }}>
      {children}
    </VegModeContext.Provider>
  );
};

export const useVegMode = () => {
  const context = useContext(VegModeContext);
  if (context === undefined) {
    throw new Error('useVegMode must be used within a VegModeProvider');
  }
  return context;
};
