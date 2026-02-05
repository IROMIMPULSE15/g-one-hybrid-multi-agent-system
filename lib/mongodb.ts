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
      console.log('✅ Using cached MongoDB connection');
      return cached.conn;
    }

    if (!cached.promise) {
      const opts: mongoose.ConnectOptions = {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000, // Reduced from 10s to 5s
        socketTimeoutMS: 10000, // Reduced from 45s to 10s
        maxPoolSize: 10,
      };

      // Mask the password in the URI for logging
      const maskedURI = MONGODB_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') || 'undefined';
      console.log('🔌 Connecting to MongoDB...');
      console.log('📍 URI:', maskedURI);
      console.log('⚙️  Options:', opts);

      cached.promise = mongoose.connect(MONGODB_URI!, opts);
    }

    try {
      cached.conn = await cached.promise;
      console.log('✅ Successfully connected to MongoDB');
      console.log('📊 Connection state:', mongoose.connection.readyState);
      return cached.conn;
    } catch (e: any) {
      cached.promise = null;
      console.error('❌ MongoDB connection failed:', {
        message: e.message,
        code: e.code,
        name: e.name,
        reason: e.reason,
        stack: e.stack?.split('\n').slice(0, 3).join('\n')
      });

      // Provide helpful error messages
      if (e.message?.includes('ENOTFOUND') || e.message?.includes('getaddrinfo')) {
        throw new Error('Cannot reach MongoDB server. Check your internet connection and MongoDB Atlas network access settings.');
      } else if (e.message?.includes('authentication failed')) {
        throw new Error('MongoDB authentication failed. Check your username and password.');
      } else if (e.message?.includes('timeout')) {
        throw new Error('MongoDB connection timeout. Check your network and MongoDB Atlas IP whitelist.');
      }

      throw new Error(`Failed to connect to MongoDB: ${e.message}`);
    }
  } catch (error: any) {
    console.error('❌ MongoDB connection error:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    throw new Error(`Failed to connect to MongoDB: ${error.message}`);
  }
}

export default connectDB;