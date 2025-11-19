import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IIntegration extends Document {
  userId: mongoose.Types.ObjectId;
  service: 'notion' | 'trello' | 'github' | 'google_docs' | 'slack' | 'todoist' | 'asana';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  credentials: {
    accessToken?: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
    apiKey?: string;
  };
  configuration: {
    autoSync?: boolean;
    syncInterval?: number;
    syncFilters?: {
      labels?: string[];
      projects?: string[];
      statuses?: string[];
    };
  };
  lastSync?: Date;
  syncStats: {
    totalTasksSynced?: number;
    lastSyncSuccess?: boolean;
    lastSyncError?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const integrationSchema = new Schema<IIntegration>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  service: {
    type: String,
    enum: ['notion', 'trello', 'github', 'google_docs', 'slack', 'todoist', 'asana'],
    required: true
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'error', 'syncing'],
    default: 'connected'
  },
  credentials: {
    accessToken: String,
    refreshToken: String,
    tokenExpiresAt: Date,
    apiKey: String
  },
  configuration: {
    autoSync: {
      type: Boolean,
      default: true
    },
    syncInterval: {
      type: Number,
      default: 3600
    },
    syncFilters: {
      labels: [String],
      projects: [String],
      statuses: [String]
    }
  },
  lastSync: {
    type: Date
  },
  syncStats: {
    totalTasksSynced: {
      type: Number,
      default: 0
    },
    lastSyncSuccess: {
      type: Boolean,
      default: true
    },
    lastSyncError: String
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

integrationSchema.index({ userId: 1, service: 1 });
integrationSchema.index({ userId: 1, status: 1 });
integrationSchema.index({ 'credentials.tokenExpiresAt': 1 });

integrationSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const Integration: Model<IIntegration> = mongoose.model<IIntegration>('Integration', integrationSchema);
export default Integration;

