import OpenAI from 'openai';
import AgentSession, { IAgentSession } from '../models/AgentSession';
import { secureLog } from '../utils/secureLogger';

class AgentService {
  private client: OpenAI | null = null;
  private model: string;
  private temperature: number;
  private topP: number;

  constructor() {
    this.model = process.env.OPENAI_AGENT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.temperature = parseFloat(process.env.AGENT_TEMPERATURE || process.env.AI_TEMPERATURE || '0.5');
    this.topP = parseFloat(process.env.AGENT_TOP_P || process.env.AI_TOP_P || '0.9');
  }

  initialize(): void {
    if (!process.env.OPENAI_API_KEY) {
      secureLog('warn', 'OPENAI_API_KEY missing: Agent features disabled');
      return;
    }
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  isReady(): boolean {
    return !!this.client;
  }

  async createSession(userId: string, title: string = 'New Agent Session', settings: any = {}): Promise<IAgentSession> {
    const session = new AgentSession({
      userId,
      title,
      settings: {
        model: settings.model || this.model,
        temperature: settings.temperature ?? this.temperature,
        topP: settings.topP ?? this.topP,
      },
      messages: [
        {
          role: 'system',
          content: 'You are Deepiri AI Assistant. Help users boost productivity through gamification, convert tasks into challenges, and provide adaptive suggestions. Keep answers concise and actionable.'
        }
      ]
    });
    await session.save();
    return session;
  }

  async getSession(sessionId: string, userId: string): Promise<IAgentSession> {
    const session = await AgentSession.findOne({ _id: sessionId, userId });
    if (!session) throw new Error('Session not found');
    return session;
  }

  async listSessions(userId: string, limit: number = 20, offset: number = 0): Promise<IAgentSession[]> {
    return AgentSession.find({ userId, archived: false })
      .sort({ 'metadata.updatedAt': -1 })
      .limit(limit)
      .skip(offset);
  }

  async archiveSession(sessionId: string, userId: string): Promise<IAgentSession> {
    const session = await this.getSession(sessionId, userId);
    session.archived = true;
    await session.save();
    return session;
  }

  async sendMessage(sessionId: string, userId: string, content: string, tools: any = {}): Promise<any> {
    if (!this.isReady()) throw new Error('Agent not initialized');
    const session = await this.getSession(sessionId, userId);

    session.messages.push({ role: 'user', content });

    const model = session.settings?.model || this.model;
    const temperature = session.settings?.temperature ?? this.temperature;
    const topP = session.settings?.topP ?? this.topP;

    const response = await this.client!.chat.completions.create({
      model,
      messages: session.messages.map(m => ({ role: m.role, content: m.content })),
      temperature,
      top_p: topP
    });

    const assistantMessage = response.choices[0].message.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    session.messages.push({
      role: 'assistant',
      content: assistantMessage,
      metadata: { tokensUsed, model }
    });
    session.metadata.lastAssistantTokens = tokensUsed;
    session.metadata.totalTokens = (session.metadata.totalTokens || 0) + tokensUsed;
    await session.save();

    return {
      sessionId: session._id,
      message: assistantMessage,
      tokensUsed
    };
  }
}

export default new AgentService();

