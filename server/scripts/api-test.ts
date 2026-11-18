/**
 * End-to-end API test for all modules. It talks to the running API like the real app does.
 *
 * It creates REAL data (test accounts, a listing with 4 images, viewings) in your database,
 * checks everything, then DELETES what it created – your database is left as it was.
 *
 *   1. npm run dev        (terminal 1)
 *   2. npm run test:api   (terminal 2)
 *
 * Another address:  API_URL=https://your-api.onrender.com npm run test:api
 * Note: the password-reset and guest-link checks need NODE_ENV=development without SMTP
 * (the API then returns the links instead of emailing them).
 */
const API = (process.env.API_URL ?? 'http://localhost:5000').replace(/\/$/, '');

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name: string, condition: unknown, details = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name} ${details}`);
  }
}
const skip = (name: string, why: string) => {
  skipped += 1;
  console.log(`  ⏭️  ${name} (${why})`);
};

interface ApiResult<T = any> {
  status: number;
  data: T;
  headers: Headers;
}

async function call<T = any>(method: string, path: string, opts: { token?: string; body?: unknown; form?: FormData; headers?: Record<string, string> } = {}): Promise<ApiResult<T>> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
      ...opts.headers,
    },
    body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON (e.g. sitemap) */
  }
  return { status: res.status, data, headers: res.headers };
}

// A real (tiny) PNG image, so the server's "is this really an image?" check passes
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const pngFile = () => new Blob([new Uint8Array(PNG)], { type: 'image/png' });

/** Date "YYYY-MM-DD" in India, N days from today */
function indiaDate(daysAhead: number): string {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Waits for one Server-Sent Event of the given name */
async function waitForEvent(path: string, eventName: string, timeoutMs = 8000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}${path}`, { signal: controller.signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return null;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        const name = block.match(/^event: (.+)$/m)?.[1];
        const data = block.match(/^data: (.+)$/m)?.[1];
        if (name === eventName && data) return JSON.parse(data);
      }
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

const stamp = Date.now();
const PASSWORD = 'Password123';
const owner = { name: 'Test Owner', email: `owner.${stamp}@example.com`, password: PASSWORD, phone: '9876543210' };
const visitor = { name: 'Test Visitor', email: `visitor.${stamp}@example.com`, password: PASSWORD };
const guestEmail = `guest.${stamp}@example.com`;
const cityName = `Testpur${stamp}`; // unique city so filters only match our listing

const cleanup: Array<() => Promise<unknown>> = [];

async function run() {
  console.log(`\nTesting ${API}\n`);

  console.log('Health');
  const health = await call('GET', '/api/health');
  check('API is up and MongoDB is connected', health.status === 200 && health.data.database === 'connected', JSON.stringify(health.data));
  const config = await call('GET', '/api/config');
  check('Public config is available', config.status === 200 && config.data.maxImages === 4);

  /* ------------------------------------------------------------------ */
  console.log('\nModule 1 – Authentication');
  const bad = await call('POST', '/api/auth/register', { body: { name: 'A', email: 'nope', password: '123' } });
  check('Invalid sign-up returns field errors (400)', bad.status === 400 && bad.data.errors?.length >= 3);

  const regOwner = await call('POST', '/api/auth/register', { body: owner });
  check('Owner can register', regOwner.status === 201 && regOwner.data.token && !regOwner.data.user.password);
  let ownerToken: string = regOwner.data.token;
  cleanup.push(() => call('DELETE', '/api/users/me', { token: ownerToken, body: { password: owner.password } }));

  const regVisitor = await call('POST', '/api/auth/register', { body: visitor });
  check('Visitor can register', regVisitor.status === 201);
  const visitorToken: string = regVisitor.data.token;
  cleanup.push(() => call('DELETE', '/api/users/me', { token: visitorToken, body: { password: visitor.password } }));

  check('Same email cannot register twice (409)', (await call('POST', '/api/auth/register', { body: owner })).status === 409);
  check('Wrong password is rejected (401)', (await call('POST', '/api/auth/login', { body: { email: owner.email, password: 'Wrong1234' } })).status === 401);
  check('Correct login works', (await call('POST', '/api/auth/login', { body: { email: owner.email, password: owner.password } })).status === 200);

  const me = await call('GET', '/api/users/me', { token: ownerToken });
  check('GET /api/users/me returns the user', me.status === 200 && me.data.user.email === owner.email);
  check('GET /api/users/me without token is blocked (401)', (await call('GET', '/api/users/me')).status === 401);

  const forgot = await call('POST', '/api/auth/forgot-password', { body: { email: owner.email } });
  check('Forgot password answers with a generic message', forgot.status === 200 && /If an account exists/.test(forgot.data.message));
  const unknown = await call('POST', '/api/auth/forgot-password', { body: { email: `nobody.${stamp}@example.com` } });
  check('Unknown email gets the same answer (no account discovery)', unknown.status === 200 && unknown.data.message === forgot.data.message);

  const resetToken = forgot.data.devResetUrl ? new URL(forgot.data.devResetUrl).searchParams.get('token') : null;
  if (resetToken) {
    const newPassword = 'NewPassword456';
    const reset = await call('POST', '/api/auth/reset-password', { body: { token: resetToken, password: newPassword } });
    check('Password reset with the emailed token works', reset.status === 200 && reset.data.token);
    check('Old login token stops working after a reset (401)', (await call('GET', '/api/users/me', { token: ownerToken })).status === 401);
    check('Reset link cannot be used twice (400)', (await call('POST', '/api/auth/reset-password', { body: { token: resetToken, password: 'Another789x' } })).status === 400);
    const relogin = await call('POST', '/api/auth/login', { body: { email: owner.email, password: newPassword } });
    check('Login with the new password works', relogin.status === 200);
    ownerToken = relogin.data.token;
    owner.password = newPassword;
  } else {
    skip('Password reset flow', 'SMTP is configured, so the link was emailed instead of returned');
  }

  /* ------------------------------------------------------------------ */
  console.log('\nModule 2 – Properties, filters & images');
  const listing = {
    title: 'Sunny 2 BHK apartment near the metro',
    description: 'A bright, airy 2 BHK on the 7th floor with a balcony, modular kitchen and covered parking. Walking distance to the metro and schools.',
    purpose: 'sale',
    type: 'apartment',
    price: 7_800_000,
    area: 1050,
    bedrooms: 2,
    bathrooms: 2,
    furnishing: 'semi-furnished',
    amenities: ['Lift', 'Power backup', 'Covered parking'],
    location: { address: 'Tower B, Green Meadows, Ring Road', locality: 'Green Park', city: cityName, state: 'Gujarat', pincode: '380058' },
  };
  const makeForm = (data: unknown, images: number, fake = false) => {
    const form = new FormData();
    form.append('data', JSON.stringify(data));
    for (let i = 0; i < images; i++) form.append('images', pngFile(), `photo${i}.png`);
    if (fake) form.append('images', new Blob(['not an image'], { type: 'image/jpeg' }), 'fake.jpg');
    return form;
  };

  check('Listing without photos is rejected (400)', (await call('POST', '/api/properties', { token: ownerToken, form: makeForm(listing, 0) })).status === 400);
  check('A fake image file is rejected (400)', (await call('POST', '/api/properties', { token: ownerToken, form: makeForm(listing, 1, true) })).status === 400);
  check('More than 4 photos is rejected (400)', (await call('POST', '/api/properties', { token: ownerToken, form: makeForm(listing, 5) })).status === 400);
  check('Creating needs a login (401)', (await call('POST', '/api/properties', { form: makeForm(listing, 1) })).status === 401);
  const badData = await call('POST', '/api/properties', { token: ownerToken, form: makeForm({ ...listing, price: 'abc', location: { ...listing.location, pincode: '12' } }, 1) });
  check('Invalid fields return field errors (400)', badData.status === 400 && badData.data.errors?.some((e: any) => e.field === 'location.pincode'));

  const created = await call('POST', '/api/properties', { token: ownerToken, form: makeForm(listing, 4) });
  check('Owner creates a listing with 4 photos (201)', created.status === 201 && created.data.property?.images?.length === 4, JSON.stringify(created.data).slice(0, 200));
  const property = created.data.property;
  const propertyId: string = property?._id;

  const firstUrl: string = property.images[0].url;
  const firstImage = await fetch(firstUrl.startsWith('http') ? firstUrl : `${API}${firstUrl}`);
  check('Uploaded photo can be downloaded', firstImage.status === 200);

  const filtered = await call('GET', `/api/properties?location=${cityName}&type=apartment&minPrice=7000000&maxPrice=8000000&minArea=1000&maxArea=1200&purpose=sale`);
  check('Filter by location + type + price + area finds it', filtered.status === 200 && filtered.data.properties.some((p: any) => p._id === propertyId));
  const tooCheap = await call('GET', `/api/properties?location=${cityName}&maxPrice=5000000`);
  check('Price filter excludes it when over budget', tooCheap.status === 200 && tooCheap.data.properties.length === 0);
  const wrongType = await call('GET', `/api/properties?location=${cityName}&type=villa`);
  check('Type filter excludes it for villas', wrongType.data.properties?.length === 0);
  const smallArea = await call('GET', `/api/properties?location=${cityName}&maxArea=900`);
  check('Area filter excludes it when too big', smallArea.data.properties?.length === 0);
  check('Invalid filter (min > max) is rejected (400)', (await call('GET', '/api/properties?minPrice=900&maxPrice=100')).status === 400);

  const viewed = await call('GET', `/api/properties/${propertyId}`, { token: visitorToken });
  check('Property page loads and shows owner phone to logged-in users', viewed.status === 200 && viewed.data.property.owner.phone === owner.phone);
  const anon = await call('GET', `/api/properties/${propertyId}`);
  check('Owner phone is hidden from guests', anon.status === 200 && anon.data.property.owner.phone === undefined);
  check('Recommendations endpoint works', (await call('GET', `/api/properties/${propertyId}/similar`)).status === 200);

  check('Another user cannot edit it (403)', (await call('PATCH', `/api/properties/${propertyId}`, { token: visitorToken, body: { price: 1 } })).status === 403);
  check('Another user cannot delete it (403)', (await call('DELETE', `/api/properties/${propertyId}`, { token: visitorToken })).status === 403);

  const keep = property.images.slice(0, 2).map((i: any) => i.fileId);
  const removedUrl: string = property.images[3].url;
  const updated = await call('PATCH', `/api/properties/${propertyId}`, { token: ownerToken, form: makeForm({ price: 7_500_000, keepImages: keep }, 1) });
  check('Owner edits price and photos (keep 2 + add 1 = 3)', updated.status === 200 && updated.data.property.price === 7_500_000 && updated.data.property.images.length === 3);
  if (!removedUrl.startsWith('http')) {
    check('Removed photo is deleted from storage', (await fetch(`${API}${removedUrl}`)).status === 404);
  }
  const reordered = await call('PATCH', `/api/properties/${propertyId}`, { token: ownerToken, form: makeForm({ imageOrder: ['new:0', keep[0]] }, 1) });
  check('Owner sets a new photo as the cover (photo order)', reordered.status === 200 && reordered.data.property.images.length === 2 && reordered.data.property.images[1].fileId === keep[0]);
  check('Wrong photo order is rejected (400)', (await call('PATCH', `/api/properties/${propertyId}`, { token: ownerToken, form: makeForm({ imageOrder: ['new:0', 'new:1'] }, 1) })).status === 400);

  /* ------------------------------------------------------------------ */
  console.log('\nModule 3 – Appointments & dashboard');
  const date = indiaDate(2);
  const slots = await call('GET', `/api/properties/${propertyId}/slots?date=${date}`);
  check('Viewing slots are listed', slots.status === 200 && slots.data.slots.length === 17 && slots.data.slots.every((s: any) => s.available));

  const guest = await call('POST', '/api/appointments/guest', {
    body: { propertyId, date, time: '11:00', name: 'Guest Person', email: guestEmail, phone: '9123456780', message: 'Is parking included?' },
  });
  check('Guest books a viewing without an account (201)', guest.status === 201 && guest.data.appointment.status === 'pending');
  const guestAppointmentId: string = guest.data.appointment?._id;

  const taken = await call('POST', '/api/appointments', { token: visitorToken, body: { propertyId, date, time: '11:00', phone: '9988776655' } });
  check('The same slot cannot be booked twice (409)', taken.status === 409 && taken.data.code === 'SLOT_TAKEN');

  const race = await Promise.all(
    [1, 2, 3, 4, 5].map((n) =>
      call('POST', '/api/appointments/guest', { body: { propertyId, date, time: '15:00', name: `Racer ${n}`, email: `racer${n}.${stamp}@example.com`, phone: '9000000000' } })
    )
  );
  const winners = race.filter((r) => r.status === 201).length;
  check('5 people booking the same slot at the same moment → exactly 1 wins', winners === 1, `(${winners} won)`);

  check('Owner cannot book their own property (400)', (await call('POST', '/api/appointments', { token: ownerToken, body: { propertyId, date, time: '12:00' } })).status === 400);
  check('A time in the past is rejected (400)', (await call('POST', '/api/appointments', { token: visitorToken, body: { propertyId, date: indiaDate(-1), time: '12:00', phone: '9988776655' } })).status === 400);
  check('A time outside 10:00–18:00 is rejected (400)', (await call('POST', '/api/appointments', { token: visitorToken, body: { propertyId, date, time: '22:00', phone: '9988776655' } })).status === 400);
  const noPhone = await call('POST', '/api/appointments', { token: visitorToken, body: { propertyId, date, time: '12:00' } });
  check('Logged-in user without phone is asked for one (400)', noPhone.status === 400 && noPhone.data.errors?.[0]?.field === 'phone');

  const userBooking = await call('POST', '/api/appointments', { token: visitorToken, body: { propertyId, date, time: '12:00', phone: '9988776655' } });
  check('Logged-in user books a viewing (201)', userBooking.status === 201);
  const visitorAppointmentId: string = userBooking.data.appointment?._id;
  check('Same person cannot hold two viewings of one property (409)', (await call('POST', '/api/appointments', { token: visitorToken, body: { propertyId, date, time: '13:00' } })).status === 409);

  const after = await call('GET', `/api/properties/${propertyId}/slots?date=${date}`);
  check('Booked slots show as unavailable', after.data.slots.filter((s: any) => !s.available).map((s: any) => s.time).join() === '11:00,12:00,15:00');

  const mine = await call('GET', '/api/appointments/mine', { token: visitorToken });
  check('Visitor sees their appointment in the dashboard', mine.status === 200 && mine.data.appointments.some((a: any) => a._id === visitorAppointmentId));
  const received = await call('GET', '/api/appointments/received', { token: ownerToken });
  check('Owner sees all requests for their property', received.status === 200 && received.data.appointments.length === 3);

  // Live updates: the visitor's open stream receives the owner's confirmation instantly
  const ticket = await call('POST', '/api/realtime/ticket', { token: visitorToken });
  check('Live-updates ticket is issued', ticket.status === 200 && ticket.data.ticket);
  const eventPromise = waitForEvent(`/api/realtime/stream?ticket=${ticket.data.ticket}`, 'appointment.updated');
  await new Promise((r) => setTimeout(r, 700)); // give the stream a moment to connect

  check('Visitor cannot confirm their own booking (403)', (await call('PATCH', `/api/appointments/${visitorAppointmentId}/status`, { token: visitorToken, body: { status: 'confirmed' } })).status === 403);
  const confirm = await call('PATCH', `/api/appointments/${visitorAppointmentId}/status`, { token: ownerToken, body: { status: 'confirmed' } });
  check('Owner confirms the viewing', confirm.status === 200 && confirm.data.appointment.status === 'confirmed');
  const event = await eventPromise;
  check('Visitor receives a live update immediately', event?.appointmentId === visitorAppointmentId && event?.status === 'confirmed', JSON.stringify(event));

  const cancel = await call('PATCH', `/api/appointments/${visitorAppointmentId}/status`, { token: visitorToken, body: { status: 'cancelled' } });
  check('Visitor cancels their viewing', cancel.status === 200 && cancel.data.appointment.status === 'cancelled' && cancel.data.appointment.cancelledBy === 'visitor');
  const freed = await call('GET', `/api/properties/${propertyId}/slots?date=${date}`);
  check('Cancelled slot becomes free again', freed.data.slots.find((s: any) => s.time === '12:00')?.available === true);
  check('Stranger cannot change an appointment (403)', (await call('PATCH', `/api/appointments/${guestAppointmentId}/status`, { token: visitorToken, body: { status: 'cancelled' } })).status === 403);

  if (guest.data.devManageUrl) {
    const manage = new URL(guest.data.devManageUrl, 'http://x');
    const token = manage.searchParams.get('token');
    check('Guest link with a wrong token is refused (404)', (await call('GET', `/api/appointments/${guestAppointmentId}/guest?token=${'0'.repeat(64)}`)).status === 404);
    check('Guest opens their booking from the email link', (await call('GET', `/api/appointments/${guestAppointmentId}/guest?token=${token}`)).status === 200);

    // Guest later creates an account with the same email → old booking appears in the dashboard
    const regGuest = await call('POST', '/api/auth/register', { body: { name: 'Guest Person', email: guestEmail, password: PASSWORD } });
    cleanup.push(() => call('DELETE', '/api/users/me', { token: regGuest.data.token, body: { password: PASSWORD } }));
    const guestMine = await call('GET', '/api/appointments/mine', { token: regGuest.data.token });
    check('Guest bookings appear after signing up with the same email', guestMine.data.appointments?.some((a: any) => a._id === guestAppointmentId));

    const guestCancel = await call('POST', `/api/appointments/${guestAppointmentId}/guest-cancel`, { body: { token } });
    check('Guest cancels with the email link', guestCancel.status === 200 && guestCancel.data.appointment.status === 'cancelled');
  } else {
    skip('Guest email-link checks', 'SMTP is configured, so the link was emailed instead of returned');
  }

  const summary = await call('GET', '/api/dashboard/summary', { token: ownerToken });
  check('Dashboard summary works', summary.status === 200 && summary.data.summary.totalListings === 1 && summary.data.summary.totalViews >= 1);
  const myListings = await call('GET', '/api/dashboard/properties', { token: ownerToken });
  check('Dashboard lists my properties with request counts', myListings.data.properties?.[0]?._id === propertyId && myListings.data.properties[0].pendingRequests === 1);
  check('Dashboard needs a login (401)', (await call('GET', '/api/dashboard/summary')).status === 401);

  /* ------------------------------------------------------------------ */
  console.log('\nModule 4 – Security & SEO');
  check('Security headers are set (Helmet)', health.headers.get('x-content-type-options') === 'nosniff');
  check('Rate limit headers are sent', Boolean((await call('GET', '/api/properties?limit=1')).headers.get('ratelimit')));
  const cors = await fetch(`${API}/api/health`, { headers: { Origin: 'https://evil.example.com' } });
  check('Unknown websites are blocked by CORS (403)', cors.status === 403);
  const sitemap = await call('GET', '/sitemap.xml');
  check('sitemap.xml is generated from live listings', sitemap.status === 200 && String(sitemap.data).includes('<urlset'));
  check('Unknown route returns 404 JSON', (await call('GET', '/api/does-not-exist')).status === 404);
  check('Invalid id returns 400', (await call('GET', '/api/properties/123')).status === 400);

  /* ------------------------------------------------------------------ */
  console.log('\nModule 5 – AI Property Hub (optional)');
  const aiStatus = await call('GET', '/api/ai/status');
  if (aiStatus.status === 404) {
    check('AI Hub is off and answers 404 (feature flag works)', (await call('POST', '/api/ai/search', { body: { city: cityName } })).status === 404);
  } else {
    check('AI Hub status is available', aiStatus.status === 200 && aiStatus.data.enabled);
    check('Bad Firecrawl key format is rejected (400)', (await call('POST', '/api/ai/search', { body: { city: cityName }, headers: { 'x-firecrawl-key': 'nope' } })).status === 400);
    if (!aiStatus.data.serverFirecrawlKey) {
      const hub = await call('POST', '/api/ai/search', { body: { city: cityName, bedrooms: 2, maxBudget: 8_000_000 } });
      check('AI search ranks our own live listings', hub.status === 200 && hub.data.results.some((r: any) => r.propertyId === propertyId), JSON.stringify(hub.data).slice(0, 300));
    } else {
      skip('Platform-only AI search', 'a server Firecrawl key is set (would spend credits)');
    }
  }

  /* ------------------------------------------------------------------ */
  console.log('\nCleanup');
  const del = await call('DELETE', `/api/properties/${propertyId}`, { token: ownerToken });
  check('Owner deletes the listing (photos and upcoming viewings handled)', del.status === 200);
  check('Deleted listing is gone (404)', (await call('GET', `/api/properties/${propertyId}`)).status === 404);
}

run()
  .catch((error) => {
    failed += 1;
    console.error(`\n❌ Test crashed. Is the API running at ${API}?\n`, error);
  })
  .finally(async () => {
    for (const task of cleanup.reverse()) await task().catch(() => undefined);
    console.log(`  🧹 Removed test accounts\n`);
    console.log(`${failed === 0 ? '🎉' : '⚠️ '} ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}\n`);
    process.exit(failed === 0 ? 0 : 1);
  });
