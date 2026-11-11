import { View } from 'react-native';
import { Label, Screen, Title } from '@/ui/components';
import { FormCoach } from '@/ui/FormCoach';
import { space } from '@/ui/theme';

/** The trainer films a member's set: the back camera is the natural default. */
export default function CoachFormScreen() {
  return (
    <Screen>
      <View style={{ gap: space.xs, paddingTop: space.sm }}>
        <Label>Üyeni çek</Label>
        <Title>AI Form</Title>
      </View>
      <FormCoach initialFacing="environment" />
    </Screen>
  );
}
