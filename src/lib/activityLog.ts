import prisma from './prisma';

export async function logActivity({
  userId,
  action,
  targetType,
  targetId,
  detail,
}: {
  userId: string;
  action: string;
  targetType: 'Transaction' | 'CateringOrder' | 'User' | 'Account' | string;
  targetId: string;
  detail?: string;
}) {
  try {
    return await prisma.activityLog.create({
      data: {
        userId,
        action,
        targetType,
        targetId,
        detail,
      },
    });
  } catch (error) {
    console.error('Gagal mencatat log aktivitas:', error);
    // Non-blocking
    return null;
  }
}
