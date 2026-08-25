import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootTabParamList } from './RootNavigator';

export const navigationRef = createNavigationContainerRef<RootTabParamList>();
