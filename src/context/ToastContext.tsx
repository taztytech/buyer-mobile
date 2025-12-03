import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastType } from '@/components/Toast';

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('success');

  const showToast = useCallback((toastMessage: string, toastType: ToastType) => {
    setMessage(toastMessage);
    setType(toastType);
    setVisible(true);
  }, []);

  const showSuccess = useCallback((toastMessage: string) => {
    showToast(toastMessage, 'success');
  }, [showToast]);

  const showError = useCallback((toastMessage: string) => {
    showToast(toastMessage, 'error');
  }, [showToast]);

  const handleHide = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError }}>
      {children}
      <Toast
        visible={visible}
        message={message}
        type={type}
        onHide={handleHide}
        duration={3000}
      />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};




