import mongoose, { Schema, Document, Model } from 'mongoose';

interface IAgentMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: {
    tokensUsed?: number;
    model?: string;
    reasoning?: string;
  };
  createdAt?: Date;
}

export interface IAgentSession extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  messages: IAgentMessage[];
  settings?: {
    model?: string;
    temperature?: number;
    topP?: number;
  };
  archived: boolean;
  metadata: {
    createdAt?: Date;
    updatedAt?: Date;
    lastAssistantTokens?: number;
    totalTokens?: number;
  };
}

const AgentMessageSchema = new Schema<IAgentMessage>({
  role: {
    type: String,
    enum: ['system', 'user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  metadata: {
    tokensUsed: { type: Number, default: 0 },
    model: { type: String },
    reasoning: { type: String },
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const AgentSessionSchema = new Schema<IAgentSession>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Agent Session'
  },
  messages: {
    type: [AgentMessageSchema],
    default: []
  },
  settings: {
    model: { type: String },
    temperature: { type: Number },
    topP: { type: Number }
  },
  archived: {
    type: Boolean,
    default: false,
    index: true
  },
  metadata: {
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastAssistantTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
  }
});

AgentSessionSchema.pre('save', function(next) {
  this.metadata.updatedAt = new Date();
  next();
});

const AgentSession: Model<IAgentSession> = mongoose.model<IAgentSession>('AgentSession', AgentSessionSchema);
export default AgentSession;

