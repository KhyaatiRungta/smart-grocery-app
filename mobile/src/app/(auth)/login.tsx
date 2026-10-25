import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';

import { api } from '../../api/client';
import { detailOf } from '../../api/hooks';
import type { TokenResponse } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { colors, radius, type } from '../../theme';
import { Field } from '../../components/Field';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(nextEmail = email, nextPassword = password) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api<TokenResponse>('/api/auth/login', {
        method: 'POST',
        body: { email: nextEmail.trim(), password: nextPassword },
        auth: false,
      });
      await signIn(res.access_token, res.user);
    } catch (err) {
      setError(detailOf(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.mark}>🥕</Text>
          <Text style={styles.title}>Smart Grocer</Text>
          <Text style={styles.lede}>Fresh from the shelf nearest you, delivered before the kettle boils.</Text>
        </View>

        <View style={styles.form}>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label="Sign in" onPress={() => submit()} loading={submitting} disabled={!email || !password} />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEmail('demo@grocery.test');
              setPassword('demo1234');
              submit('demo@grocery.test', 'demo1234');
            }}
            style={styles.demo}
          >
            <Text style={styles.demoText}>Try the demo account</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.small}>New to Smart Grocer?</Text>
          <Link href="/register" asChild>
            <Pressable accessibilityRole="link">
              <Text style={styles.link}>Create an account</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: 24, paddingTop: 72, gap: 28, flexGrow: 1 },
  brand: { gap: 10 },
  mark: { fontSize: 44 },
  title: { ...type.display, fontSize: 40, lineHeight: 42 },
  lede: { ...type.body, color: colors.inkSoft, fontSize: 16, lineHeight: 23, maxWidth: 320 },
  form: { gap: 14 },
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
  error: { ...type.small, color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.sm },
  demo: { alignSelf: 'center', paddingVertical: 8 },
  demoText: { ...type.small, color: colors.leaf, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 'auto' },
  small: { ...type.small },
  link: { ...type.small, color: colors.leaf, fontWeight: '700' },
});
