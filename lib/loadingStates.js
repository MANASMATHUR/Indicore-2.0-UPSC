'use client';

import { useState, useEffect, useRef } from 'react';



export const LoadingStates = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error',
  RETRYING: 'retrying'
};

export const LoadingTypes = {
  CHAT_MESSAGE: 'chat_message',
  SPEECH_SYNTHESIS: 'speech_synthesis',
  SPEECH_RECOGNITION: 'speech_recognition',
  FILE_UPLOAD: 'file_upload',
  TRANSLATION: 'translation',
  API_REQUEST: 'api_request'
};

export function useLoadingState(initialState = LoadingStates.IDLE) {
  const [state, setState] = useState(initialState);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setErrorState] = useState(null);
  const timeoutRef = useRef(null);

  const setLoading = (loadingMessage = '', progressValue = 0) => {
    setState(LoadingStates.LOADING);
    setMessage(loadingMessage);
    setProgress(progressValue);
    setErrorState(null);
  };

  const setSuccess = (successMessage = '') => {
    setState(LoadingStates.SUCCESS);
    setMessage(successMessage);
    setProgress(100);
    setErrorState(null);
    
    // Auto-clear success state after 2 seconds
    timeoutRef.current = setTimeout(() => {
      setState(LoadingStates.IDLE);
      setMessage('');
      setProgress(0);
    }, 2000);
  };

  const setError = (errorMessage, errorObj = null) => {
    setState(LoadingStates.ERROR);
    setMessage(errorMessage);
    setProgress(0);
    setErrorState(errorObj);
    
    // Auto-clear error state after 5 seconds
    timeoutRef.current = setTimeout(() => {
      setState(LoadingStates.IDLE);
      setMessage('');
      setErrorState(null);
    }, 5000);
  };

  const setRetrying = (retryMessage = '') => {
    setState(LoadingStates.RETRYING);
    setMessage(retryMessage);
    setErrorState(null);
  };

  const updateProgress = (progressValue, progressMessage = '') => {
    setProgress(Math.min(100, Math.max(0, progressValue)));
    if (progressMessage) {
      setMessage(progressMessage);
    }
  };

  const reset = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState(LoadingStates.IDLE);
    setMessage('');
    setProgress(0);
    setErrorState(null);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    state,
    progress,
    message,
    error,
    isLoading: state === LoadingStates.LOADING,
    isSuccess: state === LoadingStates.SUCCESS,
    isError: state === LoadingStates.ERROR,
    isRetrying: state === LoadingStates.RETRYING,
    isIdle: state === LoadingStates.IDLE,
    setLoading,
    setSuccess,
    setError,
    setRetrying,
    updateProgress,
    reset
  };
}

/**
 * Professional Loading Spinner Component
 */
export function LoadingSpinner({ 
  size = 'medium', 
  type = 'spinner', 
  message = '', 
  progress = 0,
  className = '' 
}) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8',
    xlarge: 'w-12 h-12'
  };

  const spinnerClasses = {
    spinner: 'animate-spin',
    pulse: 'animate-pulse',
    bounce: 'animate-bounce',
    ping: 'animate-ping'
  };

  if (type === 'progress') {
    return (
      <div className={`flex flex-col items-center space-y-2 ${className}`}>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-red-500 to-red-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        {message && (
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {message}
          </p>
        )}
      </div>
    );
  }

  if (type === 'dots') {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
        {message && (
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${sizeClasses[size]} ${spinnerClasses[type]}`}>
        <svg className="w-full h-full text-red-500" fill="none" viewBox="0 0 24 24">
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {message && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {message}
        </span>
      )}
    </div>
  );
}

/**
 * Professional Status Indicator Component
 */
export function StatusIndicator({ 
  status, 
  message = '', 
  showIcon = true,
  className = '' 
}) {
  const statusConfig = {
    [LoadingStates.IDLE]: {
      icon: null,
      color: 'text-gray-500',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-200'
    },
    [LoadingStates.LOADING]: {
      icon: '⏳',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
    [LoadingStates.SUCCESS]: {
      icon: '✅',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    [LoadingStates.ERROR]: {
      icon: '❌',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    [LoadingStates.RETRYING]: {
      icon: '🔄',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    }
  };

  const config = statusConfig[status] || statusConfig[LoadingStates.IDLE];

  if (!message && !showIcon) return null;

  return (
    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${config.color} ${config.bgColor} ${config.borderColor} border ${className}`}>
      {showIcon && config.icon && (
        <span className="text-sm">{config.icon}</span>
      )}
      {message && (
        <span>{message}</span>
      )}
    </div>
  );
}

/**
 * Professional Progress Bar Component
 */
export function ProgressBar({ 
  progress = 0, 
  message = '', 
  showPercentage = true,
  size = 'medium',
  className = '' 
}) {
  const sizeClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3'
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        {message && (
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {message}
          </span>
        )}
        {showPercentage && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${sizeClasses[size]}`}>
        <div 
          className="bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Professional Toast Notification System
 */
export function useToastNotifications() {
  const [notifications, setNotifications] = useState([]);

  const addNotification = (notification) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification = {
      id,
      type: 'info',
      title: '',
      message: '',
      duration: 5000,
      ...notification
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration
    setTimeout(() => {
      removeNotification(id);
    }, newNotification.duration);

    return id;
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const success = (message, title = 'Success') => {
    return addNotification({ type: 'success', title, message });
  };

  const error = (message, title = 'Error') => {
    return addNotification({ type: 'error', title, message, duration: 7000 });
  };

  const warning = (message, title = 'Warning') => {
    return addNotification({ type: 'warning', title, message, duration: 6000 });
  };

  const info = (message, title = 'Info') => {
    return addNotification({ type: 'info', title, message });
  };

  return {
    notifications,
    addNotification,
    removeNotification,
    success,
    error,
    warning,
    info
  };
}

export default {
  LoadingStates,
  LoadingTypes,
  useLoadingState,
  LoadingSpinner,
  StatusIndicator,
  ProgressBar,
  useToastNotifications
};
