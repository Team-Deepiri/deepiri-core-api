export const serviceRegistry: Record<string, string> = {
  // Internal services (example names)
  engagement: process.env.ENGAGEMENT_SERVICE_URL || 'http://engagement:4002',
  pythonAgent: process.env.PYTHON_AGENT_URL || 'http://cyrex:8000',

  // External APIs (used by ExternalApiService)
  googleMaps: 'https://maps.googleapis.com',
  openWeather: 'https://api.openweathermap.org',
  eventbrite: 'https://www.eventbriteapi.com/v3',
  yelp: 'https://api.yelp.com'
};

export function getServiceUrl(serviceName: string): string | undefined {
  return serviceRegistry[serviceName];
}
