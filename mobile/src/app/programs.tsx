import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { api } from '@/lib/api';
import { useResource } from '@/lib/useResource';
import { Body, Screen, ScreenHeader } from '@/ui/components';
import { ProgramCard } from '@/ui/ProgramCard';
import { colors, space } from '@/ui/theme';

export default function ProgramsScreen() {
  const programs = useResource(api.programs);
  const training = useResource(api.training);
  const currentId = training.data?.enrollment?.program.id ?? null;

  return (
    <Screen>
      <ScreenHeader label="Program kütüphanesi" title="Program seç" onBack={() => router.back()} />
      <Body>Programı değiştirdiğinde yeni program 1. günden başlar; geçmiş antrenmanların ve gelişimin korunur.</Body>
      {programs.error && <Body style={{ color: colors.bad }}>{programs.error}</Body>}
      {!programs.data && programs.loading && <ActivityIndicator color={colors.lime} style={{ marginTop: space.xxl }} />}
      {(programs.data ?? []).map((program) => (
        <ProgramCard
          key={program.id}
          program={program}
          current={program.id === currentId}
          onPress={() => router.push({ pathname: '/program/[id]', params: { id: String(program.id) } })}
        />
      ))}
    </Screen>
  );
}
