import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { api } from '../../api/client';
import { detailOf } from '../../api/hooks';
import type { TokenResponse } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/Button';
import { colors, type } from '../../theme';
import { Field } from '../../components/Field';

export default function RegisterScreen() {
  const { signIn } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = name.trim().length >= 2 && email.includes('@') && password.length >= 8;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api<TokenResponse>('/api/auth/register', {
        method: 'POST',
        body: { full_name: name.trim(), email: email.trim(), password },
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
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>Back to sign in</Text>
        </Pressable>
        <Text style={styles.title}>Make an account</Text>
        <Text style={styles.lede}>Your cart, orders and delivery updates live here. Passwords need at least 8 characters.</Text>
        <View style={styles.form}>
          <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button label="Create account" onPress={submit} loading={submitting} disabled={!valid} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  wrap: { padding: 24, paddingTop: 64, gap: 14 },
  back: { ...type.small, color: colors.leaf, fontWeight: '700' },
  title: { ...type.display, marginTop: 12 },
  lede: { ...type.body, color: colors.inkSoft, marginBottom: 10 },
  form: { gap: 14 },
  error: { ...type.small, color: colors.danger, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10 },
});
