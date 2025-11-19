import OpenAI from 'openai';
import logger from '../utils/logger';

interface UserPreferences {
  interests: string[];
  skillLevel: string;
  socialMode: string;
  budget: string;
  maxDistance: number;
  preferredDuration: number;
  timePreferences: Record<string, boolean>;
}

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface Weather {
  current: any;
  forecast: any[];
}

interface Constraints {
  duration: number;
  maxDistance: number;
  startTime: Date;
  endTime: Date;
}

class AIOrchestrator {
  private openai: OpenAI | null = null;
  private isInitialized: boolean = false;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private topP: number;

  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
    this.maxTokens = parseInt(process.env.AI_MAX_TOKENS || '2000', 10);
    this.temperature = parseFloat(process.env.AI_TEMPERATURE || '0.7');
    this.topP = parseFloat(process.env.AI_TOP_P || '0.9');
  }

  async initialize(): Promise<void> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        logger.warn('OpenAI API key not found, AI features will be disabled');
        return;
      }

      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      await this.openai.models.list();
      this.isInitialized = true;
      logger.info('AI Orchestrator initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize AI Orchestrator:', error);
      this.isInitialized = false;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async generateAdventure(userPreferences: UserPreferences, location: Location, nearbyEvents: any[], weather: Weather, constraints: Constraints): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('AI Orchestrator not initialized');
    }

    try {
      const startTime = Date.now();
      
      const prompt = this.buildAdventurePrompt(userPreferences, location, nearbyEvents, weather, constraints);
      
      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are an expert local adventure planner for MAG 2.0. Generate curated 30-90 minute local experiences that are:
            - Weather-appropriate
            - Distance-optimized
            - Interest-aligned
            - Socially engaging
            - Safe and accessible
            
            Always respond with valid JSON matching the required schema.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        top_p: this.topP,
        response_format: { type: "json_object" }
      });

      const generationTime = Date.now() - startTime;
      const content = response.choices[0].message.content;
      
      let adventure: any;
      try {
        adventure = JSON.parse(content || '{}');
      } catch (parseError: any) {
        logger.error('Failed to parse AI response:', parseError);
        throw new Error('Invalid AI response format');
      }

      adventure = this.validateAndEnhanceAdventure(adventure, constraints);
      
      adventure.aiMetadata = {
        model: this.model,
        version: '2.0',
        generationTime,
        tokensUsed: response.usage?.total_tokens || 0,
        confidence: this.calculateConfidence(adventure),
        reasoning: this.generateReasoning(adventure, userPreferences, weather)
      };

      logger.info(`Adventure generated in ${generationTime}ms with ${response.usage?.total_tokens || 0} tokens`);
      return adventure;

    } catch (error: any) {
      logger.error('Adventure generation failed:', error);
      throw new Error(`AI adventure generation failed: ${error.message}`);
    }
  }

  buildAdventurePrompt(userPreferences: UserPreferences, location: Location, nearbyEvents: any[], weather: Weather, constraints: Constraints): string {
    return `
Generate a personalized adventure itinerary based on the following data:

USER PREFERENCES:
- Interests: ${userPreferences.interests.join(', ')}
- Skill Level: ${userPreferences.skillLevel}
- Social Mode: ${userPreferences.socialMode}
- Budget: ${userPreferences.budget}
- Max Distance: ${userPreferences.maxDistance}m
- Preferred Duration: ${userPreferences.preferredDuration} minutes
- Time Preferences: ${Object.entries(userPreferences.timePreferences).filter(([_, v]) => v).map(([k, _]) => k).join(', ')}

LOCATION:
- Latitude: ${location.lat}
- Longitude: ${location.lng}
- Address: ${location.address || 'N/A'}

NEARBY EVENTS:
${nearbyEvents.map(event => `
- ${event.name} (${event.type})
  Time: ${event.startTime} - ${event.endTime}
  Location: ${event.location?.address || 'N/A'}
  Category: ${event.category}
  Capacity: ${event.capacity || 'N/A'}
  Price: ${event.price?.isFree ? 'Free' : `$${event.price?.amount || 0}`}
`).join('')}

WEATHER CONDITIONS:
- Current: ${weather.current?.condition || 'N/A'}, ${weather.current?.temperature || 'N/A'}°F
- Forecast: ${weather.forecast?.map((f: any) => `${f.time}: ${f.condition}, ${f.temperature}°F`).join(', ') || 'N/A'}

CONSTRAINTS:
- Duration: ${constraints.duration} minutes
- Max Distance: ${constraints.maxDistance}m
- Start Time: ${constraints.startTime}
- End Time: ${constraints.endTime}

Generate a JSON response with this exact structure:
{
  "adventure_name": "Creative adventure name",
  "description": "Brief description of the adventure",
  "total_duration": 75,
  "total_distance": 1200,
  "steps": [
    {
      "type": "event|venue|travel|activity|break",
      "name": "Step name",
      "description": "What to do here",
      "location": {
        "lat": 40.7128,
        "lng": -74.0060,
        "address": "123 Main St, City, State"
      },
      "start_time": "2024-01-15T18:30:00Z",
      "end_time": "2024-01-15T19:00:00Z",
      "duration": 30,
      "travel_method": "walk|bike|drive|transit|taxi",
      "travel_duration": 15,
      "travel_distance": 500,
      "task": {
        "description": "Optional challenge or task",
        "points": 10
      },
      "venue": {
        "venueId": "venue_123",
        "type": "bar|restaurant|concert|popup|meetup",
        "rating": 4.5,
        "priceLevel": 2,
        "photos": ["url1", "url2"],
        "website": "https://example.com",
        "phone": "+1234567890"
      },
      "weather": {
        "condition": "clear",
        "temperature": 72,
        "humidity": 60,
        "windSpeed": 5
      }
    }
  ],
  "social": {
    "friends_invited": [],
    "is_public": false,
    "max_participants": 4
  },
  "weather_alerts": [],
  "reroute_suggestions": [],
  "gamification": {
    "points": 50,
    "badges": ["first_adventure", "social_butterfly"],
    "challenges": [
      {
        "description": "Try a new cocktail",
        "points": 15
      }
    ]
  }
}

Ensure the adventure:
1. Fits within the time constraints
2. Respects distance limits
3. Is weather-appropriate
4. Matches user interests
5. Includes realistic travel times
6. Has engaging tasks/challenges
7. Considers social preferences
`;
  }

  validateAndEnhanceAdventure(adventure: any, constraints: Constraints): any {
    if (!adventure.adventure_name || !adventure.steps || !Array.isArray(adventure.steps)) {
      throw new Error('Invalid adventure structure');
    }

    const totalDuration = adventure.steps.reduce((total: number, step: any) => total + (step.duration || 0), 0);
    if (totalDuration > constraints.duration) {
      const scaleFactor = constraints.duration / totalDuration;
      adventure.steps.forEach((step: any) => {
        step.duration = Math.round(step.duration * scaleFactor);
      });
      adventure.total_duration = constraints.duration;
    }

    adventure.steps.forEach((step: any, index: number) => {
      step.type = step.type || 'venue';
      step.duration = step.duration || 30;
      step.travel_method = step.travel_method || 'walk';
      step.travel_duration = step.travel_duration || 0;
      step.travel_distance = step.travel_distance || 0;
      
      if (!step.task) {
        step.task = {
          description: `Complete step ${index + 1}`,
          points: 5
        };
      }
    });

    if (!adventure.social) {
      adventure.social = {
        friends_invited: [],
        is_public: false,
        max_participants: 4
      };
    }

    if (!adventure.gamification) {
      adventure.gamification = {
        points: adventure.steps.length * 10,
        badges: [],
        challenges: []
      };
    }

    return adventure;
  }

  calculateConfidence(adventure: any): number {
    let confidence = 0.8;

    if (adventure.total_duration < 30) {
      confidence -= 0.2;
    }

    const hasTasks = adventure.steps.some((step: any) => step.task && step.task.description);
    if (!hasTasks) {
      confidence -= 0.1;
    }

    const travelSteps = adventure.steps.filter((step: any) => step.type === 'travel').length;
    if (travelSteps > adventure.steps.length * 0.3) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  generateReasoning(adventure: any, userPreferences: UserPreferences, weather: Weather): string {
    const reasons: string[] = [];

    const interestMatches = adventure.steps.filter((step: any) => 
      userPreferences.interests.some(interest => 
        step.venue?.type?.includes(interest) || step.name.toLowerCase().includes(interest)
      )
    ).length;
    
    if (interestMatches > 0) {
      reasons.push(`Matched ${interestMatches} steps to user interests`);
    }

    if (weather.current?.condition === 'rain' && adventure.steps.some((step: any) => step.type === 'outdoor')) {
      reasons.push('Adjusted for rainy weather conditions');
    }

    if (userPreferences.socialMode === 'solo' && adventure.social.friends_invited.length === 0) {
      reasons.push('Optimized for solo exploration');
    }

    if (Math.abs(adventure.total_duration - userPreferences.preferredDuration) <= 15) {
      reasons.push('Duration closely matches user preference');
    }

    return reasons.join('; ');
  }

  async generateEventSuggestions(eventData: any, userPreferences: UserPreferences): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('AI Orchestrator not initialized');
    }

    try {
      const prompt = `
Based on the following event data and user preferences, suggest the best time slots and nearby attractions:

EVENT DATA:
- Name: ${eventData.name}
- Type: ${eventData.type}
- Location: ${eventData.location?.address || 'N/A'}
- Duration: ${eventData.duration} minutes
- Capacity: ${eventData.capacity || 'N/A'}

USER PREFERENCES:
- Interests: ${userPreferences.interests.join(', ')}
- Budget: ${userPreferences.budget}
- Social Mode: ${userPreferences.socialMode}

Suggest optimal time slots and nearby attractions in JSON format:
{
  "best_time_slots": ["2024-01-15T18:00:00Z", "2024-01-15T19:30:00Z"],
  "nearby_attractions": ["Coffee shop nearby", "Park for pre-event gathering"],
  "similar_events": ["Jazz night at Blue Note", "Cocktail hour at Rooftop"],
  "recommendations": "This event works well for evening socializing with friends"
}
`;

      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert event planner. Provide helpful suggestions for event timing and nearby attractions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error: any) {
      logger.error('Event suggestions generation failed:', error);
      throw new Error(`AI event suggestions failed: ${error.message}`);
    }
  }

  async generateAdventureVariations(baseAdventure: any, userPreferences: UserPreferences): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('AI Orchestrator not initialized');
    }

    try {
      const prompt = `
Generate 2 alternative variations of this adventure, each with different focus:

BASE ADVENTURE:
${JSON.stringify(baseAdventure, null, 2)}

USER PREFERENCES:
${JSON.stringify(userPreferences, null, 2)}

Generate variations with different themes (e.g., "Food Focus", "Social Focus", "Cultural Focus") in JSON format:
{
  "variations": [
    {
      "theme": "Food Focus",
      "adventure": { /* adventure object */ }
    },
    {
      "theme": "Social Focus", 
      "adventure": { /* adventure object */ }
    }
  ]
}
`;

      const response = await this.openai!.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert adventure planner. Create themed variations of adventures.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.8,
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error: any) {
      logger.error('Adventure variations generation failed:', error);
      throw new Error(`AI adventure variations failed: ${error.message}`);
    }
  }
}

export default new AIOrchestrator();

