// App.js를 App.tsx로 이름 바꾼 뒤, 이 내용으로 전체 교체
// blank 템플릿은 라우터가 없어서, 여기가 곧 앱의 시작점이자 유일한 화면

import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import QuestionCard from './components/QuestionCard';
import SummaryView from './components/SummaryView';
import HistoryList from './components/HistoryList';
import { useJournalStorage } from './hooks/useJournalStorage';
import { Answer, JournalEntry } from './types/journal';

// TODO: 나중에 이 배열을 AI가 생성한 질문으로 교체 (지금은 mock)
const MOCK_QUESTIONS = [
  '오늘 가장 기억에 남는 순간은?',
  '지금 기분을 한 단어로 표현하면?',
  '내일 자신에게 해주고 싶은 말은?',
];

export default function App() {
  const { entries, addEntry } = useJournalStorage();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [todaySummary, setTodaySummary] = useState<string | null>(null);

  const handleAnswer = (response: string) => {
    const newAnswers = [...answers, { question: MOCK_QUESTIONS[step], response }];
    setAnswers(newAnswers);

    if (step + 1 < MOCK_QUESTIONS.length) {
      setStep(step + 1);
    } else {
      finishDay(newAnswers);
    }
  };

  // TODO: 여기를 나중에 실제 AI 요약 API 호출로 교체
  const finishDay = async (finalAnswers: Answer[]) => {
    const mockSummary = finalAnswers.map((a) => a.response).join(' · ');

    const entry: JournalEntry = {
      id: Date.now().toString(),
      date: new Date().toISOString().slice(0, 10),
      answers: finalAnswers,
      summary: mockSummary,
      createdAt: Date.now(),
    };

    await addEntry(entry);
    setTodaySummary(mockSummary);
  };

  return (
    <ScrollView style={styles.container}>
      {todaySummary ? (
        <SummaryView summary={todaySummary} />
      ) : (
        <QuestionCard question={MOCK_QUESTIONS[step]} onAnswer={handleAnswer} />
      )}

      <View style={styles.historySection}>
        <HistoryList entries={entries} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20, paddingTop: 60 },
  historySection: { marginTop: 24 },
});
