import axios, { isAxiosError } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_PORT = Number(process.env.EXPO_PUBLIC_API_PORT ?? 3000);

function extractHost(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      return url.hostname || null;
    } catch {
      return null;
    }
  }

  return trimmed.split(':')[0] || null;
}

function isLocalLikeHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
  );
}

function normalizeExplicitBaseURL(rawBaseURL: string): string {
  const trimmed = rawBaseURL.trim();
  if (!trimmed) {
    return trimmed;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(candidate);

    if (!url.port && isLocalLikeHost(url.hostname)) {
      url.port = String(API_PORT);
    }

    if (Platform.OS === 'android' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
      url.hostname = '10.0.2.2';
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

function resolveBaseURL(): string {
  const explicitBaseURL = process.env.EXPO_PUBLIC_API_URL;
  if (explicitBaseURL) {
    return normalizeExplicitBaseURL(explicitBaseURL);
  }

  const hostFromExpoConfig = extractHost(Constants.expoConfig?.hostUri);
  const hostFromExperienceUrl = extractHost(Constants.experienceUrl);
  const hostFromLinkingUri = extractHost(Constants.linkingUri);

  const localHostCandidate =
    [hostFromExpoConfig, hostFromExperienceUrl, hostFromLinkingUri].find(
      (host): host is string => typeof host === 'string' && isLocalLikeHost(host)
    ) ?? null;

  if (localHostCandidate) {
    return `http://${localHostCandidate}:${API_PORT}`;
  }

  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
}

const baseURL = resolveBaseURL();

const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

if (__DEV__) {
  console.log(`[API] baseURL: ${baseURL}`);
}

// Session token, kept in memory and set by the AuthProvider.
let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Called when the API answers 401 (expired token or removed member). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(undefined, (error: unknown) => {
  const isAuthRoute = isAxiosError(error) && error.config?.url?.startsWith('/auth/');
  if (isAxiosError(error) && error.response?.status === 401 && authToken && !isAuthRoute) {
    onUnauthorized?.();
  }
  return Promise.reject(error);
});

export default api;

// Known API messages, shown in Portuguese.
const MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Invalid invite code': 'Codigo do grupo incorreto.',
  'Email already registered': 'Este email ja tem conta. Use Entrar.',
  'Invalid email or password': 'Email ou senha incorretos.',
  'Only group admins can do this': 'Somente administradores do grupo podem fazer isso.',
  'You cannot change your own account': 'Voce nao pode alterar a propria conta.',
  'ThrottlerException: Too Many Requests': 'Muitas tentativas. Aguarde um minuto e tente de novo.',
  'password must be at least 8 characters': 'A senha precisa ter pelo menos 8 caracteres.',
  'email must be an email': 'Email invalido.',
};

const translate = (message: string) => MESSAGE_TRANSLATIONS[message] ?? message;

/**
 * Best user-facing message for a failed request: the API's validation
 * message when there is one, otherwise `fallback`.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!isAxiosError(error)) {
    return fallback;
  }

  if (!error.response) {
    return 'Nao foi possivel conectar ao servidor. Verifique a conexao e tente de novo.';
  }

  const message = (error.response.data as { message?: unknown } | undefined)?.message;
  if (Array.isArray(message) && message.length > 0) {
    return message.map(translate).join('\n');
  }
  if (typeof message === 'string' && message) {
    return translate(message);
  }

  return fallback;
}
