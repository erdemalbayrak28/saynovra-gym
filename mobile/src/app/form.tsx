import { router, useLocalSearchParams } from 'expo-router';
import { isExerciseId } from '../../../shared/pose';
import { Screen, ScreenHeader } from '@/ui/components';
import { FormCoach } from '@/ui/FormCoach';

/** AI Form, opened from the training tab or from the current exercise during a workout. */
export default function FormScreen() {
  const { exercise } = useLocalSearchParams<{ exercise?: string }>();
  return (
    <Screen>
      <ScreenHeader label="Antrenman" title="AI Form" onBack={() => (router.canGoBack() ? router.back() : router.replace('/training'))} />
      <FormCoach key={exercise ?? 'default'} initialExercise={isExerciseId(exercise) ? exercise : 'squat'} />
    </Screen>
  );
}
