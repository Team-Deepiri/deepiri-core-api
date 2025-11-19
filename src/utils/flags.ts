interface FeatureFlags {
  enableAgentStreaming: boolean;
  usePythonAgent: boolean;
  enableRecommendations: boolean;
}

const flags: FeatureFlags = {
  enableAgentStreaming: process.env.FLAG_AGENT_STREAMING === 'true',
  usePythonAgent: process.env.FLAG_USE_CYREX === 'true',
  enableRecommendations: process.env.FLAG_RECS === 'true'
};

export default {
  getAll: (): FeatureFlags => flags,
  isOn: (key: keyof FeatureFlags): boolean => !!flags[key]
};

