// Pulls real system-wide activity data from Hubstaff's desktop agent, via
// their v2 API. This is what actually answers "which apps were they using"
// and "were they really idle" — something no browser-based tracker can see
// (browsers can't watch other applications; that's a deliberate security
// boundary, not a gap in our own code).
//
// SETUP (done once by a Founder, in Hubstaff's own app — not here):
//   1. Sign up at hubstaff.com, add your team as organization members.
//   2. Install the Hubstaff desktop agent on each employee's computer and
//      have them sign in — this is the piece that actually watches
//      keyboard/mouse and the active application, not our web app.
//   3. In the Hubstaff web app: Settings → Organization → API tokens →
//      create an Organization Access Token, assign it to any member with
//      manager/owner access (so it can read the whole org), no expiry.
//   4. Note your Organization ID (visible in the Hubstaff app URL/settings).
//   5. Put both in this project's .env:
//        HUBSTAFF_ORG_ACCESS_TOKEN="hsoat_..."
//        HUBSTAFF_ORGANIZATION_ID="123456"
//
// IMPORTANT: the exact endpoint paths below follow Hubstaff's documented v2
// API shape and their official client libraries, but I can't test them
// against a live account from here. Once real credentials are in place,
// verify a call or two against https://developer.hubstaff.com/ and adjust
// field names here if anything doesn't line up — third-party APIs do drift.

const HUBSTAFF_API_BASE = 'https://api.hubstaff.com/v2';

function isHubstaffConfigured() {
  return Boolean(process.env.HUBSTAFF_ORG_ACCESS_TOKEN && process.env.HUBSTAFF_ORGANIZATION_ID);
}

async function hubstaffGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (!isHubstaffConfigured()) return null;

  const url = new URL(`${HUBSTAFF_API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${process.env.HUBSTAFF_ORG_ACCESS_TOKEN}` },
      // Org access tokens are used as-is with no refresh step — see file header.
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error(`[hubstaff] ${path} returned ${res.status}: ${await res.text()}`);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.error(`[hubstaff] request to ${path} failed:`, err);
    return null;
  }
}

export interface HubstaffMember {
  id: number;
  email: string;
  name: string;
}

/** Lists organization members, used to match Hubstaff users to our own by email. */
export async function getHubstaffMembers(): Promise<HubstaffMember[]> {
  const orgId = process.env.HUBSTAFF_ORGANIZATION_ID;
  const data = await hubstaffGet<{ members: Array<{ id: number; user: { email: string; name: string } }> }>(
    `/organizations/${orgId}/members`
  );
  if (!data) return [];
  return data.members.map((m) => ({ id: m.id, email: m.user.email, name: m.user.name }));
}

export interface HubstaffDailyActivity {
  userId: number;
  date: string;
  trackedSeconds: number;
  keyboardPercent: number;
  mousePercent: number;
}

/** Per-user tracked time + input activity percentage for a single day. */
export async function getHubstaffDailyActivity(date: string): Promise<HubstaffDailyActivity[]> {
  const orgId = process.env.HUBSTAFF_ORGANIZATION_ID;
  const data = await hubstaffGet<{
    daily_activities: Array<{
      user_id: number;
      date: string;
      tracked: number;
      input_tracked?: number;
      keyboard?: number;
      mouse?: number;
    }>;
  }>(`/organizations/${orgId}/activities/daily`, { 'date[start]': date, 'date[stop]': date });

  if (!data) return [];

  return data.daily_activities.map((a) => ({
    userId: a.user_id,
    date: a.date,
    trackedSeconds: a.tracked ?? 0,
    keyboardPercent: a.keyboard ?? 0,
    mousePercent: a.mouse ?? 0,
  }));
}

export interface HubstaffAppUsage {
  userId: number;
  appName: string;
  seconds: number;
}

/** Which applications each user had active, and for how long, on a given day. */
export async function getHubstaffAppUsage(date: string): Promise<HubstaffAppUsage[]> {
  const orgId = process.env.HUBSTAFF_ORGANIZATION_ID;
  const data = await hubstaffGet<{
    application_details: Array<{ user_id: number; name: string; tracked: number }>;
  }>(`/organizations/${orgId}/activities/application_details`, {
    'time_slot[start]': `${date}T00:00:00Z`,
    'time_slot[stop]': `${date}T23:59:59Z`,
  });

  if (!data) return [];

  return data.application_details.map((a) => ({
    userId: a.user_id,
    appName: a.name,
    seconds: a.tracked ?? 0,
  }));
}

export { isHubstaffConfigured };
