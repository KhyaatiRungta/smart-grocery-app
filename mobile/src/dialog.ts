import { Alert, Platform } from 'react-native';

type DialogButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };

/**
 * Alert.alert on devices. React Native Web's Alert is a no-op, so the web build falls back to
 * window.alert / window.confirm, keeping confirmations and error messages visible in the browser.
 */
export function showDialog(title: string, message?: string, buttons: DialogButton[] = [{ text: 'OK' }]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const text = [title, message].filter(Boolean).join('\n\n');
  const action = buttons.find((b) => b.style !== 'cancel') ?? buttons[0];
  if (buttons.length <= 1) {
    window.alert(text);
    action?.onPress?.();
    return;
  }
  if (window.confirm(text)) action.onPress?.();
}
