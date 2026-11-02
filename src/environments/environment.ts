/** Real backend: every /api call goes to the API gateway (dev-server proxy or nginx). */
export const environment = {
  mock: false,
  apiBase: '/api',
  envName: 'local',
};
