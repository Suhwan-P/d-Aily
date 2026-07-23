// 질문 하나를 보여주고 답변을 입력받는 카드
// AI 붙기 전까지는 question을 props로 그냥 넘겨받아서 사용 (mock)

import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

type Props = {
  question: string;
  onAnswer: (response: string) => void; // 답변 확정될 때 부모에게 알려줌
};

export default function QuestionCard({ question, onAnswer }: Props) {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (text.trim() === '') return;
    onAnswer(text);
    setText('');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.question}>{question}</Text>
      <TextInput
        style={styles.input}
        placeholder="짧게 답해보세요"
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSubmit}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#f9f9f9', padding: 16, borderRadius: 10, marginBottom: 12 },
  question: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
});
