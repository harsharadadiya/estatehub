// Entry point: connect to MongoDB, then start the HTTP server.
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';
import { verifyEmailTransport } from './services/email.js';
import { startRealtime, stopRealtime } from './services/realtime.js';
import { Appointment } from './models/Appointment.js';
import { Property } from './models/Property.js';
import { User } from './models/User.js';

await connectDB();

// Make sure every index exists (including the "one booking per time slot" index)
await Promise.all([User.syncIndexes(), Property.syncIndexes(), Appointment.syncIndexes()]);

await verifyEmailTransport();
console.log(`🖼️  Images: ${env.storageDriver === 'imagekit' ? 'ImageKit CDN' : 'local uploads folder (development only)'}`);

startRealtime();

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`🚀 EstateHub API running on http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
});

// Live-update connections stay open, so close them on shutdown
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received – shutting down…`);
  await stopRealtime();
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('💥 Unhandled promise rejection:', reason));
