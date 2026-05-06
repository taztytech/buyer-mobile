import React, { createContext, useContext, useState, useEffect } from 'react';
import { storageService } from '@/services/storage.service';

export type VegModeType = 'off' | 'pure' | 'all';

interface VegModeContextType {
  vegMode: VegModeType;
  setVegMode: (mode: VegModeType, remember?: boolean) => Promise<void>;
  isVegModeEnabled: boolean;
}

const VegModeContext = createContext<VegModeContextType | undefined>(undefined);

export const VegModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vegMode, setVegModeState] = useState<VegModeType>('off');

  // Load veg mode preference from storage on mount
  useEffect(() => {
    const loadVegMode = async () => {
      try {
        const savedMode = await storageService.getVegMode();
        // Validate that saved mode is a valid VegModeType
        if (savedMode && (savedMode === 'off' || savedMode === 'pure' || savedMode === 'all')) {
          setVegModeState(savedMode as VegModeType);
        }
      } catch (error) {
        // Silent fail
      }
    };

    loadVegMode();
  }, []);

  const setVegMode = async (mode: VegModeType, remember: boolean = true) => {
    try {
      setVegModeState(mode);
      // Only save to storage if remember is true
      if (remember) {
        await storageService.saveVegMode(mode);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const isVegModeEnabled = vegMode !== 'off';

  // Always render children so the tree (e.g. HomeScreen) stays mounted; skipping children until
  // isLoaded breaks hook ordering / Fast Refresh ("Should have a queue" / invalid hook call).
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
