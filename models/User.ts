import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
  name: string;
  email: string;
  password: string;
  plan: string;
  chatsUsed: number;
  chatsLimit: number;
  createdAt: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  image?: string;
  googleId?: string;
  isActive?: boolean;
}

const userSchema = new mongoose.Schema<IUser>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String },
  plan: { type: String, default: 'Free', enum: ['Free', 'Pro', 'Enterprise'] },
  chatsUsed: { type: Number, default: 0, min: 0 },
  chatsLimit: { type: Number, default: 200, min: 0 },
  image: { type: String },
  googleId: { type: String, sparse: true, unique: true },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { 
  timestamps: true,
  collection: 'users'
});

// Hash password before saving (only if password is modified)
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as any);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword: string) {
  if (!this.password) {
    return false;
  }
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// Method to update last login
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  return this.save();
};

// Method to reset chat usage (for daily/monthly reset)
userSchema.methods.resetChatUsage = async function() {
  this.chatsUsed = 0;
  return this.save();
};

// Method to increment chat usage
userSchema.methods.incrementChatUsage = async function() {
  if (this.chatsUsed < this.chatsLimit) {
    this.chatsUsed += 1;
    return this.save();
  }
  return this;
};

// Method to increment chat usage
userSchema.methods.incrementChatUsage = async function() {
  if (this.chatsUsed < this.chatsLimit) {
    this.chatsUsed += 1;
    await this.save();
    return true;
  }
  return false;
};

// Create the model if it doesn't exist
const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;