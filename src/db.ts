import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/tortuga';
const isDev = process.env.NODE_ENV !== 'production';

// Connection options for production resilience
const options: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 2,
};

mongoose.set('strictQuery', true);

// Connection state tracking
let isConnected = false;

export const connectDB = async (): Promise<boolean> => {
  if (isConnected) {
    console.log('📦 MongoDB already connected');
    return true;
  }

  try {
    await mongoose.connect(MONGO_URI, options);
    isConnected = true;
    console.log('✅ MongoDB connected');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    // Don't crash the app - let health checks continue to work
    isConnected = false;
    return false;
  }
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  console.log('📡 Mongoose connected to MongoDB');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected from MongoDB');
  isConnected = false;

  // Attempt to reconnect in production
  if (!isDev) {
    console.log('🔄 Attempting to reconnect...');
    setTimeout(() => connectDB(), 5000);
  }
});

// Graceful shutdown handler
export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) return;

  try {
    await mongoose.connection.close();
    console.log('👋 MongoDB connection closed');
    isConnected = false;
  } catch (error) {
    console.error('❌ Error closing MongoDB connection:', error);
  }
};

// Health check helper
export const isDBHealthy = (): boolean => {
  return isConnected && mongoose.connection.readyState === 1;
};

// Initialize connection
connectDB();
