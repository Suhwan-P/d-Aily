// 오늘의 요약 문장을 보여주는 화면
// 지금은 mock 요약(문답을 이어붙인 것)을 보여주고, 나중에 AI 응답으로 교체

import { View, Text, StyleSheet } from 'react-native';

type Props = {
  summary: string;
};

export default function SummaryView({ summary }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>오늘의 요약</Text>
      <Text style={styles.summary}>{summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#eef6ff', padding: 16, borderRadius: 10, marginVertical: 16 },
  label: { fontSize: 14, color: '#007AFF', fontWeight: 'bold', marginBottom: 6 },
  summary: { fontSize: 16, lineHeight: 22 },
});
