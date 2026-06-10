import assert from 'node:assert/strict';
import { AdminService } from '../server/src/admin/admin.service';

type NotificationRecord = {
  userId: string;
  payload: {
    type: string;
    title: string;
    message: string;
    link: string;
    refId: string;
  };
};

function createAdminHarness(reportOverride?: Record<string, unknown>) {
  const notifications: NotificationRecord[] = [];
  const businessEvents: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const reportUpdates: unknown[] = [];
  const logCreates: unknown[] = [];
  const userUpdates: unknown[] = [];
  const lfgUpdates: unknown[] = [];

  const baseReport = {
    id: 'report-1',
    targetType: 'lfg_post',
    targetId: 'lfg-1',
    reporter: { id: 'reporter-1', nickname: 'Reporter' },
    reported: {
      id: 'reported-1',
      nickname: 'Reported',
      role: 'user',
      isBanned: false,
    },
  };

  const report = { ...baseReport, ...reportOverride };

  const prisma = {
    report: {
      findUnique: async () => report,
      update: async (input: unknown) => {
        reportUpdates.push(input);
        return input;
      },
      count: async () => 0,
      findMany: async () => [],
    },
    adminActionLog: {
      create: async (input: unknown) => {
        logCreates.push(input);
        return input;
      },
      findMany: async () => [],
    },
    user: {
      update: async (input: unknown) => {
        userUpdates.push(input);
        return input;
      },
      count: async () => 0,
      findUnique: async () => null,
      findMany: async () => [],
    },
    userRestriction: {
      count: async () => 0,
      findMany: async () => [],
      upsert: async () => null,
    },
    lfgPost: {
      update: async (input: unknown) => {
        lfgUpdates.push(input);
        return input;
      },
      findMany: async () => [],
      findUnique: async () => null,
    },
    chatMessage: { findUnique: async () => null },
    directMessage: { findUnique: async () => null },
    $transaction: async (callback: (tx: typeof prisma) => Promise<void>) => callback(prisma),
  };

  const service = new AdminService(
    prisma as never,
    {
      create: async (userId: string, payload: NotificationRecord['payload']) => {
        notifications.push({ userId, payload });
      },
    } as never,
    {
      log: (name: string, payload: Record<string, unknown>) => {
        businessEvents.push({ name, payload });
      },
    } as never,
    { revokeAllUserSessions: async () => {} } as never,
    { disconnectUserByBan: async () => {} } as never,
  );

  (service as unknown as { getReport: () => Promise<unknown> }).getReport = async () => ({
    id: report.id,
  });

  return {
    service,
    notifications,
    businessEvents,
    reportUpdates,
    logCreates,
    userUpdates,
    lfgUpdates,
  };
}

async function testBanActionFlow() {
  const harness = createAdminHarness({
    id: 'report-ban',
    targetType: 'chat_message',
    targetId: 'msg-1',
  });

  await harness.service.reviewReport(
    { id: 'admin-1', role: 'superAdmin', nickname: 'Admin' },
    'report-ban',
    { reviewStatus: 'resolved', actionTaken: 'ban', reviewNote: 'note' },
  );

  assert.equal(harness.reportUpdates.length, 1);
  assert.equal(harness.userUpdates.length, 1);
  assert.equal(harness.logCreates.length, 2);
  assert.equal(harness.notifications.length, 2);
  assert.equal(harness.notifications[0]?.userId, 'reporter-1');
  assert.equal(harness.notifications[0]?.payload.type, 'report_result');
  assert.equal(harness.notifications[1]?.userId, 'reported-1');
  assert.equal(harness.notifications[1]?.payload.type, 'admin_action');
  assert.equal(harness.businessEvents[0]?.name, 'admin.report.reviewed');
}

async function testHideLfgActionFlow() {
  const harness = createAdminHarness({
    id: 'report-lfg',
    targetType: 'lfg_post',
    targetId: 'lfg-post-1',
  });

  await harness.service.reviewReport(
    { id: 'admin-2', role: 'admin', nickname: 'Admin 2' },
    'report-lfg',
    { reviewStatus: 'resolved', actionTaken: 'hide_lfg' },
  );

  assert.equal(harness.lfgUpdates.length, 1);
  assert.equal(harness.userUpdates.length, 0);
  assert.equal(harness.logCreates.length, 2);
  assert.equal(harness.notifications.length, 2);
  assert.equal(harness.notifications[1]?.payload.refId, 'lfg-post-1');
}

async function testRejectedReviewDoesNotNotifyAdminAction() {
  const harness = createAdminHarness({
    id: 'report-rejected',
    targetType: 'chat_message',
    targetId: 'msg-2',
  });

  await harness.service.reviewReport(
    { id: 'admin-3', role: 'admin', nickname: 'Admin 3' },
    'report-rejected',
    { reviewStatus: 'rejected', actionTaken: 'none' },
  );

  assert.equal(harness.userUpdates.length, 0);
  assert.equal(harness.lfgUpdates.length, 0);
  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0]?.payload.type, 'report_result');
}

async function main() {
  await testBanActionFlow();
  await testHideLfgActionFlow();
  await testRejectedReviewDoesNotNotifyAdminAction();

  console.log('validated admin report review flows');
}

void main();
