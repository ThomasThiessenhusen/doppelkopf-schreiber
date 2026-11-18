import { Share } from 'react-native';

/**
 * Gibt einen Text (den KI-Prompt) weiter. Native: System-Teilen-Dialog, in
 * dem man z. B. eine KI-App waehlen kann. Das Gegenstueck ist
 * `sharePromptText.web.ts` (Zwischenablage); Metro waehlt per `.web`-Suffix.
 */
export async function sharePromptText(text: string): Promise<'shared' | 'copied' | 'cancelled'> {
  const result = await Share.share({ message: text });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
