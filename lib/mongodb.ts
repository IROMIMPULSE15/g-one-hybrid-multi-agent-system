import mongoose from 'mongoose';

// Allow missing URI during build, will be required at runtime
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI && process.env.NODE_ENV === 'production' && process.env.BUILD_TIME !== 'true') {
  throw new Error('MongoDB connection string is missing. Please add MONGODB_URI to your .env.local file');
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  try {
    if (cached.conn) {
      console.log('Using cached MongoDB connection');
      return cached.conn;
    }

    if (!cached.promise) {
      const opts: mongoose.ConnectOptions = {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
      };

      console.log('Connecting to MongoDB with options:', opts);
      cached.promise = mongoose.connect(MONGODB_URI, opts);
    }

    try {
      cached.conn = await cached.promise;
      console.log('Successfully connected to MongoDB');
      return cached.conn;
    } catch (e: any) {
      cached.promise = null;
      console.error('MongoDB connection error:', {
        message: e.message,
        code: e.code,
        name: e.name
      });
      throw new Error(`Failed to connect to MongoDB: ${e.message}`);
    }
  } catch (error: any) {
    console.error('MongoDB connection error:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}

export default connectDB;