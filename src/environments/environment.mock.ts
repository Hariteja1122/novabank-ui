/**
 * Demo mode: an in-browser fake backend answers every /api call with sample data, so the
 * UI can be explored without Docker or Db2.  `npm run start:mock`
 */
export const environment = {
  mock: true,
  apiBase: '/api',
  envName: 'demo',
};
