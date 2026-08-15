import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../theme/ThemeProvider';
import { useLocalization } from '../../i18n';

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}

/** iOS UISearchBar clone — rounded fill, inline glyph, clear button. */
export const SearchBar: React.FC<Props> = ({ value, onChangeText, placeholder }) => {
  const { colors, typography, radius } = useTheme();
  const { t, rtl } = useLocalization();

  return (
    <View style={styles.wrap}>
      <View style={[styles.field, { backgroundColor: colors.searchField, borderRadius: radius.md }]}>
        <Ionicons name="search" size={17} color={colors.placeholder} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? t('searchPlaceholder')}
          placeholderTextColor={colors.placeholder}
          style={[
            typography.body,
            styles.input,
            { color: colors.label, textAlign: rtl ? 'right' : 'left' },
          ]}
          returnKeyType="search"
          clearButtonMode="never"
          accessibilityLabel={t('search')}
        />
        {value.length > 0 && (
          <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button">
            <Ionicons name="close-circle" size={17} color={colors.placeholder} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 36 },
  input: { flex: 1, padding: 0, ...(({ outlineStyle: 'none' } as unknown) as object) },
});

export default SearchBar;
