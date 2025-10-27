import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ConfirmationModal } from '@/components/ConfirmationModal';

interface ConfirmationConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmButtonColor?: string;
  cancelButtonColor?: string;
  confirmTextColor?: string;
  cancelTextColor?: string;
  showRibbon?: boolean;
}

interface ConfirmationContextType {
  showConfirmation: (config: ConfirmationConfig) => void;
  hideConfirmation: () => void;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within ConfirmationProvider');
  }
  return context;
};

interface ConfirmationProviderProps {
  children: ReactNode;
}

export const ConfirmationProvider: React.FC<ConfirmationProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<ConfirmationConfig>({
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirmation = (newConfig: ConfirmationConfig) => {
    setConfig(newConfig);
    setVisible(true);
  };

  const hideConfirmation = () => {
    setVisible(false);
  };

  const handleConfirm = () => {
    config.onConfirm();
    hideConfirmation();
  };

  const handleCancel = () => {
    if (config.onCancel) {
      config.onCancel();
    }
    hideConfirmation();
  };

  return (
    <ConfirmationContext.Provider value={{ showConfirmation, hideConfirmation }}>
      {children}
      <ConfirmationModal
        visible={visible}
        title={config.title}
        message={config.message}
        confirmText={config.confirmText}
        cancelText={config.cancelText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        confirmButtonColor={config.confirmButtonColor}
        cancelButtonColor={config.cancelButtonColor}
        confirmTextColor={config.confirmTextColor}
        cancelTextColor={config.cancelTextColor}
        showRibbon={config.showRibbon}
      />
    </ConfirmationContext.Provider>
  );
};
