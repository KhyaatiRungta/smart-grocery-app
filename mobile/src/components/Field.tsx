import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, type } from '../theme';

export function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: 'default' | 'email-address';
  secureTextEntry?: boolean;
  autoComplete?: 'email' | 'password' | 'name' | 'postal-code' | 'off';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType}
        secureTextEntry={props.secureTextEntry}
        autoComplete={props.autoComplete}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={props.placeholder}
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...type.small, fontWeight: '600', color: colors.ink },
  input: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
});
