import type { Request, Response } from 'express';
import type { z } from 'zod';
import { currentUser } from '../middleware/auth.js';
import { Appointment } from '../models/Appointment.js';
import { Property } from '../models/Property.js';
import { User } from '../models/User.js';
import { deleteImages } from '../services/storage.js';
import { AppError } from '../utils/AppError.js';
import { signAuthToken } from '../utils/tokens.js';
import type { changePasswordSchema, deleteAccountSchema, updateProfileSchema } from '../validators/schemas.js';

// GET /api/users/me
export async function getMe(req: Request, res: Response) {
  res.json({ user: currentUser(req) });
}

// PATCH /api/users/me
export async function updateMe(req: Request, res: Response) {
  const user = currentUser(req);
  const changes = req.body as z.infer<typeof updateProfileSchema>;
  if (changes.name !== undefined) user.name = changes.name;
  if (changes.phone !== undefined) user.phone = changes.phone;
  await user.save();
  res.json({ user });
}

// PATCH /api/users/me/password
export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
  const user = await User.findById(currentUser(req)._id).select('+password +tokenVersion');
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is not correct', 400, {
      errors: [{ field: 'currentPassword', message: 'Current password is not correct' }],
    });
  }
  user.password = newPassword;
  await user.save();
  // Other devices are logged out; this device gets a fresh token
  res.json({ message: 'Password changed', token: signAuthToken(user) });
}

// DELETE /api/users/me  – deletes the account, its listings and images, and cancels its viewings
export async function deleteMe(req: Request, res: Response) {
  const { password } = req.body as z.infer<typeof deleteAccountSchema>;
  const user = await User.findById(currentUser(req)._id).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Password is not correct', 400, { errors: [{ field: 'password', message: 'Password is not correct' }] });
  }

  const properties = await Property.find({ owner: user._id });
  await deleteImages(properties.flatMap((p) => p.images));
  await Appointment.deleteMany({ property: { $in: properties.map((p) => p._id) } });
  await Property.deleteMany({ owner: user._id });
  await Appointment.updateMany(
    { user: user._id, status: { $ne: 'cancelled' } },
    { $set: { status: 'cancelled', cancelledBy: 'visitor', holdsSlot: false } }
  );
  await Appointment.updateMany({ user: user._id }, { $set: { user: null } });
  await user.deleteOne();

  res.json({ message: 'Your account has been deleted' });
}
