/**
 * LIVE UPDATES (real-time database operations)
 *
 * Browsers keep one open "Server-Sent Events" (SSE) connection. When an appointment changes,
 * the owner and the visitor get an event immediately, and their dashboards refresh by themselves.
 *
 * Where do the events come from?
 *  • MongoDB Atlas (a replica set): a MongoDB CHANGE STREAM watches the appointments collection.
 *    This also works when you run several API servers, because every server watches the database.
 *  • A single local MongoDB without replica set: the controllers announce changes directly.
 */
import type { Response } from 'express';
import type { ChangeStream } from 'mongodb';
import { hasChangeStreams } from '../config/db.js';
import { Appointment, type IAppointment } from '../models/Appointment.js';

type EventName = 'appointment.created' | 'appointment.updated';

interface AppointmentEvent {
  appointmentId: string;
  ownerId: string; // lets the browser tell "a request for my property" from "my own booking"

  propertyId: string;
  status: IAppointment['status'];
  date: string;
  time: string;
  name: string;
}

const clients = new Map<string, Set<Response>>();
let changeStream: ChangeStream | null = null;
let heartbeat: NodeJS.Timeout | null = null;
let usingChangeStream = false;

function write(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function publish(userIds: Array<string | null | undefined>, event: EventName, data: AppointmentEvent) {
  for (const userId of new Set(userIds.filter(Boolean) as string[])) {
    for (const res of clients.get(userId) ?? []) write(res, event, data);
  }
}

function toEvent(a: Pick<IAppointment, '_id' | 'owner' | 'property' | 'status' | 'date' | 'time' | 'name'>): AppointmentEvent {
  return { appointmentId: String(a._id), ownerId: String(a.owner), propertyId: String(a.property), status: a.status, date: a.date, time: a.time, name: a.name };
}

/** Opens an SSE connection for one user */
export function subscribe(userId: string, res: Response) {
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop proxies from buffering the stream
  });
  res.flushHeaders();
  res.write('retry: 5000\n\n');
  write(res, 'ready', { mode: usingChangeStream ? 'change-stream' : 'direct' });

  const set = clients.get(userId) ?? new Set<Response>();
  set.add(res);
  clients.set(userId, set);

  res.on('close', () => {
    set.delete(res);
    if (set.size === 0) clients.delete(userId);
  });
}

/** Called by controllers. Does nothing when the change stream already reports the change. */
export function notifyAppointmentChange(
  appointment: Pick<IAppointment, '_id' | 'property' | 'status' | 'date' | 'time' | 'name' | 'owner' | 'user'>,
  kind: 'created' | 'updated'
) {
  if (usingChangeStream) return;
  publish([String(appointment.owner), appointment.user ? String(appointment.user) : null], `appointment.${kind}`, toEvent(appointment));
}

function startChangeStream() {
  try {
    changeStream = Appointment.watch([], { fullDocument: 'updateLookup' });
    usingChangeStream = true;

    changeStream.on('change', (change) => {
      if (change.operationType !== 'insert' && change.operationType !== 'update' && change.operationType !== 'replace') return;
      const doc = change.fullDocument as IAppointment | undefined;
      if (!doc) return;
      publish(
        [String(doc.owner), doc.user ? String(doc.user) : null],
        change.operationType === 'insert' ? 'appointment.created' : 'appointment.updated',
        toEvent(doc)
      );
    });

    changeStream.on('error', (error) => {
      console.error('⚡ Change stream error – switching to direct updates:', error.message);
      usingChangeStream = false;
      void changeStream?.close().catch(() => undefined);
      changeStream = null;
      setTimeout(() => hasChangeStreams() && startChangeStream(), 10_000).unref();
    });
  } catch (error) {
    usingChangeStream = false;
    console.warn('⚡ Change streams not available:', (error as Error).message);
  }
}

export function startRealtime() {
  if (hasChangeStreams()) startChangeStream();
  console.log(`⚡ Live updates: ${usingChangeStream ? 'MongoDB change streams' : 'direct (single server)'}`);

  // A comment line every 25 s keeps the connection open through proxies (Render, Vercel, Nginx)
  heartbeat = setInterval(() => {
    for (const set of clients.values()) for (const res of set) res.write(': ping\n\n');
  }, 25_000);
  heartbeat.unref();
}

export async function stopRealtime() {
  if (heartbeat) clearInterval(heartbeat);
  for (const set of clients.values()) for (const res of set) res.end();
  clients.clear();
  await changeStream?.close().catch(() => undefined);
}
