import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';

export const APPOINTMENT_STATUS = ['pending', 'confirmed', 'cancelled'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export interface IAppointment {
  _id: Types.ObjectId;
  property: Types.ObjectId;
  owner: Types.ObjectId; // copied from the property so the owner can find requests fast
  user: Types.ObjectId | null; // null = booked as a guest
  name: string;
  email: string;
  phone: string;
  message: string;
  date: string; // "YYYY-MM-DD" (India time)
  time: string; // "HH:mm"
  status: AppointmentStatus;
  cancelledBy: 'visitor' | 'owner' | null;
  /** true while the slot is taken (pending or confirmed). Used by the unique index below. */
  holdsSlot: boolean;
  guestCancelTokenHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AppointmentDoc = HydratedDocument<IAppointment>;

const appointmentSchema = new Schema<IAppointment>(
  {
    property: { type: Schema.Types.ObjectId, ref: 'Property', required: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, index: true },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    status: { type: String, enum: APPOINTMENT_STATUS, default: 'pending' },
    cancelledBy: { type: String, enum: ['visitor', 'owner', null], default: null },
    holdsSlot: { type: Boolean, default: true },
    guestCancelTokenHash: { type: String, select: false },
  },
  { timestamps: true }
);

// Keep holdsSlot in sync with the status
appointmentSchema.pre('validate', function syncSlot() {
  this.holdsSlot = this.status !== 'cancelled';
});

/**
 * DOUBLE-BOOKING PROTECTION
 * Only ONE active (pending/confirmed) appointment may exist for a property at a given date + time.
 * MongoDB enforces this itself, so two people clicking "Book" at the same moment cannot both win.
 */
appointmentSchema.index(
  { property: 1, date: 1, time: 1 },
  { unique: true, partialFilterExpression: { holdsSlot: true }, name: 'one_active_booking_per_slot' }
);
appointmentSchema.index({ property: 1, date: 1 });

appointmentSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    delete (ret as Partial<typeof ret>).guestCancelTokenHash;
    delete (ret as Partial<typeof ret>).holdsSlot;
    return ret;
  },
});

export const Appointment = mongoose.model<IAppointment>('Appointment', appointmentSchema);
