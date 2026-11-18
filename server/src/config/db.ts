// Connects to MongoDB (Atlas or local) with Mongoose.
import mongoose from 'mongoose';
import { env } from './env.js';

let supportsChangeStreams = false;

export async function connectDB(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected – retrying…'));
  mongoose.connection.on('reconnected', () => console.log('🔁 MongoDB reconnected'));
  mongoose.connection.on('error', (error) => console.error('MongoDB error:', error.message));

  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15_000,
      maxPoolSize: 20,
    });

    // Atlas clusters are replica sets, which support "change streams" (live updates)
    const hello = await conn.connection.db!.admin().command({ hello: 1 });
    supportsChangeStreams = Boolean(hello.setName);

    console.log(
      `✅ MongoDB connected: ${conn.connection.host}/${conn.connection.name}` +
        (supportsChangeStreams ? ' (replica set – live updates via change streams)' : '')
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Could not connect to MongoDB.');
    console.error(`   Reason: ${message}`);
    console.error('   Check MONGODB_URI in server/.env, your Atlas password, and Network Access (IP allow list).\n');
    process.exit(1);
  }
}

export function hasChangeStreams(): boolean {
  return supportsChangeStreams;
}

export async function disconnectDB(): Promise<void> {
  mongoose.connection.removeAllListeners('disconnected');
  await mongoose.connection.close();
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
