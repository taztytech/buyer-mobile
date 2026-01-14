import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Snackbar, SnackbarProps } from '@/components/Snackbar';

interface SnackbarConfig {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

interface SnackbarContextType {
  showSnackbar: (config: SnackbarConfig) => void;
  hideSnackbar: () => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }
  return context;
};

interface SnackbarProviderProps {
  children: ReactNode;
}

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<SnackbarConfig>({
    message: '',
    type: 'info',
    duration: 3000,
  });

  const showSnackbar = (newConfig: SnackbarConfig) => {
    setConfig({
      message: newConfig.message,
      type: newConfig.type || 'info',
      duration: newConfig.duration !== undefined ? newConfig.duration : 3000,
    });
    setVisible(true);
  };

  const hideSnackbar = () => {
    setVisible(false);
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, hideSnackbar }}>
      {children}
      <Snackbar
        visible={visible}
        message={config.message}
        type={config.type}
        duration={config.duration}
        onDismiss={hideSnackbar}
      />
    </SnackbarContext.Provider>
  );
};
