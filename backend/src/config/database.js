import mongoose from 'mongoose';
import config from './config.js';

let memoryServer = null;
let handlersAttached = false;

const attachConnectionHandlers = () => {
  if (handlersAttached) {
    return;
  }

  handlersAttached = true;

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });

  process.on('SIGINT', async () => {
    await mongoose.connection.close();

    if (memoryServer) {
      await memoryServer.stop();
    }

    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  });
};

export const closeDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
};

const connectInMemoryDB = async () => {
  const { MongoMemoryServer } = await import('mongodb-memory-server');

  memoryServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'sourcewiki',
    },
  });

  const memoryUri = memoryServer.getUri();
  const conn = await mongoose.connect(memoryUri);

  console.log(`MongoDB Connected (memory): ${conn.connection.host}`);
  return conn;
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    attachConnectionHandlers();

  } catch (error) {
    const shouldUseMemoryDB = process.env.NODE_ENV === 'development';

    if (!shouldUseMemoryDB) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }

    console.warn(`Local MongoDB unavailable: ${error.message}`);
    console.warn('Falling back to an in-memory MongoDB instance for development.');

    try {
      await connectInMemoryDB();
      attachConnectionHandlers();
    } catch (memoryError) {
      console.error(`Error: ${memoryError.message}`);
      process.exit(1);
    }
  }
};

export default connectDB;
