import { registerRootComponent } from 'expo';
import { setLocale } from './src/i18n';
import { detectLocale } from './src/i18n/detect';

import App from './App';

// Resolve the UI language from the system before the first render.
setLocale(detectLocale());

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
