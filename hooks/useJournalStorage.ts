// 로컬 저장(AsyncStorage) 관련 로직만 모아둔 훅
// index.tsx는 이 훅만 가져다 쓰면 되고, 저장 방식이 나중에 바뀌어도(SQLite 등)
// 이 파일만 고치면 됨

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalEntry } from '../types/journal';

// 설치 필요: npx expo install @react-native-async-storage/async-storage

const STORAGE_KEY = 'journal_entries';

export function useJournalStorage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // 앱 켜질 때 저장된 데이터 불러오기
  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        setEntries(JSON.parse(raw));
      }
    } catch (e) {
      console.error('불러오기 실패', e);
    } finally {
      setLoading(false);
    }
  };

  // 새 기록 추가
  const addEntry = async (entry: JournalEntry) => {
    const updated = [entry, ...entries]; // 최신순으로 앞에 추가
    setEntries(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  // 기록 삭제 (필요하면 사용)
  const deleteEntry = async (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return { entries, loading, addEntry, deleteEntry };
}
