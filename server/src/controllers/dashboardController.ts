import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.js';
import { Appointment } from '../models/Appointment.js';
import { Property } from '../models/Property.js';
import { nowInIndia } from '../utils/dates.js';

// GET /api/dashboard/summary – numbers for the dashboard cards
export async function getSummary(req: Request, res: Response) {
  const user = currentUser(req);
  const today = nowInIndia().date;

  const [listingStats, myUpcoming, pendingRequests, upcomingRequests] = await Promise.all([
    Property.aggregate<{ total: number; active: number; views: number }>([
      { $match: { owner: user._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          views: { $sum: '$views' },
        },
      },
    ]),
    Appointment.countDocuments({ user: user._id, holdsSlot: true, date: { $gte: today } }),
    Appointment.countDocuments({ owner: user._id, status: 'pending', date: { $gte: today } }),
    Appointment.countDocuments({ owner: user._id, status: 'confirmed', date: { $gte: today } }),
  ]);

  const stats = listingStats[0] ?? { total: 0, active: 0, views: 0 };
  res.json({
    summary: {
      totalListings: stats.total,
      activeListings: stats.active,
      totalViews: stats.views,
      myUpcomingViewings: myUpcoming,
      pendingRequests,
      confirmedUpcomingRequests: upcomingRequests,
    },
  });
}

// GET /api/dashboard/properties – all my listings (active and inactive) with request counts
export async function getMyProperties(req: Request, res: Response) {
  const user = currentUser(req);
  const today = nowInIndia().date;

  const [properties, pending] = await Promise.all([
    Property.find({ owner: user._id }).select('-description').sort({ createdAt: -1 }).lean(),
    Appointment.aggregate<{ _id: unknown; count: number }>([
      { $match: { owner: user._id, status: 'pending', date: { $gte: today } } },
      { $group: { _id: '$property', count: { $sum: 1 } } },
    ]),
  ]);
  const pendingByProperty = new Map(pending.map((p) => [String(p._id), p.count]));

  res.json({ properties: properties.map((p) => ({ ...p, pendingRequests: pendingByProperty.get(String(p._id)) ?? 0 })) });
}
