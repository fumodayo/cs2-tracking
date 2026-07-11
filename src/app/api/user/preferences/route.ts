import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/infrastructure/db/mongo-client';
import { getCurrentUser } from '@/services/auth-service';
import { publishUserPreferencesChanged } from '@/services/realtime/user-preferences-events';
import {
  normalizeExcelMappingTemplates,
  normalizeUserPreferences,
  normalizeUserPricingPreferences,
  type UserPreferences,
} from '@/types/user-preferences';
import { getErrorMessage } from '@/utils/error';

const COLLECTION = 'user_preferences';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ownerId = await requireOwnerId();
    return NextResponse.json({ preferences: await readUserPreferences(ownerId) });
  } catch (error) {
    return handlePreferencesError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ownerId = await requireOwnerId();
    const body = await request.json();
    const update = buildPreferencesUpdate(body);
    const changedSections = getChangedPreferenceSections(body);

    if (Object.keys(update.$set).length > 1) {
      const db = await getDatabase();
      await db.collection(COLLECTION).updateOne(
        { ownerId },
        {
          ...update,
          $setOnInsert: { ownerId, createdAt: new Date() },
        },
        { upsert: true }
      );
      await publishUserPreferencesChanged(ownerId, 'updated', { sections: changedSections });
    }

    return NextResponse.json({ preferences: await readUserPreferences(ownerId) });
  } catch (error) {
    return handlePreferencesError(error);
  }
}

function getChangedPreferenceSections(body: unknown): string[] {
  const source = isRecord(body) ? body : {};
  const sections: string[] = [];

  if ('excelMappingTemplates' in source) {
    sections.push('excelMappingTemplates');
  }
  if ('pricing' in source) {
    sections.push('pricing');
  }

  return sections;
}

async function requireOwnerId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new PreferencesApiError('unauthorized', 401);
  }
  return `google:${user.id}`;
}

async function readUserPreferences(ownerId: string): Promise<UserPreferences> {
  const db = await getDatabase();
  const doc = await db.collection(COLLECTION).findOne({ ownerId }, { projection: { _id: 0 } });
  return normalizeUserPreferences(doc);
}

function buildPreferencesUpdate(body: unknown): { $set: Record<string, unknown> } {
  const source = isRecord(body) ? body : {};
  const now = new Date();
  const $set: Record<string, unknown> = { updatedAt: now };

  if ('excelMappingTemplates' in source) {
    $set.excelMappingTemplates = normalizeExcelMappingTemplates(source.excelMappingTemplates);
  }

  if ('pricing' in source) {
    const pricing = normalizeUserPricingPreferences(source.pricing);
    for (const [key, value] of Object.entries(pricing)) {
      $set[`pricing.${key}`] = value;
    }
  }

  return { $set };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function handlePreferencesError(error: unknown) {
  if (error instanceof PreferencesApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }

  return NextResponse.json(
    { message: getErrorMessage(error, 'cannotSyncUserPreferences') },
    { status: 500 }
  );
}

class PreferencesApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
