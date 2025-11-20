import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITask extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  type: 'manual' | 'notion' | 'trello' | 'github' | 'google_docs' | 'pdf' | 'code' | 'study' | 'creative';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Date;
  estimatedDuration?: number;
  tags?: string[];
  metadata?: {
    sourceId?: string;
    sourceUrl?: string;
    sourceData?: any;
  };
  challengeId?: mongoose.Types.ObjectId;
  completionData?: {
    completedAt?: Date;
    actualDuration?: number;
    efficiency?: number;
    notes?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const taskSchema = new Schema<ITask>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
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
  type: {
    type: String,
    enum: ['manual', 'notion', 'trello', 'github', 'google_docs', 'pdf', 'code', 'study', 'creative'],
    default: 'manual'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  dueDate: {
    type: Date
  },
  estimatedDuration: {
    type: Number,
    min: 1
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  metadata: {
    sourceId: String,
    sourceUrl: String,
    sourceData: Schema.Types.Mixed
  },
  challengeId: {
    type: Schema.Types.ObjectId,
    ref: 'Challenge'
  },
  completionData: {
    completedAt: Date,
    actualDuration: Number,
    efficiency: Number,
    notes: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, type: 1 });
taskSchema.index({ userId: 1, dueDate: 1 });
taskSchema.index({ createdAt: -1 });

taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Task: Model<ITask> = mongoose.model<ITask>('Task', taskSchema);
export default Task;

