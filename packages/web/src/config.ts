export interface FirebaseSettings {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

export interface LlmSettings {
  endpoint: string;
  /** Present only when calling OpenRouter directly from the browser (dev). Use a proxy in production. */
  apiKey: string | null;
  model: string;
  viaProxy: boolean;
}

export interface AppConfig {
  firebase: FirebaseSettings | null;
  llm: LlmSettings | null;
  /** Local development without Firebase: allows a clearly-labelled guest session. Never true in production builds. */
  devGuest: boolean;
}

type Env = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function readConfig(env: Env = import.meta.env as unknown as Env): AppConfig {
  const apiKey = str(env.VITE_FIREBASE_API_KEY);
  const authDomain = str(env.VITE_FIREBASE_AUTH_DOMAIN);
  const projectId = str(env.VITE_FIREBASE_PROJECT_ID);
  const appId = str(env.VITE_FIREBASE_APP_ID);
  const firebase = apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : null;

  const proxy = str(env.VITE_LLM_PROXY_URL);
  const key = str(env.VITE_OPENROUTER_KEY);
  const model = str(env.VITE_LLM_MODEL) || 'openrouter/free';
  let llm: LlmSettings | null = null;
  if (proxy) llm = { endpoint: proxy, apiKey: null, model, viaProxy: true };
  else if (key) llm = { endpoint: 'https://openrouter.ai/api/v1/chat/completions', apiKey: key, model, viaProxy: false };

  return { firebase, llm, devGuest: env.DEV === true && !firebase };
}

export const config: AppConfig = readConfig();
