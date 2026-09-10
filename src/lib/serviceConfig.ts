export function serviceUrl(value: string | undefined): string {
  if (!value?.trim()) return '';
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Service URLs must be HTTP(S), without credentials, query strings or fragments.');
  return url.toString().replace(/\/$/, '');
}
export const predictionApiBase = serviceUrl(import.meta.env.VITE_PREDICTION_API_URL);
export const streamlitBase = serviceUrl(import.meta.env.VITE_STREAMLIT_URL);
