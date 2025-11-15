import mongoose from 'mongoose';
import logger from './config/logger.js';

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
    logger.info('MongoDB already connected');
    return true;
  }

  try {
    await mongoose.connect(MONGO_URI, options);
    isConnected = true;
    logger.info('MongoDB connected');
    return true;
  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    // Don't crash the app - let health checks continue to work
    isConnected = false;
    return false;
  }
};

// Connection event handlers
mongoose.connection.on('connected', () => {
  logger.info('Mongoose connected to MongoDB');
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  logger.error('Mongoose connection error', { error: err });
  isConnected = false;
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Mongoose disconnected from MongoDB');
  isConnected = false;

  // Attempt to reconnect in production
  if (!isDev) {
    logger.info('Attempting to reconnect...');
    setTimeout(() => connectDB(), 5000);
  }
});

// Graceful shutdown handler
export const disconnectDB = async (): Promise<void> => {
  if (!isConnected) return;

  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    isConnected = false;
  } catch (error) {
    logger.error('Error closing MongoDB connection', { error });
  }
};

// Health check helper
export const isDBHealthy = (): boolean => {
  return isConnected && mongoose.connection.readyState === 1;
};

// Initialize connection
connectDB();
