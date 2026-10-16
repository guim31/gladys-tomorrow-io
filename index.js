// -----------------------------------------------------------------------------
// Entry point of the Tomorrow.io integration for Gladys Assistant.
//
// SDK wiring only: the integration itself lives in src/app.js, which takes
// the Gladys client as a parameter so the tests can run it against the SDK's
// fake Gladys. Handlers are registered before connect().
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
//   - TZ                          (time zone of Gladys, used by the widgets)
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { createApp } from './src/app.js';

const gladys = new GladysIntegration();
const app = createApp({ gladys });
app.register();

logger.info('Starting the Tomorrow.io integration...');
gladys.connect().catch((err) => {
  logger.error(`Initial connection failed (${err.message})`);
  process.exit(1);
});
