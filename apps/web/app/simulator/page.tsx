'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import DemoTour from '../../components/DemoTour';
import {
  MANUAL_FOLLOW_UPS_STORAGE_KEY,
  parseManualFollowUps,
  type ManualFollowUp,
  type ManualFollowUpStatus
} from '../../lib/manualFollowUps';
import { ENABLE_SOFIA_CHAT, getViewMode, type ViewMode } from '../../lib/alphaViewMode';

type ChatMessage = {
  id: string;
  author: 'customer' | 'bot' | 'david';
  text: string;
  time: string;
  attachment?: { label: string; href: string | null };
};

type Reference = {
  id: string;
  refCode: string;
  sourceChannel: string;
  summary?: string;
  resolved: boolean;
  customer?: {
    fullName: string;
    contactTitle: string | null;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    corporateEmail: string | null;
  } | null;
  conversation?: {
    status: string;
    senderName?: string | null;
    senderPhone?: string | null;
    customer?: {
      fullName: string;
      contactTitle: string | null;
      companyName: string | null;
      phone: string | null;
      email: string | null;
      corporateEmail: string | null;
    } | null;
  };
  createdAt?: string;
};

type MaintenanceEquipment = {
  id: string;
  customerId: string;
  model: string;
  serialNumber: string;
  currentHours: string | number;
  hoursToService: number | null;
  customer: {
    id: string;
    fullName: string;
    contactTitle: string | null;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    corporateEmail: string | null;
    lastContactAt: string | null;
    maintenanceWhatsAppSentAt: string | null;
    maintenanceWhatsAppRepliedAt: string | null;
    requiresDirectCall: boolean;
  };
  maintenancePlans: Array<{ id: string; planName: string; nextDueHours: number }>;
};

type Budget = {
  id: string;
  customerId: string;
  status: string;
  amount: string | number;
  motivoPerdida: string | null;
  motivoPerdidaNota: string | null;
  nextAction: string | null;
  customer: { id: string; fullName: string; companyName: string | null };
  installedEquipment: { id: string; model: string; serialNumber: string } | null;
};

type FollowUp = {
  id: string;
  dayNumber: number;
  dueAt: string;
  processedAt: string | null;
  status: string;
  message: string;
  budget: {
    id: string;
    status: string;
    customer: { companyName: string | null; fullName: string };
    installedEquipment: { model: string } | null;
  };
};

type SpeechResultEvent = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

type Lead = {
  id: string;
  customerName: string;
  contactTitle: string | null;
  companyName: string | null;
  contactPhone: string | null;
  email: string | null;
  notes: string | null;
  productInterest: string | null;
  estimatedAmount: string | number | null;
  status: string;
  opportunities: Array<{ id: string; stage: string }>;
};

type SimulatorModule = 'budgets' | 'maintenance' | 'customers' | 'copilot' | 'followups';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const budgetStatuses = [
  '01 - Enviado',
  '02 - En Seguimiento',
  '03 - Ganado',
  '04 - Perdido',
  '05 - Stand-By'
] as const;
const lossReasons = [
  'Precio',
  'Tiempo de Entrega',
  'Competencia',
  'Financiamiento'
] as const;

function timeNow() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function localDateTimeValue(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function localMonthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function contactDisplayName(item: ManualFollowUp, references: Reference[]) {
  const leadName = item.lead?.companyName?.trim() || item.lead?.customerName.trim();
  if (leadName) return leadName;

  const reference = item.refCode ? references.find((entry) => entry.refCode === item.refCode) : undefined;
  const customerName =
    reference?.customer?.companyName?.trim() ||
    reference?.customer?.fullName.trim() ||
    reference?.conversation?.customer?.companyName?.trim() ||
    reference?.conversation?.customer?.fullName.trim() ||
    reference?.conversation?.senderName?.trim();
  if (customerName) return customerName;

  return /^contacto de #ref-/i.test(item.customer.trim())
    ? 'Contacto sin identificar'
    : item.customer;
}

function contactPerson(item: ManualFollowUp, references: Reference[]) {
  const reference = item.refCode ? references.find((entry) => entry.refCode === item.refCode) : undefined;
  return item.contactName?.trim() ||
    item.lead?.customerName.trim() ||
    reference?.customer?.fullName.trim() ||
    reference?.conversation?.customer?.fullName.trim() ||
    reference?.conversation?.senderName?.trim() ||
    item.customer;
}

function contactTitle(item: ManualFollowUp, references: Reference[]) {
  const reference = item.refCode ? references.find((entry) => entry.refCode === item.refCode) : undefined;
  return item.contactTitle?.trim() ||
    item.lead?.contactTitle?.trim() ||
    reference?.customer?.contactTitle?.trim() ||
    reference?.conversation?.customer?.contactTitle?.trim() ||
    'Cargo no registrado';
}

function contactPhone(item: ManualFollowUp, references: Reference[]) {
  const reference = item.refCode ? references.find((entry) => entry.refCode === item.refCode) : undefined;
  return item.phone.trim() ||
    item.lead?.contactPhone?.trim() ||
    reference?.customer?.phone?.trim() ||
    reference?.conversation?.customer?.phone?.trim() ||
    reference?.conversation?.senderPhone?.trim() ||
    '';
}

function contactEmail(item: ManualFollowUp, references: Reference[]) {
  const reference = item.refCode ? references.find((entry) => entry.refCode === item.refCode) : undefined;
  return item.email?.trim() ||
    item.lead?.email?.trim() ||
    reference?.customer?.corporateEmail?.trim() ||
    reference?.customer?.email?.trim() ||
    reference?.conversation?.customer?.corporateEmail?.trim() ||
    reference?.conversation?.customer?.email?.trim() ||
    '';
}

function previousInteraction(item: ManualFollowUp, references: Reference[]) {
  const reference = item.refCode ? references.find((entry) => entry.refCode === item.refCode) : undefined;
  const note = item.result.trim() || item.lead?.notes?.trim() || reference?.summary?.trim();
  if (!note) return null;
  const sourceIsResult = Boolean(item.result.trim());
  const dateValue = sourceIsResult
    ? item.updatedAt ?? item.completedAt ?? item.createdAt
    : item.lead?.notes?.trim()
      ? item.lead.updatedAt
      : reference?.createdAt ?? item.createdAt;
  const date = Date.parse(dateValue ?? '');
  return {
    label: sourceIsResult ? 'Última minuta' : 'Comentario previo',
    date: Number.isFinite(date) ? new Date(date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '',
    note
  };
}

function extractQuickLeadDetails(text: string) {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const phone = text.match(/(?:\+\s?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}/)?.[0]?.trim() ?? '';
  const product = text.match(/\b[A-Z]{1,4}\s?-?\s?\d{2,4}\b/i)?.[0]?.replace(/\s+/g, ' ') ?? '';
  const rawAmount = text.match(/(?:ARS|US\$|USD|\$)\s?([\d.,]+)|([\d.,]+)\s?(?:ARS|pesos|d[oó]lares)/i);
  const amount = rawAmount ? rawAmount[1] ?? rawAmount[2] : '';
  const separator = Math.max(amount.lastIndexOf(','), amount.lastIndexOf('.'));
  const trailingDigits = separator >= 0 ? amount.length - separator - 1 : 0;
  const normalizedAmount = !amount
    ? ''
    : separator >= 0 && trailingDigits > 0 && trailingDigits <= 2
      ? `${amount.slice(0, separator).replace(/[.,]/g, '')}.${amount.slice(separator + 1)}`
      : amount.replace(/[.,]/g, '');
  const company = text.match(/(?:empresa|compa(?:ñ|n)[ií]a|cliente)\s*[:\-]\s*([^,\n;.]+)/i)?.[1]?.trim() ?? '';
  const contact = text.match(/(?:contacto|nombre|de)\s*[:\-]\s*([^<,\n;.]+)/i)?.[1]?.trim() ?? '';
  const name = contact || company || (text.trim().split(/\n|[.!?]/)[0]?.trim() ?? '');
  return { email, phone, product, amount: normalizedAmount, company, name };
}

function dateInMonth(date: string | null, month: string) {
  return Boolean(date && date.slice(0, 7) === month);
}

function botReply(message: string) {
  const normalizedMessage = message.toLocaleLowerCase('es-AR');
  if (normalizedMessage.includes('precio') || normalizedMessage.includes('cotiz')) {
    return 'Con gusto te ayudo a encontrar el equipo adecuado. Para empezar, ¿qué caudal necesitas y cuántos turnos trabaja la planta?';
  }
  if (normalizedMessage.includes('manten') || normalizedMessage.includes('servicio') || normalizedMessage.includes('falla')) {
    return 'Claro, te ayudo a coordinarlo. ¿Me cuentas qué equipo tienes y cuántas horas marca el horómetro?';
  }
  if (normalizedMessage.includes('pa 132') || normalizedMessage.includes('compresor')) {
    return 'El PA 132 puede ser una buena alternativa. ¿Qué caudal necesitas y en qué turnos trabaja tu planta?';
  }
  return 'Gracias por escribir a Pro-Aire. Soy Sofía, tu asesora comercial. ¿Qué necesitas resolver hoy?';
}

export default function SimulatorPage() {
  const [token, setToken] = useState('');
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      author: 'bot',
      text: '¡Hola! Soy Sofía, asesora comercial de Pro-Aire. Estoy para ayudarte a encontrar la mejor opción para tu planta.',
      time: ''
    },
    {
      id: 'demo-inbound-quote',
      author: 'customer',
      text: 'Hola, quisiera cotizar un PA 132 para la planta.',
      time: ''
    },
    {
      id: 'demo-inbound-question-one',
      author: 'bot',
      text: 'Para recomendarte el equipo adecuado, ¿qué caudal necesitas y cuántos turnos trabaja la planta?',
      time: ''
    },
    {
      id: 'demo-inbound-answer-one',
      author: 'customer',
      text: 'Necesitamos 30 m³ por minuto y trabajamos en dos turnos.',
      time: ''
    },
    {
      id: 'demo-inbound-question-two',
      author: 'bot',
      text: 'Gracias. ¿Qué equipo utilizan actualmente y de cuántos HP es?',
      time: ''
    },
    {
      id: 'demo-inbound-answer-two',
      author: 'customer',
      text: 'Usamos un compresor de 100 HP.',
      time: ''
    },
    {
      id: 'demo-inbound-question-three',
      author: 'bot',
      text: 'Perfecto. ¿Ya tienen tanque, secador o red de cañerías instalada en la planta?',
      time: ''
    },
    {
      id: 'demo-inbound-answer-three',
      author: 'customer',
      text: 'Tenemos tanque y red de cañerías, pero todavía no contamos con secador.',
      time: ''
    },
    {
      id: 'demo-inbound-quote-offer',
      author: 'bot',
      text: 'Por lo que me comentas, el Compresor PA 132 puede cubrir las necesidades de tu planta. Te comparto la propuesta para que la revises.',
      time: '',
      attachment: {
        label: 'Presupuesto PA 132 · PDF oficial de catálogo Pro-Aire',
        href: null
      }
    },
    {
      id: 'demo-inbound-confirmation',
      author: 'customer',
      text: 'Recibido, muchas gracias. Lo revisamos en planta.',
      time: ''
    }
  ]);
  const [consultationStep, setConsultationStep] = useState(4);
  const [references, setReferences] = useState<Reference[]>([]);
  const [draft, setDraft] = useState('');
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [activeModule, setActiveModule] = useState<SimulatorModule>('followups');
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const [manualFollowUps, setManualFollowUps] = useState<ManualFollowUp[]>([]);
  const [followUpMonth, setFollowUpMonth] = useState('');
  const [followUpStatusFilter, setFollowUpStatusFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming' | 'done'>('today');
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpCustomer, setFollowUpCustomer] = useState('');
  const [followUpContactName, setFollowUpContactName] = useState('');
  const [followUpContactTitle, setFollowUpContactTitle] = useState('');
  const [followUpEmail, setFollowUpEmail] = useState('');
  const [followUpPhone, setFollowUpPhone] = useState('');
  const [followUpReason, setFollowUpReason] = useState('');
  const [followUpDueAt, setFollowUpDueAt] = useState('');
  const [followUpPriority, setFollowUpPriority] = useState<ManualFollowUp['priority']>('Media');
  const [followUpOwner, setFollowUpOwner] = useState<ManualFollowUp['owner']>('David');
  const [recordingFollowUpId, setRecordingFollowUpId] = useState('');
  const [editingFollowUpId, setEditingFollowUpId] = useState('');
  const [closureFollowUp, setClosureFollowUp] = useState<{ item: ManualFollowUp; status: 'won' | 'lost' } | null>(null);
  const [closureReason, setClosureReason] = useState('');
  const [closureNote, setClosureNote] = useState('');
  const [isSavingClosure, setIsSavingClosure] = useState(false);
  const [followUpNotice, setFollowUpNotice] = useState('');
  const [showQuickLead, setShowQuickLead] = useState(false);
  const [quickLeadText, setQuickLeadText] = useState('');
  const [quickLeadName, setQuickLeadName] = useState('');
  const [quickLeadContactTitle, setQuickLeadContactTitle] = useState('');
  const [quickLeadCompany, setQuickLeadCompany] = useState('');
  const [quickLeadPhone, setQuickLeadPhone] = useState('');
  const [quickLeadEmail, setQuickLeadEmail] = useState('');
  const [quickLeadProduct, setQuickLeadProduct] = useState('');
  const [quickLeadAmount, setQuickLeadAmount] = useState('');
  const [isSavingQuickLead, setIsSavingQuickLead] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailSavedFor, setEmailSavedFor] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [copiedEmailFor, setCopiedEmailFor] = useState('');
  const [demoStep, setDemoStep] = useState('');
  const [maintenanceEquipment, setMaintenanceEquipment] = useState<MaintenanceEquipment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [orderJson, setOrderJson] = useState('');
  const [davidTaken, setDavidTaken] = useState(false);
  const [davidReply, setDavidReply] = useState('');
  const [learningRule, setLearningRule] = useState('');
  const [isSavingLearningRule, setIsSavingLearningRule] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [budgetStatus, setBudgetStatus] = useState<(typeof budgetStatuses)[number]>('01 - Enviado');
  const [lossReason, setLossReason] = useState('');
  const [lossReasonNote, setLossReasonNote] = useState('');
  const [horometerHours, setHorometerHours] = useState('');
  const [maintenanceAction, setMaintenanceAction] = useState<'offer' | 'reschedule'>('offer');
  const [rescheduleDays, setRescheduleDays] = useState<'3' | '7' | '15' | 'custom'>('3');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [amount, setAmount] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingMinute, setIsSavingMinute] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const minuteSectionRef = useRef<HTMLElement | null>(null);
  const recognitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setFollowUpMonth(localMonthValue(new Date()));
    setMessages((current) => current.map((message) =>
      message.time ? message : { ...message, time: timeNow() }
    ));
  }, []);

  useEffect(() => {
    let mode: ViewMode | null = null;
    const savedUser = window.localStorage.getItem('salespilot_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser) as { firstName?: unknown; role?: unknown };
        if (typeof user.firstName === 'string' && typeof user.role === 'string') {
          mode = getViewMode(user.firstName, user.role);
        }
      } catch {
        setError('No se pudo leer el usuario de la sesión. Vuelve a iniciar sesión.');
      }
    }
    const savedMode = window.localStorage.getItem('salespilot_view_mode');
    if (!mode && (savedMode === 'david' || savedMode === 'luciana' || savedMode === 'javier')) {
      mode = savedMode;
    }
    if (mode) {
      setViewMode(mode);
      window.localStorage.setItem('salespilot_view_mode', mode);
      if (mode === 'luciana') setFollowUpOwner('Luciana');
      if (mode === 'david') setFollowUpOwner('David');
    }
    if (mode === 'javier') {
      window.location.replace('/dashboard');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const module = params.get('module');
    const allowedModules = mode === 'luciana'
      ? ['maintenance', 'followups']
      : mode === 'david'
        ? ['budgets', 'followups', 'customers']
        : ['budgets', 'maintenance', 'customers', 'followups', ...(ENABLE_SOFIA_CHAT ? ['copilot'] : [])];
    const requestedModule = module && allowedModules.includes(module) ? module as SimulatorModule : null;
    setActiveModule(requestedModule ?? (mode === 'luciana' ? 'maintenance' : 'followups'));
    const demo = params.get('demo') ?? '';
    setDemoStep(ENABLE_SOFIA_CHAT ? demo : '');
    if (demo === '2') setCommand('resolver #REF-104');
    const applyDemoTarget = (event: Event) => {
      const detail = (event as CustomEvent<{ module: string | null; demo: string | null }>).detail;
      if (detail.module === 'budgets' || detail.module === 'maintenance' || detail.module === 'customers' || detail.module === 'copilot' || detail.module === 'followups') {
        if (allowedModules.includes(detail.module)) setActiveModule(detail.module);
      }
      setDemoStep(ENABLE_SOFIA_CHAT ? detail.demo ?? '' : '');
      if (detail.demo === '2') setCommand('resolver #REF-104');
    };
    window.addEventListener('salespilot:navigate-demo', applyDemoTarget);
    return () => window.removeEventListener('salespilot:navigate-demo', applyDemoTarget);
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem('salespilot_token');
    if (!savedToken) return;
    setToken(savedToken);
    void loadReferences(savedToken);
    void loadSalesWorkspace(savedToken);
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadManualFollowUps(token);
    const refreshTimer = window.setInterval(() => void loadManualFollowUps(token), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [token]);

  useEffect(() => {
    const refreshDemoSession = () => {
      const savedToken = window.localStorage.getItem('salespilot_token');
      if (!savedToken) return;
      setToken(savedToken);
      void loadReferences(savedToken);
      void loadSalesWorkspace(savedToken);
    };
    window.addEventListener('salespilot:auth-changed', refreshDemoSession);
    return () => window.removeEventListener('salespilot:auth-changed', refreshDemoSession);
  }, []);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
  }, []);

  async function loadSalesWorkspace(accessToken: string) {
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [equipmentResponse, budgetsResponse, followUpsResponse, leadsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/maintenance/outbound`, { headers }),
        fetch(`${apiUrl}/api/budgets`, { headers }),
        fetch(`${apiUrl}/api/budgets/follow-ups`, { headers }),
        fetch(`${apiUrl}/api/leads`, { headers })
      ]);
      const equipmentResult = (await equipmentResponse.json()) as MaintenanceEquipment[] | { message?: string };
      const budgetsResult = (await budgetsResponse.json()) as Budget[] | { message?: string };
      const followUpsResult = (await followUpsResponse.json()) as FollowUp[] | { message?: string };
      const leadsResult = (await leadsResponse.json()) as Lead[] | { message?: string };
      if (!equipmentResponse.ok || !Array.isArray(equipmentResult)) {
        throw new Error(!Array.isArray(equipmentResult) ? equipmentResult.message ?? 'No se pudo cargar la cola de mantenimiento.' : 'No se pudo cargar la cola de mantenimiento.');
      }

      if (!budgetsResponse.ok || !Array.isArray(budgetsResult)) {
        throw new Error(!Array.isArray(budgetsResult) ? budgetsResult.message ?? 'No se pudieron cargar los presupuestos.' : 'No se pudieron cargar los presupuestos.');
      }
      if (!followUpsResponse.ok || !Array.isArray(followUpsResult)) {
        throw new Error(!Array.isArray(followUpsResult) ? followUpsResult.message ?? 'No se pudo cargar la cadencia comercial.' : 'No se pudo cargar la cadencia comercial.');
      }
      if (!leadsResponse.ok || !Array.isArray(leadsResult)) {
        throw new Error(!Array.isArray(leadsResult) ? leadsResult.message ?? 'No se pudieron cargar los prospectos.' : 'No se pudieron cargar los prospectos.');
      }
      setMaintenanceEquipment(equipmentResult);
      setBudgets(budgetsResult);
      setFollowUps(followUpsResult);
      setLeads(leadsResult);
      if (equipmentResult.length) {
        setSelectedCustomerId((current) => current || equipmentResult[0].customerId);
        setSelectedEquipmentId((current) => current || equipmentResult[0].id);
        setHorometerHours((current) => current || String(equipmentResult[0].currentHours));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la gestión comercial.');
    }
  }

  async function loadManualFollowUps(accessToken: string) {
    try {
      const response = await fetch(`${apiUrl}/api/follow-ups`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const result = (await response.json()) as ManualFollowUp[] | { message?: string };
      if (!response.ok || !Array.isArray(result)) {
        throw new Error(!Array.isArray(result) ? result.message ?? 'No se pudieron cargar los re-contactos.' : 'No se pudieron cargar los re-contactos.');
      }
      if (!result.length) {
        const savedFollowUps = window.localStorage.getItem(MANUAL_FOLLOW_UPS_STORAGE_KEY);
        if (savedFollowUps) {
          const legacyFollowUps = parseManualFollowUps(savedFollowUps);
          for (const item of legacyFollowUps) {
            const migratedResponse = await fetch(`${apiUrl}/api/follow-ups`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(item)
            });
            const migrated = await migratedResponse.json() as ManualFollowUp | { message?: string };
            if (!migratedResponse.ok || !('id' in migrated)) {
              throw new Error('message' in migrated ? migrated.message ?? 'No se pudo migrar un re-contacto existente.' : 'No se pudo migrar un re-contacto existente.');
            }
            result.push(migrated);
          }
          window.localStorage.removeItem(MANUAL_FOLLOW_UPS_STORAGE_KEY);
        }
      }
      setManualFollowUps(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los re-contactos.');
    }
  }

  async function loadReferences(accessToken: string) {
    try {
      const response = await fetch(`${apiUrl}/api/copilot/references`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const result = (await response.json()) as Reference[] | { message?: string };
      if (!response.ok || !Array.isArray(result)) {
        throw new Error(!Array.isArray(result) ? result.message ?? 'No se pudieron cargar las derivaciones.' : 'No se pudieron cargar las derivaciones.');
      }
      setReferences(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error al cargar las derivaciones.');
    }
  }

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const customerMessage: ChatMessage = {
      id: crypto.randomUUID(),
      author: 'customer',
      text,
      time: timeNow()
    };
    let replyText: string;
    if (consultationStep === 1) {
      replyText = 'Gracias por contarme. ¿Qué equipo utilizan actualmente y de cuántos HP es?';
      setConsultationStep(2);
    } else if (consultationStep === 2) {
      replyText = 'Perfecto. ¿Ya tienen tanque, secador o red de cañerías instalada en la planta?';
      setConsultationStep(3);
    } else if (consultationStep === 3) {
      replyText = 'Por lo que me comentas, el Compresor PA 132 puede cubrir las necesidades de tu planta. Te preparo la propuesta para que revisemos juntos el siguiente paso. ¿Te gustaría que avancemos con la reserva del equipo o coordinar una visita técnica?';
      setConsultationStep(4);
    } else {
      replyText = botReply(text);
    }
    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      author: 'bot',
      text: replyText,
      time: timeNow()
    };
    setMessages((current) => [...current, customerMessage, reply]);
    setPendingMessage(text);
    setDraft('');
  }

  async function handOffToDavid() {
    if (!token || !pendingMessage || isSending) return;
    setIsSending(true);
    setError('');
    const refCode = `#REF-${crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
    const transcript = messages
      .slice(-4)
      .map((message) => `${message.author === 'customer' ? 'Cliente' : 'Copilot'}: ${message.text}`)
      .join('\n');

    try {
      const response = await fetch(`${apiUrl}/api/copilot/references`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          conversationId: `demo-${crypto.randomUUID()}`,
          refCode,
          sourceChannel: 'WHATSAPP',
          requiresDerivation: true,
          summary: transcript || pendingMessage
        })
      });
      const result = (await response.json()) as Reference | { message?: string };
      if (!response.ok || !('refCode' in result)) {
        throw new Error('message' in result ? result.message ?? 'No se pudo derivar la conversación.' : 'No se pudo derivar la conversación.');
      }
      setReferences((current) => [result, ...current]);
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        author: 'bot',
        text: `Listo, derivé tu consulta al equipo de Pro-Aire. Tu referencia es ${result.refCode}.`,
        time: timeNow()
      }]);
      setPendingMessage('');
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : 'No se pudo derivar la conversación.');
    } finally {
      setIsSending(false);
    }
  }

  async function resolveReference(refCode: string) {
    if (!token) return;
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/copilot/references/${encodeURIComponent(refCode)}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo ejecutar el comando.');
      setReferences((current) => current.map((reference) =>
        reference.refCode === refCode ? { ...reference, resolved: true } : reference
      ));
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'No se pudo ejecutar el comando.');
    }
  }

  async function takeReference(refCode: string) {
    if (!token) return;
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/copilot/references/${encodeURIComponent(refCode)}/take`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json() as Reference | { message?: string };
      if (!response.ok || !('refCode' in result)) {
        throw new Error('message' in result ? result.message ?? 'No se pudo tomar la conversación.' : 'No se pudo tomar la conversación.');
      }
      setReferences((current) => current.map((reference) => reference.refCode === refCode ? result : reference));
      setDavidTaken(true);
      setDavidReply('Sí, podemos ofrecer el PA 132 en 8 cheques. Si te parece, avanzamos con el presupuesto y coordinamos la reserva del equipo.');
      const customer = maintenanceEquipment.find((item) => item.customer.companyName === 'Taller Rosario S.A.');
      const followUpBudget = budgets.find((budget) => budget.status === '02 - En Seguimiento');
      if (customer) {
        setSelectedCustomerId(customer.customerId);
        setSelectedEquipmentId(customer.id);
        setHorometerHours(String(customer.currentHours));
      }
      if (followUpBudget) {
        setSelectedBudgetId(followUpBudget.id);
        setBudgetStatus('02 - En Seguimiento');
        setAmount(String(followUpBudget.amount));
        setNextAction(followUpBudget.nextAction ?? '');
      }
      window.setTimeout(() => minuteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    } catch (takeError) {
      setError(takeError instanceof Error ? takeError.message : 'No se pudo tomar la conversación.');
    }
  }

  function sendDavidReply() {
    const text = davidReply.trim();
    if (!text) return;
    setMessages((current) => [...current, {
      id: crypto.randomUUID(),
      author: 'david',
      text,
      time: timeNow()
    }]);
    setDavidReply('');
  }

  async function submitLearningRule(refCode: string) {
    if (!token || isSavingLearningRule) return;
    setIsSavingLearningRule(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/copilot/references/${encodeURIComponent(refCode)}/learning-rule`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          objection: 'Financiación del PA 132 en 8 cheques',
          rule: learningRule.trim() || 'Ante consultas por financiación, confirmar disponibilidad de hasta 8 cheques y ofrecer revisión comercial antes de derivar.'
        })
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo registrar la regla comercial.');
      setLearningRule('Regla registrada · Javier y Desarrollo notificados (simulación local).');
    } catch (learningError) {
      setError(learningError instanceof Error ? learningError.message : 'No se pudo registrar la regla comercial.');
    } finally {
      setIsSavingLearningRule(false);
    }
  }

  async function viewOrderJson(budgetId: string) {
    if (!token) return;
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/budgets/${encodeURIComponent(budgetId)}/export-json`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json() as object | { message?: string };
      if (!response.ok) throw new Error('message' in result ? result.message ?? 'No se pudo generar el JSON.' : 'No se pudo generar el JSON.');
      setOrderJson(JSON.stringify(result, null, 2));
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'No se pudo generar el JSON.');
    }
  }

  function submitCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const match = command.match(/#REF-[A-Z0-9]+/i);
    if (!match) {
      setError('Escribe un comando con una referencia, por ejemplo: resolver #REF-104');
      return;
    }
    const reference = references.find((item) => item.refCode.toUpperCase() === match[0].toUpperCase());
    if (!reference) {
      setError(`No existe la referencia ${match[0]} en esta consola.`);
      return;
    }
    setCommand('');
    void resolveReference(reference.refCode);
  }

  async function addManualFollowUp(input: Omit<ManualFollowUp, 'id' | 'createdAt' | 'completedAt' | 'status' | 'result'>) {
    if (!token) {
      setError('Inicia sesión para guardar un re-contacto en la base compartida.');
      return null;
    }
    try {
      const response = await fetch(`${apiUrl}/api/follow-ups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      const result = await response.json() as ManualFollowUp | { message?: string };
      if (!response.ok || !('id' in result)) {
        throw new Error('message' in result ? result.message ?? 'No se pudo agendar el seguimiento.' : 'No se pudo agendar el seguimiento.');
      }
      setManualFollowUps((current) => [result, ...current.filter((item) => item.id !== result.id)]);
      return result;
    } catch (followUpError) {
      setError(followUpError instanceof Error ? followUpError.message : 'No se pudo agendar el seguimiento.');
      return null;
    }
  }

  async function createManualFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!followUpCustomer.trim() || !followUpReason.trim() || !followUpDueAt) {
      setError('Completa el cliente, el motivo y la fecha/hora del seguimiento.');
      return;
    }
    const created = await addManualFollowUp({
      customer: followUpCustomer.trim(),
      contactName: followUpContactName.trim(),
      contactTitle: followUpContactTitle.trim(),
      email: followUpEmail.trim(),
      phone: followUpPhone.trim(),
      reason: followUpReason.trim(),
      dueAt: new Date(followUpDueAt).toISOString(),
      priority: followUpPriority,
      owner: followUpOwner
    });
    if (!created) return;
    setFollowUpCustomer('');
    setFollowUpContactName('');
    setFollowUpContactTitle('');
    setFollowUpEmail('');
    setFollowUpPhone('');
    setFollowUpReason('');
    setFollowUpDueAt(localDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
    setShowFollowUpForm(false);
    setFollowUpNotice('Re-contacto agendado correctamente.');
    setError('');
  }

  async function scheduleReferenceFollowUp(reference: Reference) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 1);
    dueAt.setHours(10, 0, 0, 0);
    const customer = reference.customer?.companyName?.trim() ||
      reference.customer?.fullName.trim() ||
      reference.conversation?.customer?.companyName?.trim() ||
      reference.conversation?.customer?.fullName.trim() ||
      reference.conversation?.senderName?.trim() ||
      'Contacto sin identificar';
    const contactName = reference.customer?.fullName.trim() ||
      reference.conversation?.customer?.fullName.trim() ||
      reference.conversation?.senderName?.trim() ||
      '';
    const created = await addManualFollowUp({
      customer,
      contactName,
      contactTitle: reference.customer?.contactTitle ?? reference.conversation?.customer?.contactTitle ?? '',
      email: reference.customer?.corporateEmail ?? reference.customer?.email ??
        reference.conversation?.customer?.corporateEmail ?? reference.conversation?.customer?.email ?? '',
      phone: reference.customer?.phone ?? reference.conversation?.customer?.phone ??
        reference.conversation?.senderPhone ?? '',
      reason: reference.summary ?? `Seguimiento de la derivación ${reference.refCode}`,
      dueAt: dueAt.toISOString(),
      priority: 'Media',
      owner: 'David',
      refCode: reference.refCode
    });
    if (!created) return;
    setFollowUpMonth(localMonthValue(dueAt));
    setFollowUpStatusFilter('all');
    setActiveModule('followups');
    setFollowUpNotice(`Re-contacto de ${reference.refCode} agendado para mañana a las 10:00.`);
    setError('');
  }

  async function updateManualFollowUp(
    id: string,
    update: Partial<ManualFollowUp> & { motivoPerdida?: string; motivoPerdidaNota?: string }
  ): Promise<boolean> {
    if (!token) {
      setError('Inicia sesión para actualizar el re-contacto.');
      return false;
    }
    setManualFollowUps((current) => current.map((item) => item.id === id ? { ...item, ...update } : item));
    try {
      const response = await fetch(`${apiUrl}/api/follow-ups/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      const result = await response.json() as ManualFollowUp | { message?: string };
      if (!response.ok || !('id' in result)) {
        throw new Error('message' in result ? result.message ?? 'No se pudo actualizar el seguimiento.' : 'No se pudo actualizar el seguimiento.');
      }
      setManualFollowUps((current) => current.map((item) => item.id === id ? result : item));
      return true;
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el seguimiento.');
      void loadManualFollowUps(token);
      return false;
    }
  }

  function parseQuickLeadText() {
    const extracted = extractQuickLeadDetails(quickLeadText);
    if (extracted.name) setQuickLeadName(extracted.name);
    if (extracted.company) setQuickLeadCompany(extracted.company);
    if (extracted.phone) setQuickLeadPhone(extracted.phone);
    if (extracted.email) setQuickLeadEmail(extracted.email);
    if (extracted.product) setQuickLeadProduct(extracted.product);
    if (extracted.amount) setQuickLeadAmount(extracted.amount);
  }

  async function createQuickLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError('Inicia sesión para crear un prospecto en la base compartida.');
      return;
    }
    if (!quickLeadName.trim() || !Number.isFinite(Number(quickLeadAmount || 0)) || Number(quickLeadAmount || 0) < 0) {
      setError('Indica el nombre del contacto y un monto estimado válido.');
      return;
    }
    setIsSavingQuickLead(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/leads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: quickLeadName.trim(),
          contactTitle: quickLeadContactTitle.trim(),
          companyName: quickLeadCompany.trim(),
          phone: quickLeadPhone.trim(),
          email: quickLeadEmail.trim(),
          productInterest: quickLeadProduct.trim(),
          estimatedAmount: quickLeadAmount || '0',
          sourceMessage: quickLeadText.trim()
        })
      });
      const result = await response.json() as { lead?: { id: string }; followUp?: ManualFollowUp; message?: string };
      if (!response.ok || !result.lead || !result.followUp) {
        throw new Error(result.message ?? 'No se pudo crear el prospecto y su primer seguimiento.');
      }
      await Promise.all([loadManualFollowUps(token), loadSalesWorkspace(token)]);
      setQuickLeadText('');
      setQuickLeadName('');
      setQuickLeadContactTitle('');
      setQuickLeadCompany('');
      setQuickLeadPhone('');
      setQuickLeadEmail('');
      setQuickLeadProduct('');
      setQuickLeadAmount('');
      setShowQuickLead(false);
      setFollowUpNotice('Prospecto creado. Cadencia de hasta 7 re-contactos programada para David.');
      setFollowUpMonth(localMonthValue(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)));
    } catch (leadError) {
      setError(leadError instanceof Error ? leadError.message : 'No se pudo crear el prospecto.');
    } finally {
      setIsSavingQuickLead(false);
    }
  }

  function rescheduleManualFollowUp(item: ManualFollowUp, days: number) {
    const nextDate = new Date(Math.max(Date.now(), new Date(item.dueAt).getTime()));
    nextDate.setDate(nextDate.getDate() + days);
    void updateManualFollowUp(item.id, { dueAt: nextDate.toISOString(), status: 'scheduled' });
  }

  function markNotLocated(item: ManualFollowUp) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 3);
    const result = [item.result, 'No ubicado; re-llamar en 3 días.'].filter(Boolean).join('\n');
    void updateManualFollowUp(item.id, { dueAt: dueAt.toISOString(), status: 'scheduled', result });
  }

  function setManualFollowUpStatus(item: ManualFollowUp, status: ManualFollowUpStatus) {
    if (status === 'won' || status === 'lost') {
      setClosureFollowUp({ item, status });
      setClosureReason('');
      setClosureNote('');
      return;
    }
    void updateManualFollowUp(item.id, {
      status,
    });
  }

  async function closeOpportunity() {
    if (!closureFollowUp) return;
    if (closureFollowUp.status === 'lost' && (!closureReason || !closureNote.trim())) {
      setError('Para marcar la oportunidad como perdida, selecciona un motivo y agrega una nota breve.');
      return;
    }
    const body = closureFollowUp.status === 'lost'
      ? {
          status: 'lost' as const,
          motivoPerdida: closureReason,
          motivoPerdidaNota: closureNote.trim()
        }
      : { status: 'won' as const };
    setIsSavingClosure(true);
    const saved = await updateManualFollowUp(closureFollowUp.item.id, body);
    setIsSavingClosure(false);
    if (!saved) return;
    if (token) await loadManualFollowUps(token);
    setClosureFollowUp(null);
    setClosureReason('');
    setClosureNote('');
  }

  async function changeLeadStage(lead: Lead) {
    if (!token || lead.status === '03 - Cotizado') return;
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/leads/${encodeURIComponent(lead.id)}/stage`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: '03 - Cotizado' })
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo actualizar la etapa del prospecto.');
      await Promise.all([loadManualFollowUps(token), loadSalesWorkspace(token)]);
      setFollowUpNotice(`Oportunidad cotizada. Cadencia de hasta 7 re-contactos programada para ${lead.companyName ?? lead.customerName}.`);
    } catch (stageError) {
      setError(stageError instanceof Error ? stageError.message : 'No se pudo actualizar la etapa del prospecto.');
    }
  }

  function recordManualFollowUpMinute(item: ManualFollowUp) {
    if (recordingFollowUpId) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionConstructor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setError('Este navegador no admite reconocimiento de voz. Puedes tipear la minuta en la tarjeta.');
      return;
    }
    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = 'es-AR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results, (result) => result[0].transcript).join(' ').trim();
        if (transcript) {
          void updateManualFollowUp(item.id, { result: [item.result, transcript].filter(Boolean).join('\n') });
          void scheduleVoiceFollowUp(transcript, item);
        }
      };
      recognition.onerror = () => setError('No se pudo transcribir el audio. Puedes tipear la minuta en la tarjeta.');
      recognition.onend = () => {
        setRecordingFollowUpId('');
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
      setRecordingFollowUpId(item.id);
      setError('');
    } catch (recordingError) {
      setError(recordingError instanceof Error
        ? `No se pudo iniciar la grabación: ${recordingError.message}`
        : 'No se pudo iniciar la grabación.');
    }
  }

  async function scheduleVoiceFollowUp(transcript: string, sourceFollowUp?: ManualFollowUp) {
    const normalizedTranscript = transcript.toLocaleLowerCase('es-AR');
    if (!/\b(llamar|llamarle|contactar|recontactar|seguimiento|escribir|whatsapp)\b/i.test(normalizedTranscript)) return;

    const dueAt = new Date();
    const explicitDate = normalizedTranscript.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    const time = normalizedTranscript.match(/(?:\ba las?\s*|\btipo\s*)(\d{1,2})(?::(\d{2}))?(?:\s*(?:hs|h|horas))?\b/);
    const hoursFromNow = normalizedTranscript.match(/\ben\s+(\d+)\s*(?:hs|h|horas)\b/);
    if (/pasado mañana/.test(normalizedTranscript)) {
      dueAt.setDate(dueAt.getDate() + 2);
    } else if (/\bmañana\b/.test(normalizedTranscript)) {
      dueAt.setDate(dueAt.getDate() + 1);
    } else if (/\b(hoy|esta tarde|esta mañana)\b/.test(normalizedTranscript)) {
      // Keep today's date.
    } else {
      const weekdayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const weekdayIndex = weekdayNames.findIndex((day) => normalizedTranscript.includes(day));
      const daysFromNow = normalizedTranscript.match(/\ben\s+(\d+)\s+d[ií]as?\b/);
      const weeksFromNow = normalizedTranscript.match(/\ben\s+(\d+)\s+semanas?\b/);
      if (explicitDate) {
        const year = explicitDate[3] ? Number(explicitDate[3].length === 2 ? `20${explicitDate[3]}` : explicitDate[3]) : dueAt.getFullYear();
        dueAt.setFullYear(year, Number(explicitDate[2]) - 1, Number(explicitDate[1]));
      } else if (daysFromNow) {
        dueAt.setDate(dueAt.getDate() + Number(daysFromNow[1]));
      } else if (weeksFromNow) {
        dueAt.setDate(dueAt.getDate() + Number(weeksFromNow[1]) * 7);
      } else if (weekdayIndex >= 0) {
        const dayOffset = (weekdayIndex - dueAt.getDay() + 7) % 7 || 7;
        dueAt.setDate(dueAt.getDate() + dayOffset);
      } else if (!hoursFromNow) {
        return;
      }
    }
    if (hoursFromNow && !explicitDate) {
      dueAt.setHours(dueAt.getHours() + Number(hoursFromNow[1]), 0, 0, 0);
    } else {
      const spokenHour = time && Number(time[1]) <= 23 ? Number(time[1]) : 10;
      const spokenMinute = time?.[2] ? Number(time[2]) : 0;
      dueAt.setHours(spokenHour, spokenMinute, 0, 0);
    }
    if (dueAt.getTime() <= Date.now()) dueAt.setHours(new Date().getHours() + 1, 0, 0, 0);

    const matchedEquipment = maintenanceEquipment.find((equipment) =>
      [equipment.customer.companyName, equipment.customer.fullName]
        .some((name) => name && normalizedTranscript.includes(name.toLocaleLowerCase('es-AR')))
    ) ?? maintenanceEquipment.find((equipment) => equipment.customerId === selectedCustomerId);
    const isServiceFollowUp = /\b(service|mantenimiento|mec[aá]nic[oa]|hor[oó]metro)\b/i.test(normalizedTranscript);
    const created = await addManualFollowUp({
      customer: matchedEquipment
        ? matchedEquipment.customer.companyName ?? matchedEquipment.customer.fullName
        : sourceFollowUp?.customer ?? 'Cliente por identificar',
      phone: matchedEquipment?.customer.phone ?? sourceFollowUp?.phone ?? '',
      reason: transcript.trim(),
      dueAt: dueAt.toISOString(),
      priority: 'Media',
      owner: isServiceFollowUp ? 'Luciana' : sourceFollowUp?.owner ?? 'David'
    });
    if (created) setFollowUpNotice(`Seguimiento agendado automáticamente para ${dueAt.toLocaleString('es-AR')}.`);
  }

  function interpretVoiceTranscript(transcript: string) {
    setVoiceTranscript(transcript);
    void scheduleVoiceFollowUp(transcript);
    const normalizedTranscript = transcript.toLocaleLowerCase('es-AR');
    const spokenHours = transcript.match(/(\d[\d.,]*)\s*(?:hs|horas|hor[oó]metro)/i)?.[1];
    const spokenAmount = transcript.match(/\$\s*(\d[\d.,]*)|(\d[\d.,]*)\s*(?:pesos|d[oó]lares)/i);

    const toNumberInput = (value: string) => {
      let normalized = value;
      if (normalized.includes('.') && normalized.includes(',')) {
        normalized = normalized.replace(/\./g, '').replace(',', '.');
      } else if (normalized.includes(',')) {
        normalized = normalized.replace(',', '.');
      } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
        normalized = normalized.replace(/\./g, '');
      }
      return normalized;
    };

    if (spokenHours) setHorometerHours(toNumberInput(spokenHours));
    const amountValue = spokenAmount?.[1] ?? spokenAmount?.[2];
    if (amountValue) setAmount(toNumberInput(amountValue));

    const matchedEquipment = maintenanceEquipment.find((equipment) =>
      equipment.customer.companyName &&
      normalizedTranscript.includes(equipment.customer.companyName.toLocaleLowerCase('es-AR'))
    );
    if (matchedEquipment) {
      setSelectedCustomerId(matchedEquipment.customerId);
      setSelectedEquipmentId(matchedEquipment.id);
    }
    if (/ganad[oa]|cerrad[oa]|acept[oó]/i.test(transcript)) setBudgetStatus('03 - Ganado');
    else if (/perdid[oa]|rechazad[oa]/i.test(transcript)) setBudgetStatus('04 - Perdido');
    else if (/seguimiento|llamar|contactar/i.test(transcript)) setBudgetStatus('02 - En Seguimiento');
    else if (/stand.?by|pausad[oa]/i.test(transcript)) setBudgetStatus('05 - Stand-By');
  }

  async function startVoiceRecording() {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    setError('');
    const SpeechRecognitionConstructor =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!navigator.mediaDevices?.getUserMedia || !SpeechRecognitionConstructor) {
      setError('Este navegador no admite reconocimiento de voz. Puedes completar la minuta manualmente.');
      return;
    }

    try {
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = 'es-AR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results, (result) => result[0].transcript).join(' ');
        interpretVoiceTranscript(transcript);
      };
      recognition.onerror = () => {
        setError('No se pudo transcribir el audio. Revisa el permiso del micrófono o completa la minuta manualmente.');
      };
      recognition.onend = () => {
        if (recognitionTimerRef.current) clearTimeout(recognitionTimerRef.current);
        setIsRecording(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      recognitionTimerRef.current = setTimeout(() => recognition.stop(), 15_000);
      microphone.getTracks().forEach((track) => track.stop());
    } catch (recordingError) {
      setError(recordingError instanceof Error
        ? `No se pudo acceder al micrófono: ${recordingError.message}`
        : 'No se pudo acceder al micrófono.');
    }
  }

  function selectEquipment(equipmentId: string) {
    const selected = maintenanceEquipment.find((equipment) => equipment.id === equipmentId);
    if (!selected) return;
    setSelectedCustomerId(selected.customerId);
    setSelectedEquipmentId(selected.id);
    setHorometerHours(String(selected.currentHours));
    setEmailDraft(selected.customer.corporateEmail ?? '');
    setEmailSavedFor('');
    setSelectedBudgetId('');
  }

  function selectBudgetForEditing(budget: Budget) {
    setSelectedCustomerId(budget.customerId);
    setAmount(String(budget.amount));
    setNextAction(budget.nextAction ?? '');
    setLossReason(budget.motivoPerdida ?? '');
    setLossReasonNote(budget.motivoPerdidaNota ?? '');
    const matchingStatus = budgetStatuses.find((status) => status === budget.status);
    if (matchingStatus) setBudgetStatus(matchingStatus);
    if (budget.installedEquipment) selectEquipment(budget.installedEquipment.id);
    setSelectedBudgetId(budget.id);
  }

  function openMinuteForEquipment(equipmentId: string) {
    selectEquipment(equipmentId);
    minuteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function captureCorporateEmail(customerId: string) {
    if (!token || isSavingEmail || !emailDraft.trim()) return;
    setIsSavingEmail(true);
    setError('');
    setEmailSavedFor('');
    try {
      const response = await fetch(`${apiUrl}/api/maintenance/email-capture`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, email: emailDraft.trim() })
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message ?? 'No se pudo guardar el email corporativo.');
      setEmailSavedFor(customerId);
      setMaintenanceEquipment((current) => current.map((item) =>
        item.customerId === customerId
          ? { ...item, customer: { ...item.customer, corporateEmail: emailDraft.trim() } }
          : item
      ));
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'No se pudo guardar el email corporativo.');
    } finally {
      setIsSavingEmail(false);
    }
  }

  async function copyContactEmail(email: string, followUpId: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmailFor(followUpId);
      window.setTimeout(() => setCopiedEmailFor((current) => current === followUpId ? '' : current), 2000);
    } catch (copyError) {
      setError(copyError instanceof Error
        ? `No se pudo copiar el email: ${copyError.message}`
        : 'No se pudo copiar el email.');
    }
  }

  async function saveVoiceMinute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedEquipmentId) {
      setError('Inicia sesión y selecciona un equipo para guardar la minuta.');
      return;
    }
    if (!Number.isFinite(Number(horometerHours)) || Number(horometerHours) < 0) {
      setError('El horómetro debe ser un número válido no negativo.');
      return;
    }
    if (viewMode === 'luciana' && maintenanceAction === 'reschedule') {
      const dueAt = rescheduleDays === 'custom'
        ? new Date(rescheduleDate)
        : new Date(Date.now() + Number(rescheduleDays) * 24 * 60 * 60 * 1000);
      if (!Number.isFinite(dueAt.getTime())) {
        setError('Selecciona una fecha válida para re-agendar el llamado.');
        return;
      }

      setIsSavingMinute(true);
      setError('');
      try {
        const response = await fetch(`${apiUrl}/api/maintenance/check-ins/reschedule`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentId: selectedEquipmentId,
            horometerHours,
            dueAt: dueAt.toISOString()
          })
        });
        const result = await response.json() as { followUp?: ManualFollowUp; message?: string };
        if (!response.ok || !result.followUp) {
          throw new Error(result.message ?? 'No se pudo re-agendar el check-in.');
        }
        await Promise.all([loadManualFollowUps(token), loadSalesWorkspace(token)]);
        setFollowUpNotice(`Llamado re-agendado para ${dueAt.toLocaleDateString('es-AR')}, sin emitir presupuesto.`);
        setMaintenanceAction('offer');
      } catch (rescheduleError) {
        setError(rescheduleError instanceof Error ? rescheduleError.message : 'No se pudo re-agendar el check-in.');
      } finally {
        setIsSavingMinute(false);
      }
      return;
    }
    if (!Number.isFinite(Number(amount || 0)) || Number(amount || 0) < 0) {
      setError('El horómetro y el monto deben ser números válidos no negativos.');
      return;
    }

    setIsSavingMinute(true);
    setError('');
    try {
      const response = await fetch(`${apiUrl}/api/budgets/minutes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          equipmentId: selectedEquipmentId,
          ...(selectedBudgetId ? { budgetId: selectedBudgetId } : {}),
          status: budgetStatus,
          amount: amount || '0',
          ...(budgetStatus === '04 - Perdido' && lossReason ? { motivoPerdida: lossReason } : {}),
          ...(budgetStatus === '04 - Perdido' && lossReasonNote.trim() ? { motivoPerdidaNota: lossReasonNote.trim() } : {}),
          nextAction,
          horometerHours,
          transcript: voiceTranscript
        })
      });
      const result = (await response.json()) as { budget?: Budget; message?: string };
      const savedBudget = result.budget;
      if (!response.ok || !savedBudget) {
        throw new Error(result.message ?? 'No se pudo guardar el check-in.');
      }
      setVoiceTranscript('');
      setNextAction('');
      setSelectedBudgetId('');
      setBudgets((current) => [savedBudget, ...current.filter((budget) => budget.id !== savedBudget.id)]);
      await loadSalesWorkspace(token);
      setFollowUpNotice(
        budgetStatus === '03 - Ganado'
          ? 'Aceptado. Venta cerrada y alerta del próximo service programada.'
          : budgetStatus === '04 - Perdido'
            ? 'Rechazo registrado con motivo.'
            : 'Presupuesto enviado. Seguimiento programado a 3 días.'
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el check-in.');
    } finally {
      setIsSavingMinute(false);
    }
  }

  const customers = Array.from(
    new Map(maintenanceEquipment.map((equipment) => [equipment.customerId, equipment.customer])).values()
  );
  const customerEquipment = maintenanceEquipment.filter(
    (equipment) => equipment.customerId === selectedCustomerId
  );
  const customerBudgets = budgets.filter((budget) => budget.customerId === selectedCustomerId);
  const visibleReferences = demoStep === '1'
    ? []
    : demoStep === '2'
      ? references.filter((reference) => reference.refCode === '#REF-104')
      : references;
  const agentFollowUps = manualFollowUps.filter((item) =>
    viewMode === 'david' ? item.owner === 'David' : viewMode === 'luciana' ? item.owner === 'Luciana' : true
  );
  const allModules: Array<[SimulatorModule, string, string]> = [
    ['budgets', 'Presupuestos', '▤'],
    ['maintenance', 'Mantenimiento', '◷'],
    ['followups', 'Mis Re-contactos & Seguimientos', '↻'],
    ['customers', 'Clientes', '◎']
  ];
  if (ENABLE_SOFIA_CHAT) allModules.push(['copilot', 'Copilot', '⌘']);
  const availableModules = allModules.filter(([module]) => {
    if (viewMode === 'luciana') return module === 'maintenance' || module === 'followups';
    if (viewMode === 'david') return module === 'followups' || module === 'budgets' || module === 'customers';
    return true;
  });
  const today = new Date();
  const todayValue = localDateTimeValue(today).slice(0, 10);
  const monthFollowUps = agentFollowUps.filter((item) => dateInMonth(item.dueAt, followUpMonth));
  const overdueFollowUps = agentFollowUps.filter((item) => item.status === 'scheduled' && item.dueAt.slice(0, 10) < todayValue);
  const todayFollowUps = agentFollowUps.filter((item) => item.status === 'scheduled' && item.dueAt.slice(0, 10) === todayValue);
  const upcomingFollowUps = agentFollowUps.filter((item) => item.status === 'scheduled' && item.dueAt.slice(0, 10) > todayValue);
  const completedInMonth = agentFollowUps.filter((item) =>
    item.status !== 'scheduled' && item.status !== 'cancelled' && dateInMonth(item.completedAt, followUpMonth)
  );
  const wonInMonth = completedInMonth.filter((item) => item.status === 'won').length;
  const closeRate = completedInMonth.length ? Math.round((wonInMonth / completedInMonth.length) * 100) : 0;
  const activeMonthFollowUps = monthFollowUps.filter((item) => item.status !== 'cancelled');
  const completionProgress = activeMonthFollowUps.length
    ? Math.min(100, Math.round((completedInMonth.length / activeMonthFollowUps.length) * 100))
    : 0;
  const filteredManualFollowUps = agentFollowUps
    .filter((item) => {
      if (followUpStatusFilter === 'overdue') return item.status === 'scheduled' && item.dueAt.slice(0, 10) < todayValue;
      if (followUpStatusFilter === 'today') return item.status === 'scheduled' && item.dueAt.slice(0, 10) === todayValue;
      if (followUpStatusFilter === 'upcoming') return item.status === 'scheduled' && item.dueAt.slice(0, 10) > todayValue;
      if (followUpStatusFilter === 'done') return item.status !== 'scheduled';
      return true;
    })
    .sort((first, second) => new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime());

  return (
    <main className="h-dvh overflow-hidden bg-[#F1F4F9] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[60px] max-w-[1800px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/SalesPilotAI.jpeg" alt="SalesPilotAI" width={160} height={48} className="h-9 w-auto rounded object-contain" />
            <span className="hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">
              {viewMode === 'luciana' ? 'Consola Luciana · Alfa Operativa' : 'Consola David · Alfa Operativa'}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {viewMode !== 'luciana' && <button
              type="button"
              onClick={() => {
                setShowQuickLead(true);
                setError('');
              }}
              className="rounded-lg bg-[#1E64FF] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 sm:px-4 sm:text-sm"
            >
              + Alta Rápida de Prospecto
            </button>}
            <span className="hidden items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 sm:inline-flex dark:bg-blue-950/40 dark:text-blue-300">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> Alfa Operativa
            </span>
            {ENABLE_SOFIA_CHAT && <DemoTour />}
            <ThemeToggle />
            {viewMode === 'javier' && <Link href="/dashboard" className="text-sm font-semibold text-[#1E64FF]">Dashboard</Link>}
            <Link href="/portal" className="text-sm font-semibold text-[#1E64FF] hover:text-blue-700">Mi Planta</Link>
          </div>
        </div>
      </header>

      {showQuickLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="quick-lead-title" className="my-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">Sofía Copiloto</p>
                <h2 id="quick-lead-title" className="mt-1 text-xl font-bold">Alta Rápida de Prospecto</h2>
                <p className="mt-1 text-sm text-slate-500">Carga manualmente el mensaje y los datos del contacto antes de crear.</p>
              </div>
              <button type="button" onClick={() => setShowQuickLead(false)} aria-label="Cerrar alta rápida" className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>
            <form onSubmit={createQuickLead} className="mt-5 space-y-4">
              <label className="block text-sm font-semibold">Mensaje / minuta manual
                <textarea
                  value={quickLeadText}
                  onChange={(event) => setQuickLeadText(event.target.value)}
                  rows={5}
                  maxLength={10000}
                  placeholder="Escribe el mensaje del prospecto o la minuta de la conversación…"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={parseQuickLeadText} disabled={!quickLeadText.trim()} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40">✨ Extraer datos del mensaje</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">Nombre de contacto
                  <input required value={quickLeadName} onChange={(event) => setQuickLeadName(event.target.value)} placeholder="Nombre de la persona" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label className="text-sm font-semibold">Cargo del contacto
                  <input value={quickLeadContactTitle} onChange={(event) => setQuickLeadContactTitle(event.target.value)} placeholder="Ej. Gerente de Planta" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label className="text-sm font-semibold">Empresa
                  <input value={quickLeadCompany} onChange={(event) => setQuickLeadCompany(event.target.value)} placeholder="Empresa prospecto" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label className="text-sm font-semibold">Teléfono
                  <input type="tel" value={quickLeadPhone} onChange={(event) => setQuickLeadPhone(event.target.value)} placeholder="+54 9 ..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label className="text-sm font-semibold">Email
                  <input type="email" value={quickLeadEmail} onChange={(event) => setQuickLeadEmail(event.target.value)} placeholder="contacto@empresa.com" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label className="text-sm font-semibold">Producto de interés
                  <input value={quickLeadProduct} onChange={(event) => setQuickLeadProduct(event.target.value)} placeholder="Ej. PA 132" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
                <label className="text-sm font-semibold">Monto estimado de cotización ($)
                  <input type="number" min="0" step="0.01" value={quickLeadAmount} onChange={(event) => setQuickLeadAmount(event.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-xs text-slate-500">Se creará el prospecto y una cadencia de hasta 7 re-contactos para David.</p>
                <button type="submit" disabled={isSavingQuickLead || !token} className="rounded-lg bg-[#1E64FF] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">{isSavingQuickLead ? 'Creando…' : 'Crear prospecto y agendar'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {closureFollowUp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="close-opportunity-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <h2 id="close-opportunity-title" className="text-lg font-bold">
              Marcar oportunidad como {closureFollowUp.status === 'won' ? 'Ganada' : 'Perdida'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{closureFollowUp.item.customer} · se cancelarán los re-contactos pendientes.</p>
            {closureFollowUp.status === 'lost' && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-semibold">Motivo estándar
                  <select required value={closureReason} onChange={(event) => setClosureReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950">
                    <option value="">Selecciona un motivo</option>
                    {lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-semibold">Nota breve
                  <textarea required value={closureNote} onChange={(event) => setClosureNote(event.target.value)} maxLength={2000} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal dark:border-slate-700 dark:bg-slate-950" placeholder="Contexto breve de la decisión" />
                </label>
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setClosureFollowUp(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700">Cancelar</button>
              <button type="button" disabled={isSavingClosure} onClick={() => void closeOpportunity()} className="rounded-lg bg-[#1E64FF] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isSavingClosure ? 'Guardando…' : 'Confirmar cierre'}
              </button>
            </div>
          </section>
        </div>
      )}

      <div className="mx-auto grid h-[calc(100dvh-61px)] max-w-[1800px] min-h-0 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-2 p-2 sm:p-3 xl:grid-cols-[205px_290px_minmax(0,1fr)] xl:grid-rows-1 xl:gap-3">
        <aside aria-label="Menú de módulos" className="flex min-h-0 items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 xl:flex-col xl:items-stretch xl:overflow-visible xl:p-3">
          <div className="hidden border-b border-slate-100 px-2 pb-3 xl:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1E64FF]">SalesPilotAI</p>
            <h1 className="mt-1 text-lg font-bold">Centro comercial</h1>
          </div>
          {availableModules.map(([module, label, icon]) => (
            <button
              key={module}
              type="button"
              onClick={() => setActiveModule(module)}
              aria-current={activeModule === module ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition xl:w-full ${
                activeModule === module
                  ? 'bg-blue-50 text-[#1E64FF] dark:bg-blue-950/50 dark:text-blue-300'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span className="text-base">{icon}</span><span>{label}</span>
              {module === 'budgets' && <span className="ml-auto hidden text-xs text-slate-400 xl:inline">{budgets.length}</span>}
              {module === 'maintenance' && <span className="ml-auto hidden text-xs text-slate-400 xl:inline">{maintenanceEquipment.length}</span>}
              {module === 'followups' && <span className="ml-auto hidden text-xs text-slate-400 xl:inline">{agentFollowUps.filter((item) => item.status === 'scheduled').length}</span>}
              {module === 'customers' && <span className="ml-auto hidden text-xs text-slate-400 xl:inline">{customers.length}</span>}
            </button>
          ))}
          <div className="mt-auto hidden border-t border-slate-100 px-2 pt-3 text-xs text-slate-500 xl:block">
            Demo local · API conectada
          </div>
        </aside>

        <section aria-label="Lista de clientes y oportunidades" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#1E64FF]">
              {activeModule === 'maintenance' ? 'Prioridad de service' : activeModule === 'budgets' ? 'Pipeline comercial' : activeModule === 'customers' ? 'Cartera' : activeModule === 'followups' ? 'Plan de contacto' : 'Actividad'}
            </p>
            <h2 className="mt-1 font-bold">
              {activeModule === 'maintenance' ? 'Cola outbound' : activeModule === 'budgets' ? 'Presupuestos' : activeModule === 'customers' ? 'Clientes' : activeModule === 'followups' ? 'Re-contactos' : 'Derivaciones'}
            </h2>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {activeModule === 'maintenance' && maintenanceEquipment.map((equipment) => (
              <button
                key={equipment.id}
                type="button"
                onClick={() => selectEquipment(equipment.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedEquipmentId === equipment.id
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40'
                    : 'border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="block truncate text-sm font-bold">{equipment.model}</span>
                <span className="mt-1 block truncate text-xs text-slate-500">{equipment.customer.companyName ?? equipment.customer.fullName}</span>
                <span className="mt-2 block text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {equipment.hoursToService === null ? 'Sin plan' : equipment.hoursToService <= 0 ? `Service vencido ${Math.abs(equipment.hoursToService)} hs` : `${equipment.hoursToService} hs al service`}
                </span>
              </button>
            ))}
            {(activeModule === 'customers' ? customers : []).map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => {
                  const equipment = maintenanceEquipment.find((item) => item.customerId === customer.id);
                  setSelectedCustomerId(customer.id);
                  if (equipment) selectEquipment(equipment.id);
                }}
                className={`w-full rounded-xl border p-3 text-left text-sm font-semibold ${
                  selectedCustomerId === customer.id ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40' : 'border-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {customer.companyName ?? customer.fullName}
                <span className="mt-1 block text-xs font-normal text-slate-500">{maintenanceEquipment.filter((item) => item.customerId === customer.id).length} equipos vinculados</span>
              </button>
            ))}
            {activeModule === 'budgets' && budgets.map((budget) => (
              <article
                key={budget.id}
                className={`w-full rounded-xl border p-3 ${
                  selectedBudgetId === budget.id ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/40' : 'border-slate-100 dark:border-slate-800'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    selectBudgetForEditing(budget);
                  }}
                  className="w-full text-left"
                >
                  <span className="block truncate text-sm font-bold">{budget.customer.companyName ?? budget.customer.fullName}</span>
                  <span className="mt-1 block text-xs text-slate-500">{budget.installedEquipment?.model ?? 'Presupuesto'} · {budget.status}</span>
                  <span className="mt-2 block text-xs font-semibold">{Number(budget.amount).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</span>
                </button>
                {budget.status === '03 - Ganado' && (
                  <button
                    type="button"
                    onClick={() => void viewOrderJson(budget.id)}
                    className="mt-3 rounded-lg border border-blue-200 px-2.5 py-2 text-[11px] font-bold text-blue-700 dark:border-blue-900 dark:text-blue-300"
                  >
                    📄 Ver JSON de Orden de Pedido
                  </button>
                )}
              </article>
            ))}
            {activeModule === 'copilot' && visibleReferences.map((reference) => (
              <button
                key={reference.id}
                type="button"
                onClick={() => setCommand(`resolver ${reference.refCode}`)}
                className="w-full rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="text-xs font-bold text-[#1E64FF]">{reference.refCode}</span>
                <span className="mt-1 block text-xs text-slate-500">{reference.resolved ? 'Atendida' : 'Pendiente'} · {reference.sourceChannel}</span>
              </button>
            ))}
            {activeModule === 'followups' && manualFollowUps.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <div className="flex items-start gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{contactDisplayName(item, references)}</p>
                  {item.refCode && <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{item.refCode}</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">{mounted ? new Date(item.dueAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''}</p>
                <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${item.status === 'scheduled' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : item.status === 'won' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : item.status === 'lost' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {item.status === 'scheduled' ? 'Pendiente' : item.status === 'won' ? 'Ganado' : item.status === 'lost' ? 'Perdido' : item.status === 'cancelled' ? 'Cadencia cancelada' : 'Realizado'}
                </span>
              </article>
            ))}
            {((activeModule === 'maintenance' && !maintenanceEquipment.length) ||
              (activeModule === 'budgets' && !budgets.length) ||
              (activeModule === 'customers' && !customers.length) ||
              (activeModule === 'copilot' && !visibleReferences.length) ||
              (activeModule === 'followups' && !manualFollowUps.length)) && (
              <p className="px-3 py-8 text-center text-xs text-slate-500">
                {activeModule === 'followups' ? 'Todavía no hay re-contactos agendados.' : token ? 'No hay elementos para mostrar.' : 'Inicia sesión para cargar tus datos.'}
              </p>
            )}
          </div>
        </section>

        <section aria-label="Área de trabajo" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#F7F9FC] dark:bg-[#0e1727]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:bg-[#111c2e]">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{activeModule === 'copilot' ? 'Copilot Comercial' : activeModule === 'budgets' ? 'Gestión de presupuestos' : activeModule === 'customers' ? 'Ficha de cliente' : activeModule === 'followups' ? 'Re-contactos y seguimientos manuales' : 'Operación de mantenimiento'}</p>
              <p className="truncate text-[10px] text-slate-500">{maintenanceEquipment.find((item) => item.id === selectedEquipmentId)?.customer.companyName ?? 'Selecciona un registro de la lista'}</p>
            </div>
            <span className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-500">Centro de comando</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {demoStep && (
          <p className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            Demo Mode · Paso {demoStep} de 6 · {demoStep === '1' ? 'WhatsApp inbound y relevamiento consultivo del PA 132.' : demoStep === '2' ? 'Derivación #REF-104 lista para David y minuta comercial.' : demoStep === '3' ? 'Prioriza los llamados de mantenimiento por horómetro.' : 'Contexto de demostración cargado.'}
          </p>
        )}
        {!token && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <span>Inicia sesión como David para enviar derivaciones a su consola.</span>
            <Link href="/login?next=%2Fsimulator" className="rounded-lg bg-[#1E64FF] px-4 py-2 font-semibold text-white hover:bg-blue-700">Iniciar sesión</Link>
          </div>
        )}
        {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        {activeModule === 'followups' && (
          <section aria-label="Mis Re-contactos y Seguimientos" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">David · venta de equipos / Luciana · mantenimiento</p>
                <h2 className="mt-1 text-xl font-bold">Mis Re-contactos &amp; Seguimientos</h2>
                <p className="mt-1 text-sm text-slate-500">Agenda, contacta y registra el resultado de cada conversación.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="follow-up-month" className="sr-only">Mes calendario</label>
                <button
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() => {
                    const month = new Date(`${followUpMonth}-01T12:00:00`);
                    month.setMonth(month.getMonth() - 1);
                    setFollowUpMonth(localMonthValue(month));
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  ←
                </button>
                <input
                  id="follow-up-month"
                  type="month"
                  value={followUpMonth}
                  onChange={(event) => setFollowUpMonth(event.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  onClick={() => {
                    const month = new Date(`${followUpMonth}-01T12:00:00`);
                    month.setMonth(month.getMonth() + 1);
                    setFollowUpMonth(localMonthValue(month));
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => setFollowUpMonth(localMonthValue(new Date()))}
                  className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                >
                  Mes Actual
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFollowUpDueAt(localDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
                    setShowFollowUpForm((current) => !current);
                    setFollowUpNotice('');
                  }}
                  className="rounded-lg bg-[#1E64FF] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  + Nuevo seguimiento
                </button>
              </div>
            </div>

            {followUpNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">{followUpNotice}</p>}

            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              {[
                { title: '🔴 Vencidos', value: overdueFollowUps.length, detail: 'Re-llamados pendientes de atención', style: 'border-red-200 bg-red-50/70 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200' },
                { title: '📅 Para Hoy', value: todayFollowUps.length, detail: 'Plan de llamadas del día', style: 'border-blue-200 bg-blue-50/70 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200' },
                { title: '🟢 Completados en el Mes', value: completedInMonth.length, detail: `${completionProgress}% del plan mensual completado`, style: 'border-emerald-200 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' },
                { title: '📊 Tasa de Cierre (%)', value: `${closeRate}%`, detail: `${wonInMonth} ganados de ${completedInMonth.length} resultados`, style: 'border-violet-200 bg-violet-50/70 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200' }
              ].map((metric) => (
                <article key={metric.title} className={`rounded-2xl border p-4 shadow-sm ${metric.style}`}>
                  <p className="text-xs font-bold">{metric.title}</p>
                  <p className="mt-2 text-3xl font-bold">{metric.value}</p>
                  <p className="mt-1 text-xs opacity-80">{metric.detail}</p>
                </article>
              ))}
            </div>

            <div role="tablist" aria-label="Estado de los re-contactos" className="grid gap-3 sm:grid-cols-3">
              {[
                { title: 'Vencidos', value: overdueFollowUps.length, filter: 'overdue' as const, style: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200' },
                { title: 'Para Hoy', value: todayFollowUps.length, filter: 'today' as const, style: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' },
                { title: 'Próximos', value: upcomingFollowUps.length, filter: 'upcoming' as const, style: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200' }
              ].map((summary) => (
                <button
                  key={summary.filter}
                  type="button"
                  role="tab"
                  onClick={() => setFollowUpStatusFilter(summary.filter)}
                  aria-selected={followUpStatusFilter === summary.filter}
                  className={`rounded-xl border p-3 text-left shadow-sm transition ${summary.style} ${followUpStatusFilter === summary.filter ? 'ring-2 ring-offset-2' : 'opacity-75 hover:opacity-100'}`}
                >
                  <span className="text-xs font-semibold text-slate-500">{summary.title}</span>
                  <span className="mt-1 block text-xl font-bold">{summary.value}</span>
                </button>
              ))}
            </div>

            {showFollowUpForm && (
              <form onSubmit={createManualFollowUp} className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900 dark:bg-[#111c2e] sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold">Agendar re-contacto manual</h3>
                    <p className="mt-1 text-xs text-slate-500">Completa los datos del contacto y la próxima acción.</p>
                  </div>
                  <button type="button" onClick={() => setShowFollowUpForm(false)} aria-label="Cerrar formulario" className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="text-xs font-semibold">Cliente / Empresa
                    <input required value={followUpCustomer} onChange={(event) => setFollowUpCustomer(event.target.value)} placeholder="Nombre del contacto o empresa" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold">Nombre del contacto
                    <input value={followUpContactName} onChange={(event) => setFollowUpContactName(event.target.value)} placeholder="Nombre y apellido" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold">Cargo
                    <input value={followUpContactTitle} onChange={(event) => setFollowUpContactTitle(event.target.value)} placeholder="Ej. Gerente de Planta" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold">Teléfono / WhatsApp
                    <input value={followUpPhone} onChange={(event) => setFollowUpPhone(event.target.value)} type="tel" placeholder="+54 9 ..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold">Email
                    <input value={followUpEmail} onChange={(event) => setFollowUpEmail(event.target.value)} type="email" placeholder="contacto@empresa.com" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold">Motivo de llamada
                    <input required value={followUpReason} onChange={(event) => setFollowUpReason(event.target.value)} placeholder="Ej. Confirmar propuesta del PA 132" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold">Fecha y hora agendada
                    <input required type="datetime-local" value={followUpDueAt} onChange={(event) => setFollowUpDueAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                  </label>
                  <label className="text-xs font-semibold">Prioridad
                    <select value={followUpPriority} onChange={(event) => setFollowUpPriority(event.target.value as ManualFollowUp['priority'])} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal">
                      <option>Alta</option><option>Media</option><option>Baja</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold">Responsable
                    <select value={followUpOwner} onChange={(event) => setFollowUpOwner(event.target.value as ManualFollowUp['owner'])} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal">
                      <option>David</option><option>Luciana</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="submit" className="rounded-lg bg-[#1E64FF] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">Guardar seguimiento</button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {filteredManualFollowUps.length ? filteredManualFollowUps.map((item) => {
                const isOverdue = item.status === 'scheduled' && item.dueAt.slice(0, 10) < todayValue;
                const statusLabel = item.status === 'scheduled' ? isOverdue ? 'Vencido' : item.dueAt.slice(0, 10) === todayValue ? 'Para hoy' : 'Próximo' : item.status === 'won' ? 'Ganado' : item.status === 'lost' ? 'Perdido' : item.status === 'cancelled' ? 'Cadencia cancelada' : 'Completado';
                const person = contactPerson(item, references);
                const title = contactTitle(item, references);
                const phone = contactPhone(item, references);
                const phoneDigits = phone.replace(/\D/g, '');
                const email = contactEmail(item, references);
                const interaction = previousInteraction(item, references);
                return (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:bg-[#111c2e] sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold">{contactDisplayName(item, references)}</h3>
                          {item.refCode && <span className="rounded-md bg-blue-50 px-2 py-1 font-mono text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">{item.refCode}</span>}
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isOverdue || item.status === 'lost' ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : item.status === 'won' || item.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>{statusLabel}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{mounted ? new Date(item.dueAt).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' }) : ''} · {item.owner} · Prioridad {item.priority}</p>
                        <section aria-label={`Ficha de contacto de ${person}`} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ficha de contacto</p>
                          <p className="mt-1 text-sm font-semibold">{person} <span className="font-normal text-slate-500">· {title}</span></p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                            {phoneDigits ? (
                              <>
                                <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">☎ {phone}</a>
                                <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300">WhatsApp</a>
                              </>
                            ) : <span className="text-slate-500">Teléfono no registrado</span>}
                            {email ? (
                              <span className="inline-flex items-center gap-1.5">
                                <a href={`mailto:${email}`} className="font-medium text-slate-700 hover:underline dark:text-slate-200">{email}</a>
                                <button type="button" onClick={() => void copyContactEmail(email, item.id)} aria-label={`Copiar email ${email}`} className="rounded border border-slate-300 px-1.5 py-0.5 font-semibold hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800">
                                  {copiedEmailFor === item.id ? 'Copiado' : 'Copiar'}
                                </button>
                              </span>
                            ) : <span className="text-slate-500">Email no registrado</span>}
                          </div>
                        </section>
                        {interaction && (
                          <aside className="mt-3 rounded-xl border-l-4 border-blue-500 bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">
                              {interaction.label}{interaction.date ? ` (${interaction.date})` : ''}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{interaction.note}</p>
                          </aside>
                        )}
                        <p className="mt-3 whitespace-pre-wrap text-sm">{item.reason}</p>
                      </div>
                    </div>
                    {editingFollowUpId === item.id && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        <label className="text-xs font-semibold">Cliente / Empresa
                          <input value={item.customer} onChange={(event) => setManualFollowUps((current) => current.map((followUp) => followUp.id === item.id ? { ...followUp, customer: event.target.value } : followUp))} onBlur={(event) => void updateManualFollowUp(item.id, { customer: event.currentTarget.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold">Nombre del contacto
                          <input value={item.contactName ?? item.lead?.customerName ?? ''} onChange={(event) => setManualFollowUps((current) => current.map((followUp) => followUp.id === item.id ? { ...followUp, contactName: event.target.value } : followUp))} onBlur={(event) => void updateManualFollowUp(item.id, { contactName: event.currentTarget.value })} placeholder="Nombre y apellido" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold">Cargo
                          <input value={item.contactTitle ?? item.lead?.contactTitle ?? ''} onChange={(event) => setManualFollowUps((current) => current.map((followUp) => followUp.id === item.id ? { ...followUp, contactTitle: event.target.value } : followUp))} onBlur={(event) => void updateManualFollowUp(item.id, { contactTitle: event.currentTarget.value })} placeholder="Ej. Gerente de Planta" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold">Teléfono / WhatsApp
                          <input type="tel" value={item.phone} onChange={(event) => setManualFollowUps((current) => current.map((followUp) => followUp.id === item.id ? { ...followUp, phone: event.target.value } : followUp))} onBlur={(event) => void updateManualFollowUp(item.id, { phone: event.currentTarget.value })} placeholder="+54 9 ..." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
                        </label>
                        <label className="text-xs font-semibold">Email
                          <input type="email" value={item.email ?? item.lead?.email ?? ''} onChange={(event) => setManualFollowUps((current) => current.map((followUp) => followUp.id === item.id ? { ...followUp, email: event.target.value } : followUp))} onBlur={(event) => void updateManualFollowUp(item.id, { email: event.currentTarget.value })} placeholder="contacto@empresa.com" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" />
                        </label>
                        <button type="button" onClick={() => setEditingFollowUpId('')} className="w-fit rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">Guardar contacto</button>
                      </div>
                    )}
                    <label className="mt-4 block text-xs font-bold text-slate-600 dark:text-slate-300">Minuta / resultado
                      <textarea
                        value={item.result}
                        onChange={(event) => setManualFollowUps((current) => current.map((followUp) => followUp.id === item.id ? { ...followUp, result: event.target.value } : followUp))}
                        onBlur={(event) => void updateManualFollowUp(item.id, { result: event.currentTarget.value })}
                        placeholder="Escribe el resultado de la llamada…"
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal"
                      />
                    </label>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setEditingFollowUpId((current) => current === item.id ? '' : item.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">{editingFollowUpId === item.id ? 'Cerrar contacto' : 'Editar contacto'}</button>
                      {item.status === 'scheduled' && <>
                        {[1, 2, 7].map((days) => <button key={days} type="button" onClick={() => rescheduleManualFollowUp(item, days)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">+{days === 1 ? '24 hs' : days === 2 ? '48 hs' : '7 días'}</button>)}
                        <button type="button" onClick={() => setManualFollowUpStatus(item, 'completed')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Completado</button>
                        {item.owner === 'Luciana' && <button type="button" onClick={() => markNotLocated(item)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-200">No ubicado · +3 días</button>}
                        {item.owner === 'David' && <>
                          <button type="button" onClick={() => setManualFollowUpStatus(item, 'won')} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300">Ganada</button>
                          <button type="button" onClick={() => setManualFollowUpStatus(item, 'lost')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300">Perdida</button>
                        </>}
                      </>}
                      {item.status !== 'scheduled' && <button type="button" onClick={() => setManualFollowUpStatus(item, 'scheduled')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800">Reabrir seguimiento</button>}
                    </div>
                  </article>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:bg-[#111c2e]">
                  <p className="font-semibold">No hay seguimientos para este filtro.</p>
                  <p className="mt-1 text-sm text-slate-500">Crea uno manualmente o agenda un re-contacto desde una derivación.</p>
                </div>
              )}
            </div>
            {viewMode === 'david' && (
              <section aria-label="Gestión de Oportunidades y Presupuestos" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111c2e] sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">Pipeline comercial</p>
                    <h3 className="mt-1 text-lg font-bold">Gestión de Oportunidades y Presupuestos</h3>
                    <p className="mt-1 text-sm text-slate-500">Revisa etapas, montos y cierres sin salir de tus seguimientos.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModule('budgets')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Ver pipeline completo
                  </button>
                </div>
                <div className="mb-5">
                  <h4 className="mb-2 text-sm font-bold">Prospectos</h4>
                  {leads.length ? (
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {leads.map((lead) => (
                        <article key={lead.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                          <p className="truncate text-sm font-bold">{lead.companyName ?? lead.customerName}</p>
                          <p className="mt-1 text-xs text-slate-500">{lead.productInterest ?? 'Sin producto definido'} · {lead.status}</p>
                          {lead.status !== '03 - Cotizado' && (
                            <button type="button" onClick={() => void changeLeadStage(lead)} className="mt-3 w-full rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300">
                              Pasar a 03 - Cotizado
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                  ) : <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500">Los prospectos creados aparecerán aquí.</p>}
                </div>
                {budgets.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {budgets.map((budget) => (
                      <article key={budget.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <p className="truncate text-sm font-bold">{budget.customer.companyName ?? budget.customer.fullName}</p>
                        <p className="mt-1 text-xs text-slate-500">{budget.installedEquipment?.model ?? 'Presupuesto'} · {budget.status}</p>
                        <p className="mt-2 text-sm font-semibold">{Number(budget.amount).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })}</p>
                        <button
                          type="button"
                          onClick={() => selectBudgetForEditing(budget)}
                          className="mt-3 w-full rounded-lg bg-[#1E64FF] px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          Editar etapa, monto y cierre
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
                    <p className="text-sm font-semibold">Todavía no hay presupuestos en el pipeline.</p>
                    <p className="mt-1 text-xs text-slate-500">Las oportunidades y sus presupuestos aparecerán aquí para su seguimiento.</p>
                  </div>
                )}
              </section>
            )}
          </section>
        )}

        {(activeModule === 'budgets' || activeModule === 'maintenance' || (viewMode === 'david' && activeModule === 'followups' && Boolean(selectedBudgetId)) || (ENABLE_SOFIA_CHAT && activeModule === 'copilot' && demoStep === '2' && davidTaken)) && <section ref={minuteSectionRef} aria-label="Check-in manual de mantenimiento y ventas" className="mb-4 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">Registro manual</p>
              <h2 className="mt-1 text-xl font-bold">{activeModule === 'copilot' ? 'Minuta de cierre · David' : viewMode === 'luciana' ? 'Check-in de Horómetro' : 'Minuta comercial'}</h2>
              <p className="mt-1 text-sm text-slate-500">Completa el formulario manualmente y confirma la decisión del cliente.</p>
            </div>
          </div>

          <form onSubmit={saveVoiceMinute} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">
              Cliente / Empresa
              <select
                value={selectedCustomerId}
                onChange={(event) => {
                  const customerId = event.target.value;
                  const firstEquipment = maintenanceEquipment.find((equipment) => equipment.customerId === customerId);
                  setSelectedCustomerId(customerId);
                  if (firstEquipment) selectEquipment(firstEquipment.id);
                }}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Seleccionar cliente…</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.companyName ?? customer.fullName}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Equipo
              <select
                value={selectedEquipmentId}
                onChange={(event) => selectEquipment(event.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Seleccionar equipo…</option>
                {customerEquipment.map((equipment) => (
                  <option key={equipment.id} value={equipment.id}>{equipment.model} · {equipment.serialNumber}</option>
                ))}
              </select>
            </label>
            {(viewMode !== 'luciana' || maintenanceAction === 'offer') && <label className="text-sm font-semibold text-slate-700">
              Presupuesto a actualizar
              <select
                value={selectedBudgetId}
                onChange={(event) => {
                  const budgetId = event.target.value;
                  const selected = customerBudgets.find((budget) => budget.id === budgetId);
                  setSelectedBudgetId(budgetId);
                  if (!selected) return;
                  const matchingStatus = budgetStatuses.find((status) => status === selected.status);
                  if (matchingStatus) setBudgetStatus(matchingStatus);
                  setAmount(String(selected.amount));
                  setLossReason(selected.motivoPerdida ?? '');
                  setLossReasonNote(selected.motivoPerdidaNota ?? '');
                  setNextAction(selected.nextAction ?? '');
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal"
              >
                <option value="">Crear presupuesto nuevo</option>
                {customerBudgets.map((budget) => (
                  <option key={budget.id} value={budget.id}>
                    {budget.installedEquipment?.model ?? 'Presupuesto'} · {budget.status}
                  </option>
                ))}
              </select>
            </label>}
            <label className="text-sm font-semibold text-slate-700">
              Horómetro actualizado (hs)
              <input
                type="number"
                min="0"
                step="0.01"
                value={horometerHours}
                onChange={(event) => setHorometerHours(event.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
            {viewMode === 'luciana' && horometerHours !== '' && (
              <fieldset className="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
                <legend>Decisión del check-in</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className={`cursor-pointer rounded-xl border p-3 ${maintenanceAction === 'offer' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" name="maintenance-action" value="offer" checked={maintenanceAction === 'offer'} onChange={() => setMaintenanceAction('offer')} className="mr-2" />
                    Ofrecer Mantenimiento Ahora
                  </label>
                  <label className={`cursor-pointer rounded-xl border p-3 ${maintenanceAction === 'reschedule' ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
                    <input type="radio" name="maintenance-action" value="reschedule" checked={maintenanceAction === 'reschedule'} onChange={() => setMaintenanceAction('reschedule')} className="mr-2" />
                    Re-agendar Llamado
                  </label>
                </div>
              </fieldset>
            )}
            {viewMode === 'luciana' && maintenanceAction === 'reschedule' && (
              <>
                <label className="text-sm font-semibold text-slate-700">
                  Plazo para volver a llamar
                  <select value={rescheduleDays} onChange={(event) => setRescheduleDays(event.target.value as typeof rescheduleDays)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal">
                    <option value="3">+3 días</option>
                    <option value="7">+7 días</option>
                    <option value="15">+15 días</option>
                    <option value="custom">Elegir fecha</option>
                  </select>
                </label>
                {rescheduleDays === 'custom' && (
                  <label className="text-sm font-semibold text-slate-700">
                    Fecha y hora del llamado
                    <input required type="datetime-local" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal" />
                  </label>
                )}
              </>
            )}
            {(viewMode !== 'luciana' || maintenanceAction === 'offer') && <label className="text-sm font-semibold text-slate-700">
              Estado del presupuesto
              <select
                value={budgetStatus}
                onChange={(event) => {
                  const status = budgetStatuses.find((candidate) => candidate === event.target.value);
                  if (status) setBudgetStatus(status);
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal"
              >
                {(viewMode === 'luciana'
                  ? budgetStatuses.filter((status) => status === '01 - Enviado' || status === '03 - Ganado' || status === '04 - Perdido')
                  : budgetStatuses
                ).map((status) => (
                  <option key={status} value={status}>
                    {viewMode !== 'luciana' ? status : status === '01 - Enviado' ? 'Presupuesto Enviado' : status === '03 - Ganado' ? 'Aceptado' : 'Rechazado'}
                  </option>
                ))}
              </select>
            </label>}
            {(viewMode !== 'luciana' || maintenanceAction === 'offer') && <label className="text-sm font-semibold text-slate-700">
              Monto tratado ($)
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>}
            {(viewMode !== 'luciana' || maintenanceAction === 'offer') && budgetStatus === '04 - Perdido' && (
              <label className="text-sm font-semibold text-slate-700">
                Motivo de pérdida
                <select
                  required
                  value={lossReason}
                  onChange={(event) => setLossReason(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal"
                >
                  <option value="" disabled>Selecciona un motivo</option>
                  {lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </label>
            )}
            {(viewMode !== 'luciana' || maintenanceAction === 'offer') && budgetStatus === '04 - Perdido' && (
              <label className="text-sm font-semibold text-slate-700">
                Nota breve para el reporte gerencial
                <textarea
                  required
                  value={lossReasonNote}
                  onChange={(event) => setLossReasonNote(event.target.value)}
                  maxLength={2000}
                  rows={2}
                  placeholder="Agrega contexto breve sobre la pérdida…"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal"
                />
              </label>
            )}
            {(viewMode !== 'luciana' || maintenanceAction === 'offer') && <label className="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
              Próxima Acción / Recordatorio
              <input
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                placeholder="Ej.: Llamar el viernes para confirmar visita técnica"
                maxLength={2000}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>}
            {(viewMode !== 'luciana' || maintenanceAction === 'offer') && <label className="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
              Minuta / notas manuales
              <textarea
                value={voiceTranscript}
                onChange={(event) => setVoiceTranscript(event.target.value)}
                rows={2}
                placeholder="Escribe manualmente el resultado del check-in."
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>}
            <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2 xl:col-span-3">
              <p className="text-xs text-slate-500">{viewMode === 'luciana' && maintenanceAction === 'reschedule' ? 'Se actualizará el horómetro y el cliente volverá a aparecer en los re-llamados; no se emitirá presupuesto.' : 'Revisa los datos y la decisión antes de guardar.'}</p>
              <button
                type="submit"
                disabled={!token || isSavingMinute || !maintenanceEquipment.length}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingMinute ? 'Guardando…' : viewMode === 'luciana' && maintenanceAction === 'reschedule' ? 'Guardar y re-agendar' : 'Confirmar y Guardar'}
              </button>
            </div>
          </form>
        </section>}

        {ENABLE_SOFIA_CHAT && (activeModule === 'budgets' || (activeModule === 'copilot' && demoStep === '1')) && (
          <section aria-label="Cadencia automática de Sofía" className="mb-4 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5 dark:border-indigo-900 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Seguimiento sin intervención humana</p>
                <h2 className="mt-1 text-lg font-bold">Cadencia de Sofía</h2>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">Sin consumo de tiempo de David</span>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {followUps.map((followUp) => (
                <article key={followUp.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800">
                  <p className="text-xs font-bold">Día {followUp.dayNumber} · {followUp.status === 'sent' ? 'Completado por Sofía' : 'Programado'}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{followUp.message}</p>
                  <p className="mt-2 text-[10px] text-slate-500">{followUp.budget.customer.companyName ?? followUp.budget.customer.fullName} · {followUp.budget.status}</p>
                </article>
              ))}
              {!followUps.length && <p className="text-xs text-slate-500">No hay recontactos programados para mostrar.</p>}
            </div>
          </section>
        )}

        {activeModule === 'maintenance' && <section aria-label="Alertas de mantenimiento por horómetro" className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">Luciana · Alfa Operativa · Post-venta</p>
              <h2 className="mt-1 text-xl font-bold">Alertas de Mantenimiento por Horómetro</h2>
            </div>
            <p className="text-sm text-slate-500">Ordenadas por proximidad al próximo service.</p>
          </div>
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-300">Cola de re-llamados de service</p>
                <p className="mt-1 text-xs text-slate-500">Seguimientos asignados a Luciana</p>
              </div>
              <button type="button" onClick={() => setActiveModule('followups')} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/50">Ver todos</button>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {agentFollowUps.filter((item) => item.status === 'scheduled').slice(0, 6).map((item) => (
                <article key={item.id} className="rounded-lg border border-white bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold">{item.customer}</p>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${new Date(item.dueAt).getTime() < Date.now() ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                      {new Date(item.dueAt).getTime() < Date.now() ? 'Vencido' : 'Agendado'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{mounted ? new Date(item.dueAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : ''} · {item.priority}</p>
                  <p className="mt-2 line-clamp-2 text-xs">{item.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.phone && <a href={`tel:${item.phone.replace(/[^\d+]/g, '')}`} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold dark:border-slate-700">☎ Llamar</a>}
                    <button type="button" onClick={() => setManualFollowUpStatus(item, 'completed')} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">Marcar realizado</button>
                  </div>
                </article>
              ))}
              {!agentFollowUps.some((item) => item.status === 'scheduled') && (
                <p className="py-3 text-xs text-slate-500">No hay re-llamados de servicio pendientes.</p>
              )}
            </div>
          </div>
          {maintenanceEquipment.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {maintenanceEquipment.map((equipment) => (
                <article key={equipment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">{equipment.model}</h3>
                      <p className="mt-1 text-sm text-slate-600">{equipment.customer.companyName ?? equipment.customer.fullName}</p>
                      {equipment.customer.phone && (
                        <p className="mt-1 text-xs text-slate-500">{equipment.customer.phone}</p>
                      )}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      equipment.hoursToService !== null && equipment.hoursToService <= 100
                        ? 'bg-red-100 text-red-700'
                        : equipment.hoursToService !== null && equipment.hoursToService <= 300
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {equipment.hoursToService === null
                        ? 'Sin plan'
                        : equipment.hoursToService <= 0
                          ? `Vencido ${Math.abs(equipment.hoursToService)} hs`
                          : `${equipment.hoursToService} hs al service`}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {mounted ? Number(equipment.currentHours).toLocaleString('es-AR') : Number(equipment.currentHours)} hs actuales
                    {equipment.maintenancePlans[0] ? ` · límite ${mounted ? equipment.maintenancePlans[0].nextDueHours.toLocaleString('es-AR') : equipment.maintenancePlans[0].nextDueHours} hs` : ''}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
                    Contacto de servicio {equipment.customer.maintenanceWhatsAppSentAt ? 'iniciado' : 'pendiente'} · {equipment.customer.maintenanceWhatsAppRepliedAt ? 'cliente respondió' : 'sin respuesta'}{equipment.customer.requiresDirectCall ? ' · llamada directa requerida' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => openMinuteForEquipment(equipment.id)}
                    className="mt-3 text-sm font-bold text-[#1E64FF] hover:text-blue-800"
                  >
                    Registrar minuta →
                  </button>
                  {equipment.customer.phone && (
                    <div className="mt-2 flex gap-2">
                      <a
                        href={`tel:${equipment.customer.phone.replace(/[^\d+]/g, '')}`}
                        aria-label={`Llamar a ${equipment.customer.companyName ?? equipment.customer.fullName}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        ☎ Llamar
                      </a>
                      <a
                        href={`https://wa.me/${equipment.customer.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Abrir WhatsApp de ${equipment.customer.companyName ?? equipment.customer.fullName}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        ◉ WhatsApp
                      </a>
                    </div>
                  )}
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void captureCorporateEmail(equipment.customerId);
                    }}
                    className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700"
                  >
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Email corporativo del cliente
                      <input
                        type="email"
                        required
                        value={selectedCustomerId === equipment.customerId ? emailDraft : equipment.customer.corporateEmail ?? ''}
                        onChange={(event) => {
                          setSelectedCustomerId(equipment.customerId);
                          setSelectedEquipmentId(equipment.id);
                          setEmailDraft(event.target.value);
                        }}
                        placeholder="compras@empresa.com"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={!token || isSavingEmail}
                      className="mt-2 rounded-lg bg-[#1E64FF] px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      {isSavingEmail ? 'Guardando…' : 'Guardar email'}
                    </button>
                    {emailSavedFor === equipment.customerId && (
                      <p role="status" className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">[✓ Guardado y Etiquetado para Audiencia Meta]</p>
                    )}
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Inicia sesión para cargar los equipos de mantenimiento asignados a tu organización.
            </p>
          )}
        </section>}

        {activeModule === 'customers' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">Ficha comercial</p>
            <h2 className="mt-2 text-2xl font-bold">
              {customers.find((customer) => customer.id === selectedCustomerId)?.companyName ??
                customers.find((customer) => customer.id === selectedCustomerId)?.fullName ??
                'Selecciona un cliente'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {customerEquipment.length} equipo(s) vinculado(s) · {customerBudgets.length} presupuesto(s)
            </p>
            <button
              type="button"
              onClick={() => setActiveModule('maintenance')}
              disabled={!customerEquipment.length}
              className="mt-5 rounded-lg bg-[#1E64FF] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Registrar contacto / minuta
            </button>
          </section>
        )}

        {ENABLE_SOFIA_CHAT && activeModule === 'copilot' && <div className="grid min-h-[560px] gap-3 xl:grid-cols-[1fr_1fr]">
          <section aria-label="Chat de cliente" className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF1FF] text-sm font-bold text-[#1E64FF]">S</div>
                <div>
                  <h2 className="font-bold">Sofía</h2>
                  <p className="mt-0.5 text-xs text-emerald-600">Asesora Comercial Pro-Aire · en línea</p>
                </div>
              </div>
              <span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">WhatsApp · demo</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#F7F9FC] px-4 py-5 sm:px-6">
              <p className="mx-auto w-fit rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 shadow-sm">Hoy · conversación de prueba</p>
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.author === 'customer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] rounded-2xl px-4 py-3 shadow-sm ${message.author === 'customer' ? 'rounded-br-sm bg-[#D9FDD3] text-[#1E3527]' : message.author === 'david' ? 'rounded-bl-sm border border-blue-100 bg-blue-50 text-blue-950' : 'rounded-bl-sm border border-slate-100 bg-white text-slate-700'}`}>
                    {message.author !== 'customer' && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#1E64FF]">{message.author === 'david' ? 'David · Equipo comercial' : 'Sofía · Asesora Comercial Pro-Aire'}</p>}
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                    {message.attachment && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-bold">📎 {message.attachment.label}</p>
                        {message.attachment.href
                          ? <a href={message.attachment.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-blue-700 underline">Abrir presupuesto PDF</a>
                          : <p className="mt-1 rounded-md border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">acá va el pdf</p>}
                      </div>
                    )}
                    <p className="mt-1.5 text-right text-[10px] text-slate-400">{mounted ? message.time : ''}</p>
                  </div>
                </div>
              ))}
            </div>

            {demoStep !== '1' && <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {['Quiero cotizar un compresor', 'Necesito ayuda con mantenimiento'].map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setDraft(suggestion)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700">{suggestion}</button>
                ))}
              </div>
              <form onSubmit={sendMessage} className="flex items-center gap-2">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="Mensaje del cliente" placeholder="Escribe un mensaje como cliente…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-[#1E64FF] focus:ring-4 focus:ring-blue-100" />
                <button disabled={!draft.trim()} className="rounded-xl bg-[#1E64FF] px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">Enviar</button>
              </form>
              {pendingMessage && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
                  <p className="text-xs text-blue-900">¿Necesita atención humana?</p>
                  <button type="button" onClick={() => void handOffToDavid()} disabled={!token || isSending} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#1E64FF] shadow-sm hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                    {isSending ? 'Derivando…' : 'Derivar a David'}
                  </button>
                </div>
              )}
            </div>}
          </section>

          <section aria-label="Consola de David" className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-[#263449] bg-[#111B2B] text-white shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#71A0FF]">SalesPilot · recepción</p>
                <h2 className="mt-1 text-lg font-bold">Consola de David</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> En línea
              </div>
            </div>

              {demoStep === '1' ? (
                <div className="m-4 flex flex-1 flex-col justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-6 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-300/10 text-2xl text-emerald-200">✓</span>
                  <h3 className="mt-4 font-bold text-emerald-100">Conversación resuelta por Sofía</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Diagnóstico consultivo, presupuesto compartido y recepción confirmada. No hubo intervención humana.</p>
                  <p className="mt-4 text-xs text-slate-500">La cadencia de recontacto queda programada para los días 3, 7 y 15.</p>
                </div>
              ) : (
                <>
              {demoStep === '2' && (
                <div className="mx-4 mt-3 rounded-xl border border-blue-400/20 bg-blue-400/10 p-3 sm:mx-5">
                  <p className="text-xs font-bold text-blue-100">Cliente · WhatsApp inbound</p>
                  <p className="mt-1 text-sm text-white">¿Pueden financiar el PA 132 en 8 cheques?</p>
                  <p className="mt-1 text-[10px] text-blue-100/70">Derivación #REF-104 · requiere confirmación comercial</p>
                </div>
              )}
              {demoStep !== '1' && (
                <div className="mx-4 mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 sm:mx-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-amber-100">
                        Notificación Dual · {references.find((reference) => reference.refCode === '#REF-104')?.conversation?.status ?? 'REQUIRES_HUMAN'}
                      </p>
                      <p className="mt-1 text-[11px] text-amber-100/75">#REF-104 · Financiación en 8 cheques para PA 132</p>
                    </div>
                    <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200">Alerta Web App ✓</span>
                    <span className="rounded-full bg-emerald-300/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200">WhatsApp personal David · simulada ✓</span>
                  </div>
                </div>
              )}

            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 py-3 sm:px-6">
              <p className="text-xs text-slate-400">Comandos recibidos del asistente</p>
              <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-[10px] text-slate-300">#REF-XXX</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {visibleReferences.length ? visibleReferences.map((reference) => (
                <article key={reference.id} className="rounded-xl border border-white/10 bg-[#19263A] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-[#71A0FF]/25 bg-[#1E64FF]/15 px-2 py-1 font-mono text-xs font-bold text-[#9BB9FF]">{reference.refCode}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${reference.resolved ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>{reference.resolved ? 'Ejecutado' : 'Pendiente'}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{reference.sourceChannel}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{reference.summary ?? 'Nueva conversación derivada por Copilot.'}</p>
                  <button
                    type="button"
                    onClick={() => scheduleReferenceFollowUp(reference)}
                    className="mt-3 rounded-lg border border-blue-300/30 bg-blue-400/10 px-3 py-2 text-xs font-bold text-blue-200 hover:bg-blue-400/20"
                  >
                    📅 Agendar Re-contacto
                  </button>
                  {!reference.resolved && demoStep === '2' && reference.refCode === '#REF-104' && (
                    <button type="button" onClick={() => void takeReference(reference.refCode)} disabled={davidTaken} className="mt-3 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50">
                      {davidTaken ? 'Conversación tomada por David ✓' : 'Tomar Conversación #REF-104'}
                    </button>
                  )}
                  {!reference.resolved && demoStep !== '2' && (
                    <button type="button" onClick={() => void resolveReference(reference.refCode)} className="mt-3 text-xs font-semibold text-[#86A9FF] hover:text-white">Marcar como atendida →</button>
                  )}
                  {demoStep === '2' && davidTaken && reference.refCode === '#REF-104' && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Respuesta de David
                        <textarea value={davidReply} onChange={(event) => setDavidReply(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-white/10 bg-[#111B2B] p-2 text-xs font-normal text-white" />
                      </label>
                      <button type="button" onClick={sendDavidReply} disabled={!davidReply.trim()} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Enviar oferta al cliente</button>
                    </div>
                  )}
                </article>
              )) : (
                <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-8 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-xl text-[#71A0FF]">⌘</span>
                  <p className="mt-4 text-sm font-semibold text-slate-200">Esperando derivaciones</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">Cuando el cliente necesite a una persona, Copilot enviará un comando con su referencia.</p>
                </div>
              )}
            </div>

            {demoStep !== '1' && <form onSubmit={submitCommand} className="border-t border-white/10 bg-[#0C1421] p-4 sm:p-5">
              <label htmlFor="command" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Ejecutar comando</label>
              <div className="flex gap-2">
                <input id="command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="resolver #REF-104" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#172234] px-3 py-2.5 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#5487FF]" />
                <button disabled={!token || !command.trim()} className="rounded-lg bg-[#1E64FF] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40">Ejecutar</button>
              </div>
            </form>}
            {demoStep === '2' && davidTaken && (
              <div className="border-t border-white/10 bg-[#0C1421] p-4 sm:p-5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-200">
                  Regla comercial para Sofía
                  <textarea
                    value={learningRule}
                    onChange={(event) => setLearningRule(event.target.value)}
                    rows={2}
                    placeholder="Anota cómo responder a esta objeción…"
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#172234] p-2 text-xs font-normal text-white"
                  />
                </label>
                <button type="button" onClick={() => void submitLearningRule('#REF-104')} disabled={isSavingLearningRule} className="mt-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">
                  {isSavingLearningRule ? 'Registrando…' : '💡 Registrar Regla Comercial / Notificar Desarrollo'}
                </button>
                {learningRule.startsWith('Regla registrada') && <p role="status" className="mt-2 text-xs text-emerald-300">{learningRule}</p>}
              </div>
            )}
                </>
              )}
          </section>
        </div>}
        {ENABLE_SOFIA_CHAT && activeModule === 'copilot' && <p className="mt-3 text-center text-xs text-slate-400">Respuestas del bot simuladas localmente · los comandos usan la API local de SalesPilotAI.</p>}
          </div>
        </section>
      </div>
      {orderJson && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onClick={() => setOrderJson('')}>
          <section role="dialog" aria-modal="true" aria-labelledby="order-json-title" className="flex max-h-[85dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900" onClick={(event) => event.stopPropagation()}>
            <header className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
              <h2 id="order-json-title" className="font-bold">Orden de Pedido · JSON</h2>
              <button type="button" onClick={() => setOrderJson('')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold dark:border-slate-700">Cerrar</button>
            </header>
            <pre className="overflow-auto p-4 text-xs leading-5 text-slate-700 dark:text-slate-200">{orderJson}</pre>
          </section>
        </div>
      )}
    </main>
  );
}
