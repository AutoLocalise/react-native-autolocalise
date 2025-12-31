import React from "react";
import { Text, TextStyle } from "react-native";
import { useAutoTranslate } from "../context/TranslationContext";
import { extractTextAndStyles, restoreStyledText } from "../utils/textFormatting";

/**
 * FormattedText is a component that handles nested text formatting during translation.
 * It preserves styling and structure of nested Text components while allowing the content
 * to be translated.
 *
 * @example
 * ```tsx
 * <FormattedText>
 *   Hello, <Text style={{ color: 'red' }}>world</Text>!
 * </FormattedText>
 * ```
 */
interface FormattedTextProps {
  children: React.ReactNode;
  style?: TextStyle;
  /**
   * Whether to persist the text for review in the dashboard.
   * @default true
   */
  persist?: boolean;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
  children,
  style,
  persist = true,
}) => {
  const { t } = useAutoTranslate();

  const { text, styles } = extractTextAndStyles(children);
  const translatedText = t(text, persist);

  return <Text style={style}>{restoreStyledText(translatedText, styles)}</Text>;
};
