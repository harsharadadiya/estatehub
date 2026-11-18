import type { Request, Response } from 'express';
import type { QueryFilter, SortOrder } from 'mongoose';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.js';
import { parseOrThrow } from '../middleware/validate.js';
import { Appointment } from '../models/Appointment.js';
import { MAX_IMAGES, Property, type IProperty, type IPropertyImage, type PropertyDoc } from '../models/Property.js';
import { notifyAppointmentChange } from '../services/realtime.js';
import { sendEmail } from '../services/email.js';
import { deleteImages, uploadImages } from '../services/storage.js';
import { AppError } from '../utils/AppError.js';
import { addDaysToDateString, formatDateForHumans, formatTimeForHumans, isPastSlot, isValidDateString, MAX_DAYS_AHEAD, nowInIndia, VIEWING_SLOTS } from '../utils/dates.js';
import { escapeRegex } from '../utils/format.js';
import { createPropertySchema, updatePropertySchema, type PropertyQuery } from '../validators/schemas.js';

const OWNER_PUBLIC_FIELDS = 'name createdAt';
const LIST_FIELDS = '-description';

const SORTS: Record<PropertyQuery['sort'], Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  price_asc: { price: 1, createdAt: -1 },
  price_desc: { price: -1, createdAt: -1 },
  area_desc: { area: -1, createdAt: -1 },
  popular: { views: -1, createdAt: -1 },
};

/** Builds the MongoDB filter from the search options */
export function buildPropertyFilter(q: Partial<PropertyQuery>): QueryFilter<IProperty> {
  const filter: QueryFilter<IProperty> = { status: 'active' };

  if (q.location) {
    const pattern = new RegExp(escapeRegex(q.location), 'i');
    filter.$or = [
      { 'location.city': pattern },
      { 'location.locality': pattern },
      { 'location.state': pattern },
      { 'location.pincode': pattern },
      { title: pattern },
    ];
  }
  if (q.purpose) filter.purpose = q.purpose;
  if (q.type) filter.type = q.type;
  if (q.furnishing) filter.furnishing = q.furnishing;
  if (q.bedrooms !== undefined) filter.bedrooms = q.bedrooms >= 4 ? { $gte: 4 } : q.bedrooms; // "4" means 4+ BHK
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = { ...(q.minPrice !== undefined && { $gte: q.minPrice }), ...(q.maxPrice !== undefined && { $lte: q.maxPrice }) };
  }
  if (q.minArea !== undefined || q.maxArea !== undefined) {
    filter.area = { ...(q.minArea !== undefined && { $gte: q.minArea }), ...(q.maxArea !== undefined && { $lte: q.maxArea }) };
  }
  return filter;
}

// GET /api/properties?location=pune&purpose=sale&type=apartment&minPrice=..&maxPrice=..&minArea=..&bedrooms=2&page=1
export async function listProperties(req: Request, res: Response) {
  const q = req.validatedQuery as PropertyQuery;
  const filter = buildPropertyFilter(q);

  const [total, properties] = await Promise.all([
    Property.countDocuments(filter),
    Property.find(filter)
      .select(LIST_FIELDS)
      .sort(SORTS[q.sort])
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .populate('owner', OWNER_PUBLIC_FIELDS),
  ]);

  res.json({ properties, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) } });
}

// GET /api/properties/cities -> popular cities with listing counts (for the home page)
export async function listCities(_req: Request, res: Response) {
  const cities = await Property.aggregate<{ city: string; count: number }>([
    { $match: { status: 'active' } },
    { $group: { _id: { $toLower: '$location.city' }, city: { $first: '$location.city' }, count: { $sum: 1 } } },
    { $sort: { count: -1, city: 1 } },
    { $limit: 12 },
    { $project: { _id: 0, city: 1, count: 1 } },
  ]);
  res.json({ cities });
}

async function findVisibleProperty(id: string, viewerId?: string): Promise<PropertyDoc> {
  const property = await Property.findById(id);
  // Inactive listings are visible only to their owner
  if (!property || (property.status !== 'active' && property.owner.toString() !== viewerId)) {
    throw new AppError('Property not found', 404);
  }
  return property;
}

// GET /api/properties/:id
export async function getProperty(req: Request, res: Response) {
  const viewerId = req.user?.id as string | undefined;
  const property = await findVisibleProperty(req.params.id as string, viewerId);

  // The owner's phone number is shown only to logged-in visitors (reduces spam)
  await property.populate('owner', viewerId ? `${OWNER_PUBLIC_FIELDS} phone` : OWNER_PUBLIC_FIELDS);

  if (property.owner._id.toString() !== viewerId) {
    void Property.updateOne({ _id: property._id }, { $inc: { views: 1 } }).exec(); // count the view in the background
  }

  res.json({ property, isOwner: property.owner._id.toString() === viewerId });
}

/**
 * GET /api/properties/:id/similar – listing recommendations.
 * Scores other active listings by how close they are: same type, locality, BHK, price and size.
 */
export async function getSimilarProperties(req: Request, res: Response) {
  const base = await findVisibleProperty(req.params.id as string, req.user?.id as string | undefined);

  const sameCity = new RegExp(`^${escapeRegex(base.location.city)}$`, 'i');
  let candidates = await Property.find({ _id: { $ne: base._id }, status: 'active', purpose: base.purpose, 'location.city': sameCity })
    .select(LIST_FIELDS)
    .limit(60)
    .lean();
  if (candidates.length < 4) {
    const more = await Property.find({ _id: { $nin: [base._id, ...candidates.map((c) => c._id)] }, status: 'active', purpose: base.purpose })
      .select(LIST_FIELDS)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    candidates = [...candidates, ...more];
  }

  const closeness = (a: number, b: number) => 1 - Math.min(1, Math.abs(a - b) / Math.max(a, b, 1));
  const scored = candidates
    .map((c) => ({
      property: c,
      score:
        (c.type === base.type ? 3 : 0) +
        (c.location.city.toLowerCase() === base.location.city.toLowerCase() ? 3 : 0) +
        (c.location.locality.toLowerCase() === base.location.locality.toLowerCase() ? 2 : 0) +
        (c.bedrooms === base.bedrooms ? 2 : Math.abs(c.bedrooms - base.bedrooms) === 1 ? 1 : 0) +
        closeness(c.price, base.price) * 3 +
        closeness(c.area, base.area) * 1.5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  res.json({ properties: scored.map((s) => s.property) });
}

// GET /api/properties/:id/slots?date=2026-11-20 -> which viewing times are still free
export async function getAvailableSlots(req: Request, res: Response) {
  const { date } = parseOrThrow(z.object({ date: z.string() }), req.query);
  if (!isValidDateString(date)) throw new AppError('Invalid date', 400);
  const property = await findVisibleProperty(req.params.id as string);

  const taken = await Appointment.find({ property: property._id, date, holdsSlot: true }).select('time').lean();
  const takenTimes = new Set(taken.map((a) => a.time));
  const lastDate = addDaysToDateString(nowInIndia().date, MAX_DAYS_AHEAD);

  res.json({
    date,
    slots: VIEWING_SLOTS.map((time) => ({
      time,
      available: !takenTimes.has(time) && !isPastSlot(date, time) && date <= lastDate,
    })),
  });
}

/** Multipart forms send the fields as a JSON string in "data"; plain JSON requests send them directly */
function readPayload(req: Request): unknown {
  const raw = (req.body as { data?: unknown } | undefined)?.data;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      throw new AppError('Form data is not valid JSON', 400);
    }
  }
  return req.body ?? {};
}

const uploadedFiles = (req: Request) => (Array.isArray(req.files) ? req.files : []);

// POST /api/properties  (multipart/form-data: "data" = JSON fields, "images" = 1–4 files)
export async function createProperty(req: Request, res: Response) {
  const user = currentUser(req);
  const data = parseOrThrow(createPropertySchema, readPayload(req));
  const files = uploadedFiles(req);
  if (files.length === 0) {
    throw new AppError('Please fix the highlighted fields', 400, { errors: [{ field: 'images', message: 'Add at least one photo' }] });
  }

  const images = await uploadImages(files);
  try {
    const property = await Property.create({ ...data, images, owner: user._id });
    res.status(201).json({ property });
  } catch (error) {
    await deleteImages(images); // do not leave orphan images on the CDN
    throw error;
  }
}

async function findOwnProperty(id: string, userId: string): Promise<PropertyDoc> {
  const property = await Property.findById(id);
  if (!property) throw new AppError('Property not found', 404);
  if (property.owner.toString() !== userId) throw new AppError('You can only change your own listings', 403);
  return property;
}

// PATCH /api/properties/:id  (owner only; multipart or JSON)
export async function updateProperty(req: Request, res: Response) {
  const user = currentUser(req);
  const property = await findOwnProperty(req.params.id as string, user.id as string);
  const { keepImages, imageOrder, ...changes } = parseOrThrow(updatePropertySchema, readPayload(req));
  const files = uploadedFiles(req);

  const current: IPropertyImage[] = property.images.map((img) => ({ url: img.url, fileId: img.fileId, provider: img.provider }));
  const imageError = (message: string) => new AppError('Please fix the highlighted fields', 400, { errors: [{ field: 'images', message }] });
  const findCurrent = (fileId: string) => {
    const found = current.find((img) => img.fileId === fileId);
    if (!found) throw imageError('One of the photos does not belong to this listing');
    return found;
  };

  // Which existing photos stay?
  const keptIds = imageOrder ? imageOrder.filter((t) => !t.startsWith('new:')) : (keepImages ?? current.map((img) => img.fileId));
  const kept = keptIds.map(findCurrent);
  if (imageOrder) {
    const newTokens = imageOrder.filter((t) => t.startsWith('new:'));
    const expected = files.map((_f, i) => `new:${i}`);
    if (newTokens.length !== files.length || !expected.every((t) => newTokens.includes(t))) throw imageError('Photo order does not match the uploaded files');
  }
  const finalCount = kept.length + files.length;
  if (finalCount < 1 || finalCount > MAX_IMAGES) throw imageError(`A listing needs 1 to ${MAX_IMAGES} photos (you would have ${finalCount})`);

  const added = files.length ? await uploadImages(files) : [];
  const removed = current.filter((img) => !kept.some((k) => k.fileId === img.fileId));
  const finalImages = imageOrder
    ? imageOrder.map((t) => (t.startsWith('new:') ? added[Number(t.slice(4))]! : findCurrent(t)))
    : [...kept, ...added];

  try {
    property.set({ ...changes, images: finalImages });
    await property.save();
  } catch (error) {
    await deleteImages(added);
    throw error;
  }
  await deleteImages(removed); // only after the save worked

  res.json({ property });
}

// DELETE /api/properties/:id  (owner only)
export async function deleteProperty(req: Request, res: Response) {
  const user = currentUser(req);
  const property = await findOwnProperty(req.params.id as string, user.id as string);

  // Cancel upcoming viewings and tell the visitors
  const today = nowInIndia().date;
  const upcoming = await Appointment.find({ property: property._id, holdsSlot: true, date: { $gte: today } });
  for (const appointment of upcoming) {
    appointment.status = 'cancelled';
    appointment.cancelledBy = 'owner';
    await appointment.save();
    notifyAppointmentChange(appointment, 'updated');
    void sendEmail({
      to: appointment.email,
      subject: `Viewing cancelled: ${property.title}`,
      heading: 'Your property viewing was cancelled',
      paragraphs: [
        `Hi ${appointment.name.split(' ')[0]}, the owner removed "${property.title}" from EstateHub.`,
        `Your viewing on ${formatDateForHumans(appointment.date)} at ${formatTimeForHumans(appointment.time)} is cancelled.`,
      ],
    });
  }

  await property.deleteOne();
  await deleteImages(property.images);
  res.json({ message: 'Listing deleted', cancelledViewings: upcoming.length });
}
