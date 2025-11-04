import Toast from 'react-native-toast-message';

export type ToastType = 'success' | 'error' | 'info';

type ToastOptions = {
  type?: ToastType;
  title: string;
  message?: string;
};

export function showToast({ type = 'info', title, message }: ToastOptions) {
  Toast.show({
    type,
    text1: title,
    text2: message,
    position: 'top',
    visibilityTime: 4000,
    autoHide: true,
    topOffset: 60,
  });
}

export const toast = {
  info: (title: string, message?: string) =>
    showToast({ type: 'info', title, message }),
  success: (title: string, message?: string) =>
    showToast({ type: 'success', title, message }),
  error: (title: string, message?: string) =>
    showToast({ type: 'error', title, message }),
};
