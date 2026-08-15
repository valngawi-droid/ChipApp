import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether the app is loaded in Expo Go, a native build,
// or the web bundle, the environment is set up appropriately.
registerRootComponent(App);
