import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../theme/ThemeProvider';
import { useLocalization, type LocaleCode } from '../../i18n';
import { haptics } from '../../utils/haptics';
import { Row, Section } from '../GroupedList';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Full-screen language chooser with live switching and RTL awareness. */
export const LanguagePicker: React.FC<Props> = ({ visible, onClose }) => {
  const { colors, typography } = useTheme();
  const { t, locale, isManual, languages, setLocale, useSystemLocale } = useLocalization();
  const insets = useSafeAreaInsets();

  const choose = (code: LocaleCode) => {
    haptics.selection();
    setLocale(code);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.groupedBackground, paddingTop: insets.top || 12 }]}>
        <View style={[styles.header, { borderBottomColor: colors.separator }]}>
          <Text style={[typography.headline, { color: colors.label }]}>{t('selectLanguage')}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" style={styles.close}>
            <Ionicons name="close-circle" size={26} color={colors.tertiaryLabel} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: insets.bottom + 32 }}>
          <Section footer={t('statusPrivacyNote') ? undefined : undefined}>
            <Row
              title={t('systemDefault')}
              icon="phone-portrait-outline"
              iconColor={colors.placeholder}
              selected={!isManual}
              onPress={() => {
                haptics.selection();
                useSystemLocale();
              }}
            />
          </Section>

          <Section header={t('language')}>
            {languages.map((lang) => (
              <Row
                key={lang.code}
                title={lang.nativeName}
                subtitle={lang.rtl ? `${lang.name} · RTL` : lang.name}
                accessory={<Text style={styles.flag}>{lang.flag}</Text>}
                selected={isManual && locale === lang.code}
                onPress={() => choose(lang.code)}
              />
            ))}
          </Section>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { position: 'absolute', right: 16 },
  flag: { fontSize: 22 },
});

export default LanguagePicker;
