import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChallenge extends Document {
  userId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  type: 'quiz' | 'puzzle' | 'coding_challenge' | 'timed_completion' | 'streak' | 'multiplayer' | 'custom';
  title: string;
  description?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'adaptive';
  difficultyScore: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'expired';
  configuration?: {
    timeLimit?: number;
    attempts?: number;
    hints?: string[];
    questions?: Array<{
      question: string;
      options: string[];
      correctAnswer: number;
      points: number;
    }>;
    codeTemplate?: string;
    testCases?: string[];
    puzzleData?: any;
  };
  pointsReward: number;
  bonusMultiplier: number;
  completionData?: {
    completedAt?: Date;
    completionTime?: number;
    score?: number;
    accuracy?: number;
    attemptsUsed?: number;
    hintsUsed?: number;
  };
  aiGenerated: boolean;
  aiMetadata?: {
    model?: string;
    prompt?: string;
    generationTime?: number;
  };
  createdAt?: Date;
  expiresAt?: Date;
  updatedAt?: Date;
}

const challengeSchema = new Schema<IChallenge>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  type: {
    type: String,
    enum: ['quiz', 'puzzle', 'coding_challenge', 'timed_completion', 'streak', 'multiplayer', 'custom'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'adaptive'],
    default: 'medium'
  },
  difficultyScore: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'completed', 'failed', 'expired'],
    default: 'pending'
  },
  configuration: {
    timeLimit: Number,
    attempts: Number,
    hints: [String],
    questions: [{
      question: String,
      options: [String],
      correctAnswer: Number,
      points: Number
    }],
    codeTemplate: String,
    testCases: [String],
    puzzleData: Schema.Types.Mixed
  },
  pointsReward: {
    type: Number,
    default: 100,
    min: 0
  },
  bonusMultiplier: {
    type: Number,
    default: 1.0,
    min: 1.0,
    max: 3.0
  },
  completionData: {
    completedAt: Date,
    completionTime: Number,
    score: Number,
    accuracy: Number,
    attemptsUsed: Number,
    hintsUsed: Number
  },
  aiGenerated: {
    type: Boolean,
    default: true
  },
  aiMetadata: {
    model: String,
    prompt: String,
    generationTime: Number
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

challengeSchema.index({ userId: 1, status: 1 });
challengeSchema.index({ taskId: 1 });
challengeSchema.index({ expiresAt: 1 });

challengeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Challenge: Model<IChallenge> = mongoose.model<IChallenge>('Challenge', challengeSchema);
export default Challenge;

