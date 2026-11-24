import { AssistanceProgram } from '../types';

const SERVICE_IMAGE_BY_ID: Record<string, string> = {
  'prog-barangay-clearance': '/assets/services/brgy_clearance_cert_1794197711166.jpg',
  'prog-admin-residency': '/assets/services/brgy_clearance_cert_1794197711166.jpg',
  'prog-admin-good-moral': '/assets/services/brgy_clearance_cert_1794197711166.jpg',
  'prog-admin-indigency': '/assets/services/brgy_senior_pension_1794197712463.jpg',
  'prog-admin-first-job': '/assets/services/brgy_job_student_1795014568227.jpg',
  'prog-admin-business-permit': '/assets/services/brgy_business_permit_1795014566314.jpg',
  'prog-live-business-processing': '/assets/services/brgy_business_permit_1795014566314.jpg',
  'prog-cert-solo-parent': '/assets/services/brgy_solo_parent_1795014567048.jpg',
  'prog-cert-senior-citizen': '/assets/services/brgy_senior_pension_1794197712463.jpg',
  'prog-cert-pwd': '/assets/services/brgy_pwd_wheelchair_1794197737143.jpg',
  'prog-cert-student-grant': '/assets/services/brgy_job_student_1795014568227.jpg',
  'prog-civil-late-birth': '/assets/services/brgy_birth_registry_1795014566625.jpg',
  'prog-civil-marriage': '/assets/services/brgy_civil_wedding_1794197758046.jpg',
  'prog-civil-death': '/assets/services/brgy_burial_sympathy_1795014567931.jpg',
  'prog-financial-assistance': '/assets/services/brgy_senior_pension_1794197712463.jpg',
  'prog-medical-assistance': '/assets/services/brgy_medical_clinic_1794197711940.jpg',
  'prog-livelihood-program': '/assets/services/brgy_agriculture_seeds_1794197712913.jpg',
  'prog-disaster-relief': '/assets/services/brgy_disaster_rescue_1794197713383.jpg',
  'prog-apply-lab-procedures': '/assets/services/brgy_medical_clinic_1794197711940.jpg',
  'prog-apply-dswd-burial': '/assets/services/brgy_burial_sympathy_1795014567931.jpg',
  'prog-apply-medical-implants': '/assets/services/brgy_medical_clinic_1794197711940.jpg',
  'prog-apply-hospital-bill': '/assets/services/brgy_medical_clinic_1794197711940.jpg',
  'prog-apply-dswd-educational': '/assets/services/brgy_job_student_1795014568227.jpg',
  'prog-apply-reseta-tambal': '/assets/services/brgy_medical_clinic_1794197711940.jpg',
  'prog-apply-dswd-transportation': '/assets/services/brgy_transport_aid_1795014568517.jpg',
  'prog-apply-ovm-medical-financial': '/assets/services/brgy_medical_clinic_1794197711940.jpg',
  'prog-apply-ovm-burial': '/assets/services/brgy_burial_sympathy_1795014567931.jpg',
};

const GENERIC_HALL_IMAGE = '/assets/services/real_barangay_hall_1788172230992.jpg';

export function resolveServiceImageUrl(
  program: Pick<AssistanceProgram, 'id' | 'title' | 'category' | 'imageUrl' | 'requirements' | 'eligibilityCriteria'>
): string {
  const mappedById = SERVICE_IMAGE_BY_ID[program.id];
  if (mappedById) {
    return mappedById;
  }

  const hay = [
    program.title,
    program.category,
    ...(program.requirements || []),
    ...(program.eligibilityCriteria || []),
  ]
    .join(' ')
    .toLowerCase();

  if (/business|dti|sari-sari|enterprise|commercial permit|mayors permit|mayor's permit/.test(hay)) {
    return '/assets/services/brgy_business_permit_1795014566314.jpg';
  }
  if (/solo parent|ra 11861|single parent/.test(hay)) {
    return '/assets/services/brgy_solo_parent_1795014567048.jpg';
  }
  if (/death|burial|funeral|mortuary|bereaved/.test(hay)) {
    return '/assets/services/brgy_burial_sympathy_1795014567931.jpg';
  }
  if (/live birth|newborn|birth certificate|birth registration/.test(hay)) {
    return '/assets/services/brgy_birth_registry_1795014566625.jpg';
  }
  if (/marriage|wedding|cenomar|kasalang/.test(hay)) {
    return '/assets/services/brgy_civil_wedding_1794197758046.jpg';
  }
  if (/transport|stranded|travel|police blotter/.test(hay)) {
    return '/assets/services/brgy_transport_aid_1795014568517.jpg';
  }
  if (/student|job seeker|ra 11261|diploma|transcript|certificate of registration|\bcor\b|school|educational|scholarship/.test(hay)) {
    return '/assets/services/brgy_job_student_1795014568227.jpg';
  }
  if (/pwd|disabilit|ra 10754|wheelchair/.test(hay)) {
    return '/assets/services/brgy_pwd_wheelchair_1794197737143.jpg';
  }
  if (/senior|osca|60 years|elderly|pension|indigency|financial/.test(hay)) {
    return '/assets/services/brgy_senior_pension_1794197712463.jpg';
  }
  if (/dental|tooth/.test(hay)) {
    return '/assets/services/brgy_dental_clinic_1794197757496.jpg';
  }
  if (/medical|hospital|laborator|implant|reseta|medicine|prescription|health/.test(hay)) {
    return '/assets/services/brgy_medical_clinic_1794197711940.jpg';
  }
  if (/disaster|flood|fire|landslide|typhoon|earthquake|calamity|rescue|relief/.test(hay)) {
    return '/assets/services/brgy_disaster_rescue_1794197713383.jpg';
  }
  if (/livelihood|farm|seed|vendor|artisan/.test(hay)) {
    return '/assets/services/brgy_agriculture_seeds_1794197712913.jpg';
  }
  if (/lupon|mediat|dispute|blotter|legal/.test(hay)) {
    return '/assets/services/brgy_mediation_lupon_1794197737997.jpg';
  }
  if (/clearance|residency|good moral|certificate|endorsement|permit/.test(hay)) {
    return '/assets/services/brgy_clearance_cert_1794197711166.jpg';
  }

  if (program.imageUrl && program.imageUrl !== GENERIC_HALL_IMAGE && program.imageUrl.startsWith('/assets/services/')) {
    return program.imageUrl;
  }

  return '/assets/services/brgy_clearance_cert_1794197711166.jpg';
}
