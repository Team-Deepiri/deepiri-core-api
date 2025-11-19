import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  ip: String,
  userAgent: String,
  metadata: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;

