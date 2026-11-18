// Viewing appointments. Two booking routes (guest and logged-in), one Appointment model.
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { env } from '../config/env.js';
import { currentUser } from '../middleware/auth.js';
import { Appointment, type AppointmentDoc } from '../models/Appointment.js';
import { Property, type PropertyDoc } from '../models/Property.js';
import { User } from '../models/User.js';
import { sendEmail } from '../services/email.js';
import { notifyAppointmentChange } from '../services/realtime.js';
import { AppError } from '../utils/AppError.js';
import {
  addDaysToDateString,
  formatDateForHumans,
  formatTimeForHumans,
  isPastSlot,
  isValidDateString,
  MAX_DAYS_AHEAD,
  nowInIndia,
  VIEWING_SLOTS,
} from '../utils/dates.js';
import { createRandomToken, hashToken } from '../utils/tokens.js';
import type { appointmentStatusSchema, guestAppointmentSchema, guestCancelSchema, userAppointmentSchema } from '../validators/schemas.js';

const PROPERTY_SUMMARY = 'title images location price purpose type bedrooms area status';

interface BookingInput {
  propertyId: string;
  date: string;
  time: string;
  message: string;
  name: string;
  email: string;
  phone: string;
  userId: string | null;
}

const when = (a: { date: string; time: string }) => `${formatDateForHumans(a.date)} at ${formatTimeForHumans(a.time)}`;

/** Shared booking logic for guests and logged-in users */
async function bookViewing(input: BookingInput): Promise<{ appointment: AppointmentDoc; property: PropertyDoc; cancelToken?: string }> {
  const property = await Property.findById(input.propertyId);
  if (!property || property.status !== 'active') throw new AppError('This property is not available for viewings', 404);
  if (input.userId && property.owner.toString() === input.userId) throw new AppError('You cannot book a viewing of your own property', 400);

  // ---- Date and time rules (India time) ----
  const fieldError = (field: string, message: string) => new AppError(message, 400, { errors: [{ field, message }] });
  if (!isValidDateString(input.date)) throw fieldError('date', 'Choose a valid date');
  if (!VIEWING_SLOTS.includes(input.time)) throw fieldError('time', 'Choose one of the available times (10:00 AM – 6:00 PM)');
  if (isPastSlot(input.date, input.time)) throw fieldError('time', 'This time has already passed. Choose a later time.');
  if (input.date > addDaysToDateString(nowInIndia().date, MAX_DAYS_AHEAD)) {
    throw fieldError('date', `You can book up to ${MAX_DAYS_AHEAD} days ahead`);
  }

  // One active viewing per person per property
  const existing = await Appointment.exists({ property: property._id, email: input.email, holdsSlot: true, date: { $gte: nowInIndia().date } });
  if (existing) throw new AppError('You already have an upcoming viewing for this property. Cancel it first to pick a new time.', 409);

  const guestToken = input.userId ? undefined : createRandomToken();

  // The unique index (property + date + time, active only) rejects a slot that someone else just booked → 409
  const appointment = await Appointment.create({
    property: property._id,
    owner: property.owner,
    user: input.userId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    date: input.date,
    time: input.time,
    guestCancelTokenHash: guestToken?.hash,
  });

  return { appointment, property, cancelToken: guestToken?.token };
}

async function sendBookingEmails(appointment: AppointmentDoc, property: PropertyDoc, cancelToken?: string) {
  const owner = await User.findById(property.owner);
  const manageUrl = cancelToken
    ? `${env.SITE_URL}/appointments/${appointment.id}/manage?token=${cancelToken}`
    : `${env.SITE_URL}/dashboard/appointments`;

  void sendEmail({
    to: appointment.email,
    subject: `Viewing requested: ${property.title}`,
    heading: 'Your viewing request was sent',
    paragraphs: [
      `Hi ${appointment.name.split(' ')[0]}, you asked to view "${property.title}" in ${property.location.locality}, ${property.location.city}.`,
      `Requested time: ${when(appointment)}. The owner will confirm soon – we will email you.`,
      cancelToken ? 'Plans changed? You can cancel with the button below.' : 'You can see or cancel it in your dashboard.',
    ],
    button: { label: cancelToken ? 'View or cancel viewing' : 'Open my appointments', url: manageUrl },
  });

  if (owner) {
    void sendEmail({
      to: owner.email,
      subject: `New viewing request: ${property.title}`,
      heading: 'You have a new viewing request',
      paragraphs: [
        `${appointment.name} wants to view "${property.title}" on ${when(appointment)}.`,
        `Phone: ${appointment.phone} · Email: ${appointment.email}`,
        ...(appointment.message ? [`Message: "${appointment.message}"`] : []),
        'Confirm or cancel it in your dashboard.',
      ],
      button: { label: 'Review request', url: `${env.SITE_URL}/dashboard/requests` },
    });
  }
}

// POST /api/appointments/guest  (no login needed)
export async function createGuestAppointment(req: Request, res: Response) {
  const body = req.body as z.infer<typeof guestAppointmentSchema>;
  const { appointment, property, cancelToken } = await bookViewing({ ...body, userId: null });

  await sendBookingEmails(appointment, property, cancelToken);
  notifyAppointmentChange(appointment, 'created');

  res.status(201).json({
    appointment,
    message: 'Viewing requested. We emailed you the details and a link to cancel if needed.',
    // Development only: link to the guest manage page (in production it is only sent by email)
    ...(!env.isProduction && !env.emailConfigured && { devManageUrl: `/appointments/${appointment.id}/manage?token=${cancelToken}` }),
  });
}

// POST /api/appointments  (logged in)
export async function createUserAppointment(req: Request, res: Response) {
  const user = currentUser(req);
  const body = req.body as z.infer<typeof userAppointmentSchema>;
  const phone = body.phone || user.phone;
  if (!phone) {
    throw new AppError('Please add a phone number so the owner can reach you', 400, {
      errors: [{ field: 'phone', message: 'Phone number is required' }],
    });
  }
  const { appointment, property } = await bookViewing({ ...body, phone, name: user.name, email: user.email, userId: user.id as string });

  if (body.phone && !user.phone) {
    user.phone = body.phone; // remember it for next time (only after the booking worked)
    await user.save();
  }

  await sendBookingEmails(appointment, property);
  notifyAppointmentChange(appointment, 'created');
  res.status(201).json({ appointment, message: 'Viewing requested. The owner will confirm soon.' });
}

// GET /api/appointments/mine  – viewings I booked
export async function getMyAppointments(req: Request, res: Response) {
  const user = currentUser(req);
  const appointments = await Appointment.find({ user: user._id })
    .sort({ date: -1, time: -1 })
    .populate('property', PROPERTY_SUMMARY)
    .lean();
  res.json({ appointments: appointments.map(({ guestCancelTokenHash: _h, holdsSlot: _s, ...rest }) => rest) });
}

// GET /api/appointments/received  – viewing requests for my properties
export async function getReceivedAppointments(req: Request, res: Response) {
  const user = currentUser(req);
  const appointments = await Appointment.find({ owner: user._id })
    .sort({ date: -1, time: -1 })
    .populate('property', PROPERTY_SUMMARY)
    .lean();
  res.json({ appointments: appointments.map(({ guestCancelTokenHash: _h, holdsSlot: _s, ...rest }) => rest) });
}

async function emailStatusChange(appointment: AppointmentDoc, actor: 'owner' | 'visitor') {
  const property = await Property.findById(appointment.property).select('title owner');
  const title = property?.title ?? 'the property';

  if (actor === 'owner') {
    const confirmed = appointment.status === 'confirmed';
    void sendEmail({
      to: appointment.email,
      subject: `Viewing ${confirmed ? 'confirmed' : 'cancelled'}: ${title}`,
      heading: confirmed ? 'Your viewing is confirmed 🎉' : 'Your viewing was cancelled',
      paragraphs: confirmed
        ? [`The owner confirmed your viewing of "${title}" on ${when(appointment)}.`, 'Please arrive on time. Have a great visit!']
        : [`The owner cancelled your viewing of "${title}" on ${when(appointment)}.`, 'You can book another time on the property page.'],
    });
  } else if (property) {
    const owner = await User.findById(property.owner);
    if (owner) {
      void sendEmail({
        to: owner.email,
        subject: `Viewing cancelled by visitor: ${title}`,
        heading: 'A visitor cancelled their viewing',
        paragraphs: [`${appointment.name} cancelled the viewing of "${title}" on ${when(appointment)}. The time slot is free again.`],
      });
    }
  }
}

// PATCH /api/appointments/:id/status  { status: "confirmed" | "cancelled" }
export async function updateAppointmentStatus(req: Request, res: Response) {
  const user = currentUser(req);
  const { status } = req.body as z.infer<typeof appointmentStatusSchema>;
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError('Appointment not found', 404);

  const isOwner = appointment.owner.toString() === user.id;
  const isVisitor = appointment.user?.toString() === user.id;
  if (!isOwner && !isVisitor) throw new AppError('You cannot change this appointment', 403);
  if (appointment.status === 'cancelled') throw new AppError('This appointment is already cancelled', 400);
  if (isPastSlot(appointment.date, appointment.time)) throw new AppError('This viewing time has already passed', 400);

  if (status === 'confirmed') {
    if (!isOwner) throw new AppError('Only the property owner can confirm a viewing', 403);
    if (appointment.status === 'confirmed') throw new AppError('This appointment is already confirmed', 400);
    appointment.status = 'confirmed';
  } else {
    appointment.status = 'cancelled';
    appointment.cancelledBy = isOwner ? 'owner' : 'visitor';
  }
  await appointment.save();

  await emailStatusChange(appointment, isOwner ? 'owner' : 'visitor');
  notifyAppointmentChange(appointment, 'updated');
  await appointment.populate('property', PROPERTY_SUMMARY);
  res.json({ appointment });
}

async function findGuestAppointment(id: string, token: string): Promise<AppointmentDoc> {
  const appointment = await Appointment.findById(id).select('+guestCancelTokenHash');
  if (!appointment || !appointment.guestCancelTokenHash || appointment.guestCancelTokenHash !== hashToken(token)) {
    throw new AppError('This link is not valid. Please use the link from your email.', 404);
  }
  return appointment;
}

// GET /api/appointments/:id/guest?token=...  – guests view their booking from the email link
export async function getGuestAppointment(req: Request, res: Response) {
  const appointment = await findGuestAppointment(req.params.id as string, String(req.query.token ?? ''));
  await appointment.populate('property', PROPERTY_SUMMARY);
  res.json({ appointment });
}

// POST /api/appointments/:id/guest-cancel  { token }
export async function cancelGuestAppointment(req: Request, res: Response) {
  const { token } = req.body as z.infer<typeof guestCancelSchema>;
  const appointment = await findGuestAppointment(req.params.id as string, token);
  if (appointment.status === 'cancelled') throw new AppError('This appointment is already cancelled', 400);
  if (isPastSlot(appointment.date, appointment.time)) throw new AppError('This viewing time has already passed', 400);

  appointment.status = 'cancelled';
  appointment.cancelledBy = 'visitor';
  await appointment.save();

  await emailStatusChange(appointment, 'visitor');
  notifyAppointmentChange(appointment, 'updated');
  await appointment.populate('property', PROPERTY_SUMMARY);
  res.json({ appointment, message: 'Your viewing has been cancelled' });
}
