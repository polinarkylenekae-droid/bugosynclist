import { getPrismaClient } from './prisma';

export interface AppDatabaseShape {
  users: any[];
  programs: any[];
  applications: any[];
  announcements: any[];
  activityLogs: any[];
  archivedItems: any[];
  notifications: any[];
  census: any;
}

export async function loadDatabaseFromMySQL(fallbackCensus: any): Promise<AppDatabaseShape | null> {
  const prisma = getPrismaClient();
  if (!prisma) return null;

  const [
    users,
    programs,
    applications,
    announcements,
    censusRows,
    notifications,
    activityLogs,
    archivedRecords,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.assistanceProgram.findMany(),
    prisma.assistanceApplication.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.censusPurok.findMany({ orderBy: { id: 'asc' } }),
    prisma.notification.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.activityLog.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.archivedRecord.findMany({ orderBy: { archivedAt: 'desc' } }),
  ]);

  const mappedUsers = users.map((u) => {
    const extra = (u.extraProfileJson && typeof u.extraProfileJson === 'object') ? (u.extraProfileJson as Record<string, any>) : {};
    return {
      ...extra,
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.email,
      passwordHash: u.passwordHash,
      role: u.role as 'admin' | 'resident',
      contactNumber: u.contactNumber,
      purok: u.purok,
      address: u.address,
      residentIdNumber: u.residentIdNumber,
      isVerified: u.isVerified,
      registrationStatus: u.registrationStatus,
      isBanned: u.isBanned,
      banReason: u.banReason ?? undefined,
      registeredDate: u.registeredDate,
      nationality: u.nationality,
      occupation: u.occupation ?? undefined,
      employmentStatus: u.employmentStatus ?? undefined,
      householdIncome: u.householdIncome ?? undefined,
      familyMembersCount: u.familyMembersCount,
      voterStatus: u.voterStatus,
      age: u.age ?? undefined,
      gender: u.gender ?? undefined,
      avatarUrl: u.avatarUrl ?? undefined,
      pendingProfileUpdate: u.pendingProfileJson ?? undefined,
    };
  });

  const mappedPrograms = programs.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    tagline: p.tagline ?? '',
    description: p.description,
    imageUrl: p.imageUrl,
    status: p.status,
    badgeText: p.badgeText ?? undefined,
    deadline: p.deadline ?? undefined,
    targetAudience: p.targetAudience ?? undefined,
    processingTime: p.processingTime ?? undefined,
    maxBenefitAmount: p.maxBenefitAmount ?? undefined,
    requirements: Array.isArray(p.requirementsJson) ? p.requirementsJson : [],
    eligibilityCriteria: Array.isArray(p.eligibilityCriteriaJson) ? p.eligibilityCriteriaJson : [],
  }));

  const mappedApplications = applications.map((a) => ({
    id: a.id,
    referenceCode: a.referenceCode,
    programId: a.programId,
    programTitle: a.programTitle,
    programCategory: a.programCategory ?? undefined,
    applicantId: a.applicantId,
    applicantName: a.applicantName,
    contactNumber: a.contactNumber,
    email: a.email ?? undefined,
    purok: a.purok,
    address: a.address ?? undefined,
    householdMonthlyIncome: a.householdMonthlyIncome ?? undefined,
    familyMembersCount: a.familyMembersCount ?? undefined,
    occupation: a.occupation ?? undefined,
    purposeOrDiagnosis: a.purposeOrDiagnosis ?? undefined,
    status: a.status,
    submissionDate: a.submissionDate,
    lastUpdated: a.lastUpdated ?? a.submissionDate,
    requestedAmount: a.requestedAmount ?? undefined,
    approvedAmount: a.approvedAmount ?? undefined,
    evaluatorNotes: a.evaluatorNotes ?? undefined,
    rejectionReason: a.rejectionReason ?? undefined,
    priorityScore: a.priorityScore ?? undefined,
    documents: Array.isArray(a.supportingDocumentsJson) ? a.supportingDocumentsJson : [],
    timeline: Array.isArray(a.timelineJson) ? a.timelineJson : [],
    eligibilityEvaluation: a.eligibilityJson ?? undefined,
    officialReceiptNumber: a.officialReceiptNumber ?? undefined,
    paymentMethod: a.paymentMethod ?? undefined,
    disbursedBy: a.disbursedBy ?? undefined,
    disbursedAt: a.disbursedAt ?? undefined,
    resubmittedAt: a.resubmittedAt ?? undefined,
    resubmittedNote: a.resubmittedNote ?? undefined,
  }));

  const mappedAnnouncements = announcements.map((a) => {
    const extra = (a.extraJson && typeof a.extraJson === 'object') ? (a.extraJson as Record<string, any>) : {};
    return {
      ...extra,
      id: a.id,
      title: a.title,
      category: a.category,
      description: a.description,
      date: a.date,
      viewsCount: a.viewsCount,
      iconType: a.iconType,
      isPinned: a.isPinned,
      status: a.status,
      targetAudienceType: a.targetAudienceType ?? undefined,
    };
  });

  const mappedNotifications = notifications.map((n) => ({
    id: n.id,
    userId: n.userId ?? undefined,
    title: n.title,
    message: n.message,
    read: n.read,
    type: n.type,
    timestamp: n.timestamp,
    createdAt: n.createdAt.toISOString(),
    applicationRef: n.applicationRef ?? undefined,
    targetArea: n.targetArea ?? undefined,
    documentData: n.documentDataJson ?? undefined,
  }));

  const mappedArchives = archivedRecords.map((r) => ({
    id: r.id,
    title: r.title,
    originalCategory: r.originalCategory,
    referenceCode: r.referenceCode,
    deletedBy: r.deletedBy,
    deletedAt: r.deletedAt,
    status: r.status,
    reasonForArchive: r.reasonForArchive ?? undefined,
    originalData: r.originalDataJson ?? undefined,
  }));

  let census = fallbackCensus;
  if (censusRows.length > 0) {
    census = {
      totalPopulation: censusRows.reduce((sum, r) => sum + r.population, 0),
      totalHouseholds: censusRows.reduce((sum, r) => sum + r.households, 0),
      registeredVoters: censusRows.reduce((sum, r) => sum + r.registeredVoters, 0),
      seniorCitizens: censusRows.reduce((sum, r) => sum + r.seniorCitizens, 0),
      workingAge: censusRows.reduce((sum, r) => sum + r.workingAge, 0),
      minors: censusRows.reduce((sum, r) => sum + r.minors, 0),
      purokBreakdown: censusRows.map((r) => ({
        purok: r.purokName,
        population: r.population,
        households: r.households,
      })),
      lastUpdated: censusRows[0]?.updatedAt.toISOString().split('T')[0] || fallbackCensus?.lastUpdated,
    };
  }

  return {
    users: mappedUsers,
    programs: mappedPrograms,
    applications: mappedApplications,
    announcements: mappedAnnouncements,
    activityLogs,
    archivedItems: mappedArchives,
    notifications: mappedNotifications,
    census,
  };
}

export async function syncUserToMySQL(user: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !user?.id) return;

  const extraKeys = [
    'firstName',
    'middleName',
    'lastName',
    'suffix',
    'birthdate',
    'rejectionReason',
    'autoValidatedFromApplication',
    'autoValidatedRefCode',
    'civilStatus',
    'yearsOfResidency',
    'idType',
    'idNumber',
    'isPwd',
    'pwdIdNumber',
    'pwdDisabilityType',
    'isSoloParent',
    'soloParentIdNumber',
    'isSenior',
    'seniorIdNumber',
    'isStudent',
    'schoolName',
    'studentLevel',
    'isTeenager',
    'frontIdUrl',
    'backIdUrl',
    'idPhotoAnalysis',
    'backIdPhotoAnalysis',
    'hasMedicalNeed',
    'medicalConditionNote',
    'isDisasterAffected',
    'disasterType',
    'disasterDamageLevel',
    'accountSource',
  ];
  const extraProfileJson: Record<string, any> = {};
  for (const k of extraKeys) {
    if (user[k] !== undefined) extraProfileJson[k] = user[k];
  }

  await prisma.user.upsert({
    where: { id: user.id },
    update: {
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role || 'resident',
      contactNumber: user.contactNumber || '',
      purok: user.purok || 'Zone 1',
      address: user.address || '',
      residentIdNumber: user.residentIdNumber,
      isVerified: user.isVerified !== undefined ? Boolean(user.isVerified) : true,
      registrationStatus: user.registrationStatus || 'Verified',
      isBanned: Boolean(user.isBanned),
      banReason: user.banReason ?? null,
      registeredDate: user.registeredDate || new Date().toISOString().split('T')[0],
      nationality: user.nationality || 'Filipino',
      occupation: user.occupation ?? null,
      employmentStatus: user.employmentStatus ?? null,
      householdIncome: user.householdIncome ?? null,
      familyMembersCount: Number(user.familyMembersCount) || 1,
      voterStatus: user.voterStatus || 'Registered',
      age: user.age !== undefined ? Number(user.age) : null,
      gender: user.gender ?? null,
      avatarUrl: user.avatarUrl ?? null,
      pendingProfileJson: user.pendingProfileUpdate ?? null,
      extraProfileJson: Object.keys(extraProfileJson).length > 0 ? extraProfileJson : null,
    },
    create: {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role || 'resident',
      contactNumber: user.contactNumber || '',
      purok: user.purok || 'Zone 1',
      address: user.address || '',
      residentIdNumber: user.residentIdNumber,
      isVerified: user.isVerified !== undefined ? Boolean(user.isVerified) : true,
      registrationStatus: user.registrationStatus || 'Verified',
      isBanned: Boolean(user.isBanned),
      banReason: user.banReason ?? null,
      registeredDate: user.registeredDate || new Date().toISOString().split('T')[0],
      nationality: user.nationality || 'Filipino',
      occupation: user.occupation ?? null,
      employmentStatus: user.employmentStatus ?? null,
      householdIncome: user.householdIncome ?? null,
      familyMembersCount: Number(user.familyMembersCount) || 1,
      voterStatus: user.voterStatus || 'Registered',
      age: user.age !== undefined ? Number(user.age) : null,
      gender: user.gender ?? null,
      avatarUrl: user.avatarUrl ?? null,
      pendingProfileJson: user.pendingProfileUpdate ?? null,
      extraProfileJson: Object.keys(extraProfileJson).length > 0 ? extraProfileJson : null,
    },
  });
}

export async function syncApplicationToMySQL(appItem: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !appItem?.id) return;

  const payload = {
    referenceCode: appItem.referenceCode,
    programId: appItem.programId,
    programTitle: appItem.programTitle,
    programCategory: appItem.programCategory ?? null,
    applicantId: appItem.applicantId,
    applicantName: appItem.applicantName,
    contactNumber: appItem.contactNumber || '',
    email: appItem.email ?? null,
    purok: appItem.purok || 'Zone 1',
    address: appItem.address ?? null,
    householdMonthlyIncome: appItem.householdMonthlyIncome ?? null,
    familyMembersCount: appItem.familyMembersCount !== undefined ? Number(appItem.familyMembersCount) : null,
    occupation: appItem.occupation ?? null,
    purposeOrDiagnosis: appItem.purposeOrDiagnosis ?? null,
    status: appItem.status || 'Submitted',
    submissionDate: appItem.submissionDate || new Date().toISOString().split('T')[0],
    lastUpdated: appItem.lastUpdated ?? null,
    requestedAmount: appItem.requestedAmount ?? null,
    approvedAmount: appItem.approvedAmount ?? null,
    evaluatorNotes: appItem.evaluatorNotes ?? null,
    rejectionReason: appItem.rejectionReason ?? null,
    priorityScore: appItem.priorityScore ?? null,
    supportingDocumentsJson: appItem.documents ?? [],
    timelineJson: appItem.timeline ?? [],
    eligibilityJson: appItem.eligibilityEvaluation ?? null,
    officialReceiptNumber: appItem.officialReceiptNumber ?? null,
    paymentMethod: appItem.paymentMethod ?? null,
    disbursedBy: appItem.disbursedBy ?? null,
    disbursedAt: appItem.disbursedAt ?? null,
    resubmittedAt: appItem.resubmittedAt ?? null,
    resubmittedNote: appItem.resubmittedNote ?? null,
  };

  await prisma.assistanceApplication.upsert({
    where: { id: appItem.id },
    update: payload,
    create: { id: appItem.id, ...payload },
  });
}

export async function deleteApplicationFromMySQL(idOrRef: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  await prisma.assistanceApplication.deleteMany({
    where: { OR: [{ id: idOrRef }, { referenceCode: idOrRef }] },
  });
}

export async function syncAnnouncementToMySQL(ann: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !ann?.id) return;

  const {
    id,
    title,
    category,
    description,
    date,
    viewsCount,
    iconType,
    isPinned,
    status,
    targetAudienceType,
    ...rest
  } = ann;

  await prisma.announcement.upsert({
    where: { id },
    update: {
      title,
      category: category || 'General',
      description: description || '',
      date: date || 'Today',
      viewsCount: Number(viewsCount) || 0,
      iconType: iconType || 'general',
      isPinned: Boolean(isPinned),
      status: status || 'Published',
      targetAudienceType: targetAudienceType ?? null,
      extraJson: Object.keys(rest).length > 0 ? rest : null,
    },
    create: {
      id,
      title,
      category: category || 'General',
      description: description || '',
      date: date || 'Today',
      viewsCount: Number(viewsCount) || 0,
      iconType: iconType || 'general',
      isPinned: Boolean(isPinned),
      status: status || 'Published',
      targetAudienceType: targetAudienceType ?? null,
      extraJson: Object.keys(rest).length > 0 ? rest : null,
    },
  });
}

export async function syncNotificationToMySQL(notif: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !notif?.id) return;

  await prisma.notification.upsert({
    where: { id: notif.id },
    update: {
      read: Boolean(notif.read),
    },
    create: {
      id: notif.id,
      userId: notif.userId ?? null,
      title: notif.title,
      message: notif.message,
      read: Boolean(notif.read),
      type: notif.type || 'system',
      timestamp: notif.timestamp || '',
      applicationRef: notif.applicationRef ?? null,
      targetArea: notif.targetArea ?? null,
      documentDataJson: notif.documentData ?? null,
    },
  });
}

export async function syncNotificationReadInMySQL(params: { id?: string; all?: boolean; userId?: string }): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  if (params.all) {
    await prisma.notification.updateMany({
      where: params.userId
        ? { OR: [{ userId: params.userId }, { userId: null }] }
        : undefined,
      data: { read: true },
    });
  } else if (params.id) {
    await prisma.notification.updateMany({
      where: { id: params.id },
      data: { read: true },
    });
  }
}

export async function deleteNotificationFromMySQL(id?: string, userId?: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  if (id) {
    await prisma.notification.deleteMany({ where: { id } });
  } else if (userId) {
    await prisma.notification.deleteMany({ where: { userId } });
  } else {
    await prisma.notification.deleteMany({});
  }
}

export async function syncActivityLogToMySQL(log: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !log?.id) return;

  await prisma.activityLog.upsert({
    where: { id: log.id },
    update: {},
    create: {
      id: log.id,
      residentName: log.residentName || 'System',
      residentIdNumber: log.residentIdNumber || 'SYSTEM',
      purok: log.purok || 'Bugo',
      actionType: log.actionType || 'System Event',
      locationOrService: log.locationOrService || 'Portal',
      timestamp: log.timestamp || '',
      officerInCharge: log.officerInCharge || 'System',
      status: log.status || 'Completed',
      details: log.details || '',
    },
  });
}

export async function syncArchiveToMySQL(item: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !item?.id) return;

  await prisma.archivedRecord.upsert({
    where: { id: item.id },
    update: {},
    create: {
      id: item.id,
      title: item.title,
      originalCategory: item.originalCategory || 'Record',
      referenceCode: item.referenceCode || item.id,
      deletedBy: item.deletedBy || 'Administrator',
      deletedAt: item.deletedAt || '',
      status: item.status || 'Archived',
      reasonForArchive: item.reasonForArchive ?? null,
      originalDataJson: item.originalData ?? null,
    },
  });
}

export async function deleteArchiveFromMySQL(id: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;

  await prisma.archivedRecord.deleteMany({ where: { id } });
}

export async function syncCensusToMySQL(census: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !Array.isArray(census?.purokBreakdown)) return;

  for (const row of census.purokBreakdown) {
    await prisma.censusPurok.upsert({
      where: { purokName: row.purok },
      update: {
        population: Number(row.population) || 0,
        households: Number(row.households) || 0,
      },
      create: {
        purokName: row.purok,
        population: Number(row.population) || 0,
        households: Number(row.households) || 0,
      },
    });
  }
}

export async function syncProgramToMySQL(program: any): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !program?.id) return;

  await prisma.assistanceProgram.upsert({
    where: { id: program.id },
    update: {
      title: program.title,
      category: program.category,
      tagline: program.tagline ?? '',
      description: program.description,
      imageUrl: program.imageUrl || '/assets/services/real_barangay_hall_1788172230992.jpg',
      status: program.status || 'Active',
      badgeText: program.badgeText ?? null,
      deadline: program.deadline ?? null,
      targetAudience: program.targetAudience ?? null,
      processingTime: program.processingTime ?? null,
      maxBenefitAmount: program.maxBenefitAmount ?? null,
      requirementsJson: Array.isArray(program.requirements) ? program.requirements : [],
      eligibilityCriteriaJson: Array.isArray(program.eligibilityCriteria) ? program.eligibilityCriteria : [],
    },
    create: {
      id: program.id,
      title: program.title,
      category: program.category,
      tagline: program.tagline ?? '',
      description: program.description,
      imageUrl: program.imageUrl || '/assets/services/real_barangay_hall_1788172230992.jpg',
      status: program.status || 'Active',
      badgeText: program.badgeText ?? 'Barangay Program',
      deadline: program.deadline ?? 'Year-Round Service',
      targetAudience: program.targetAudience ?? 'All Bugo Residents',
      processingTime: program.processingTime ?? '1 - 3 Business Days',
      maxBenefitAmount: program.maxBenefitAmount ?? 'Barangay Assistance',
      requirementsJson: Array.isArray(program.requirements) ? program.requirements : [],
      eligibilityCriteriaJson: Array.isArray(program.eligibilityCriteria) ? program.eligibilityCriteria : [],
    },
  });
}

export async function deleteProgramFromMySQL(id: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !id) return;

  await prisma.assistanceProgram.deleteMany({ where: { id } });
}

export async function deleteUserFromMySQL(id: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !id) return;

  await prisma.user.deleteMany({ where: { id } });
}

export async function deleteAnnouncementFromMySQL(id: string): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma || !id) return;

  await prisma.announcement.deleteMany({ where: { id } });
}

