import { NextRequest, NextResponse } from 'next/server';
import { ModelAccessService, UserService } from '@/lib/database';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertAdmin() {
  const sessionUser = await getSessionUser();

  if (!sessionUser || !sessionUser.isAdmin) {
    return null;
  }

  return sessionUser;
}

export async function GET() {
  const sessionUser = await assertAdmin();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [settings, users, overrides] = await Promise.all([
      ModelAccessService.getSettings(),
      UserService.listUsersDetailed(200),
      ModelAccessService.listUserOverrides(),
    ]);

    const overrideMap = new Map(overrides.map((override) => [override.userId, override]));

    return NextResponse.json({
      success: true,
      settings,
      users: users.map((user) => ({
        ...user,
        modelPolicy: overrideMap.get(user.id) || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load model policies' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const sessionUser = await assertAdmin();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  try {
    await ModelAccessService.updateSettings(
      {
        accessMode: body.accessMode,
        allowedEmails: Array.isArray(body.allowedEmails) ? body.allowedEmails : undefined,
        blockedEmails: Array.isArray(body.blockedEmails) ? body.blockedEmails : undefined,
        defaultRateLimit: body.defaultRateLimit !== undefined ? Number(body.defaultRateLimit) : undefined,
        defaultRateWindowMinutes:
          body.defaultRateWindowMinutes !== undefined ? Number(body.defaultRateWindowMinutes) : undefined,
        adminsBypassAccess:
          body.adminsBypassAccess === undefined ? undefined : Boolean(body.adminsBypassAccess),
        adminsBypassRateLimit:
          body.adminsBypassRateLimit === undefined ? undefined : Boolean(body.adminsBypassRateLimit),
        allowManualUpload:
          body.allowManualUpload === undefined ? undefined : Boolean(body.allowManualUpload),
        allowDirectHuggingFaceUrl:
          body.allowDirectHuggingFaceUrl === undefined ? undefined : Boolean(body.allowDirectHuggingFaceUrl),
        maxUploadSizeMb:
          body.maxUploadSizeMb === undefined ? undefined : Number(body.maxUploadSizeMb),
      },
      sessionUser.id
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update model policies' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sessionUser = await assertAdmin();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || '').trim();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    await ModelAccessService.upsertUserOverride(
      userId,
      {
        canAccessModels:
          body.canAccessModels === null || body.canAccessModels === undefined
            ? body.canAccessModels
            : Boolean(body.canAccessModels),
        rateLimit: body.rateLimit === '' ? null : body.rateLimit === undefined ? undefined : Number(body.rateLimit),
        rateWindowMinutes:
          body.rateWindowMinutes === '' ? null : body.rateWindowMinutes === undefined ? undefined : Number(body.rateWindowMinutes),
        notes: body.notes === undefined ? undefined : String(body.notes),
      },
      sessionUser.id
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save model policy override' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sessionUser = await assertAdmin();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || '').trim();

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    await ModelAccessService.deleteUserOverride(userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to remove model policy override' }, { status: 500 });
  }
}