// 저장된 지난 기록들을 목록으로 보여줌

import { View, Text, FlatList, StyleSheet } from 'react-native';
import { JournalEntry } from '../types/journal';

type Props = {
  entries: JournalEntry[];
};

export default function HistoryList({ entries }: Props) {
  if (entries.length === 0) {
    return <Text style={styles.empty}>아직 기록이 없어요. 오늘의 첫 기록을 남겨보세요.</Text>;
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.date}>{item.date}</Text>
          <Text numberOfLines={2}>{item.summary}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  date: { fontSize: 12, color: '#888', marginBottom: 4 },
  empty: { textAlign: 'center', color: '#999', marginTop: 20 },
});
