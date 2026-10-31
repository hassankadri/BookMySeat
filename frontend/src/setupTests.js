import { TextDecoder, TextEncoder } from 'util';

// React Router expects these browser APIs; Jest 27's jsdom does not supply them.
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.IS_REACT_ACT_ENVIRONMENT = true;
window.scrollTo = jest.fn();
// Test-process fixtures only. No .env files or application settings are changed.
process.env.REACT_APP_BACKEND_URL = 'https://bookmyseat.invalid';
process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_test_fixture_not_a_real_key';

// Presentation-only substitute: these suites test controllers, not animation.
jest.mock('framer-motion', () => require('./test-support/motion'));
