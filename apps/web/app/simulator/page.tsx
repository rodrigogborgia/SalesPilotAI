'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import ThemeToggle from '../../components/ThemeToggle';
import DemoTour from '../../components/DemoTour';

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
  conversation?: { status: string };
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
    companyName: string | null;
    phone: string | null;
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

type SimulatorModule = 'budgets' | 'maintenance' | 'customers' | 'copilot';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const budgetStatuses = [
  '01 - Enviado',
  '02 - En Seguimiento',
  '03 - Ganado',
  '04 - Perdido',
  '05 - Stand-By'
] as const;
const lossReasons = [
  'Precio elevado',
  'Plazo de entrega',
  'Reparó equipo actual',
  'Sin presupuesto',
  'Lead frío / Sin respuesta'
] as const;

function timeNow() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
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
  const [activeModule, setActiveModule] = useState<SimulatorModule>('maintenance');
  const [emailDraft, setEmailDraft] = useState('');
  const [emailSavedFor, setEmailSavedFor] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [demoStep, setDemoStep] = useState('');
  const [maintenanceEquipment, setMaintenanceEquipment] = useState<MaintenanceEquipment[]>([]);
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
  const [horometerHours, setHorometerHours] = useState('');
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
    setMessages((current) => current.map((message) =>
      message.time ? message : { ...message, time: timeNow() }
    ));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const module = params.get('module');
    if (module === 'budgets' || module === 'maintenance' || module === 'customers' || module === 'copilot') {
      setActiveModule(module);
    }
    const demo = params.get('demo') ?? '';
    setDemoStep(demo);
    if (demo === '2') setCommand('resolver #REF-104');
    const applyDemoTarget = (event: Event) => {
      const detail = (event as CustomEvent<{ module: string | null; demo: string | null }>).detail;
      if (detail.module === 'budgets' || detail.module === 'maintenance' || detail.module === 'customers' || detail.module === 'copilot') {
        setActiveModule(detail.module);
      }
      setDemoStep(detail.demo ?? '');
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
      const [equipmentResponse, budgetsResponse, followUpsResponse] = await Promise.all([
        fetch(`${apiUrl}/api/maintenance/outbound`, { headers }),
        fetch(`${apiUrl}/api/budgets`, { headers }),
        fetch(`${apiUrl}/api/budgets/follow-ups`, { headers })
      ]);
      const equipmentResult = (await equipmentResponse.json()) as MaintenanceEquipment[] | { message?: string };
      const budgetsResult = (await budgetsResponse.json()) as Budget[] | { message?: string };
      const followUpsResult = (await followUpsResponse.json()) as FollowUp[] | { message?: string };
      if (!equipmentResponse.ok || !Array.isArray(equipmentResult)) {
        throw new Error(!Array.isArray(equipmentResult) ? equipmentResult.message ?? 'No se pudo cargar la cola de mantenimiento.' : 'No se pudo cargar la cola de mantenimiento.');
      }
      if (!budgetsResponse.ok || !Array.isArray(budgetsResult)) {
        throw new Error(!Array.isArray(budgetsResult) ? budgetsResult.message ?? 'No se pudieron cargar los presupuestos.' : 'No se pudieron cargar los presupuestos.');
      }
      if (!followUpsResponse.ok || !Array.isArray(followUpsResult)) {
        throw new Error(!Array.isArray(followUpsResult) ? followUpsResult.message ?? 'No se pudo cargar la cadencia comercial.' : 'No se pudo cargar la cadencia comercial.');
      }
      setMaintenanceEquipment(equipmentResult);
      setBudgets(budgetsResult);
      setFollowUps(followUpsResult);
      if (equipmentResult.length) {
        setSelectedCustomerId((current) => current || equipmentResult[0].customerId);
        setSelectedEquipmentId((current) => current || equipmentResult[0].id);
        setHorometerHours((current) => current || String(equipmentResult[0].currentHours));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la gestión comercial.');
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

  function interpretVoiceTranscript(transcript: string) {
    setVoiceTranscript(transcript);
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

  async function saveVoiceMinute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedEquipmentId) {
      setError('Inicia sesión y selecciona un equipo para guardar la minuta.');
      return;
    }
    if (!Number.isFinite(Number(horometerHours)) || Number(horometerHours) < 0 ||
      !Number.isFinite(Number(amount || 0)) || Number(amount || 0) < 0) {
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
          nextAction,
          horometerHours,
          transcript: voiceTranscript
        })
      });
      const result = (await response.json()) as { budget?: Budget; message?: string };
      const savedBudget = result.budget;
      if (!response.ok || !savedBudget) {
        throw new Error(result.message ?? 'No se pudo guardar la minuta.');
      }
      setVoiceTranscript('');
      setNextAction('');
      setSelectedBudgetId('');
      setBudgets((current) => [savedBudget, ...current.filter((budget) => budget.id !== savedBudget.id)]);
      await loadSalesWorkspace(token);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar la minuta.');
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

  return (
    <main className="h-dvh overflow-hidden bg-[#F1F4F9] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[60px] max-w-[1800px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/SalesPilotAI.jpeg" alt="SalesPilotAI" width={160} height={48} className="h-9 w-auto rounded object-contain" />
            <span className="hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">Simulador comercial</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Demo local
            </span>
            <DemoTour />
            <ThemeToggle />
            <Link href="/portal" className="text-sm font-semibold text-[#1E64FF] hover:text-blue-700">Mi Planta</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid h-[calc(100dvh-61px)] max-w-[1800px] min-h-0 grid-cols-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-2 p-2 sm:p-3 xl:grid-cols-[205px_290px_minmax(0,1fr)] xl:grid-rows-1 xl:gap-3">
        <aside aria-label="Menú de módulos" className="flex min-h-0 items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 xl:flex-col xl:items-stretch xl:overflow-visible xl:p-3">
          <div className="hidden border-b border-slate-100 px-2 pb-3 xl:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1E64FF]">SalesPilotAI</p>
            <h1 className="mt-1 text-lg font-bold">Centro comercial</h1>
          </div>
          {([
            ['budgets', 'Presupuestos', '▤'],
            ['maintenance', 'Mantenimiento', '◷'],
            ['customers', 'Clientes', '◎'],
            ['copilot', 'Copilot', '⌘']
          ] as const).map(([module, label, icon]) => (
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
              {activeModule === 'maintenance' ? 'Prioridad de service' : activeModule === 'budgets' ? 'Pipeline comercial' : activeModule === 'customers' ? 'Cartera' : 'Actividad'}
            </p>
            <h2 className="mt-1 font-bold">
              {activeModule === 'maintenance' ? 'Cola outbound' : activeModule === 'budgets' ? 'Presupuestos' : activeModule === 'customers' ? 'Clientes' : 'Derivaciones'}
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
                    setSelectedCustomerId(budget.customerId);
                    setAmount(String(budget.amount));
                    setNextAction(budget.nextAction ?? '');
                    setLossReason(budget.motivoPerdida ?? '');
                    const matchingStatus = budgetStatuses.find((status) => status === budget.status);
                    if (matchingStatus) setBudgetStatus(matchingStatus);
                    if (budget.installedEquipment) selectEquipment(budget.installedEquipment.id);
                    setSelectedBudgetId(budget.id);
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
            {((activeModule === 'maintenance' && !maintenanceEquipment.length) ||
              (activeModule === 'budgets' && !budgets.length) ||
              (activeModule === 'customers' && !customers.length) ||
              (activeModule === 'copilot' && !visibleReferences.length)) && (
              <p className="px-3 py-8 text-center text-xs text-slate-500">
                {token ? 'No hay elementos para mostrar.' : 'Inicia sesión para cargar tus datos.'}
              </p>
            )}
          </div>
        </section>

        <section aria-label="Área de trabajo" className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#F7F9FC] dark:bg-[#0e1727]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 dark:bg-[#111c2e]">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold">{activeModule === 'copilot' ? 'Copilot Comercial' : activeModule === 'budgets' ? 'Gestión de presupuestos' : activeModule === 'customers' ? 'Ficha de cliente' : 'Operación de mantenimiento'}</p>
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

        {(activeModule === 'budgets' || activeModule === 'maintenance' || (activeModule === 'copilot' && demoStep === '2' && davidTaken)) && <section ref={minuteSectionRef} aria-label="Minuta comercial por voz" className="mb-4 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">Human-in-the-loop</p>
              <h2 className="mt-1 text-xl font-bold">{activeModule === 'copilot' ? 'Minuta de cierre · David' : 'Minuta comercial'}</h2>
              <p className="mt-1 text-sm text-slate-500">{activeModule === 'copilot' ? 'Grabación de voz limitada a 15 segundos. Revisa la tarjeta antes de guardar el seguimiento.' : 'Graba la conversación, revisa la interpretación y confirma los cambios.'}</p>
            </div>
            <button
              type="button"
              onClick={() => void startVoiceRecording()}
              className={`rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1E64FF] hover:bg-blue-700'}`}
            >
              {isRecording ? '⏹️ Detener grabación' : '🎙️ Registrar Minuta por Voz'}
            </button>
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
            <label className="text-sm font-semibold text-slate-700">
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
            </label>
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
            <label className="text-sm font-semibold text-slate-700">
              Estado del presupuesto
              <select
                value={budgetStatus}
                onChange={(event) => {
                  const status = budgetStatuses.find((candidate) => candidate === event.target.value);
                  if (status) setBudgetStatus(status);
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal"
              >
                {budgetStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
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
            </label>
            {budgetStatus === '04 - Perdido' && (
              <label className="text-sm font-semibold text-slate-700">
                Motivo de pérdida (opcional)
                <select
                  value={lossReason}
                  onChange={(event) => setLossReason(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-normal"
                >
                  <option value="">Sin especificar</option>
                  {lossReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </label>
            )}
            <label className="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
              Próxima Acción / Recordatorio
              <input
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                placeholder="Ej.: Llamar el viernes para confirmar visita técnica"
                maxLength={2000}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-3">
              Transcripción editable
              <textarea
                value={voiceTranscript}
                onChange={(event) => setVoiceTranscript(event.target.value)}
                rows={2}
                placeholder="La transcripción de voz aparecerá aquí; también puedes escribirla."
                className="mt-1.5 w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2 xl:col-span-3">
              <p className="text-xs text-slate-500">La voz se transcribe en el navegador. Revisa los campos antes de guardar.</p>
              <button
                type="submit"
                disabled={!token || isSavingMinute || !maintenanceEquipment.length}
                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingMinute ? 'Guardando…' : 'Confirmar y Guardar'}
              </button>
            </div>
          </form>
        </section>}

        {(activeModule === 'budgets' || (activeModule === 'copilot' && demoStep === '1')) && (
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

        {activeModule === 'maintenance' && <section aria-label="Llamadas salientes de mantenimiento" className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E64FF]">Gestión · Outbound</p>
              <h2 className="mt-1 text-xl font-bold">Llamadas de mantenimiento</h2>
            </div>
            <p className="text-sm text-slate-500">Ordenadas por proximidad al próximo service.</p>
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
                    Sofía consultó por WhatsApp al superar las 4.000 hs · {equipment.customer.maintenanceWhatsAppRepliedAt ? 'cliente respondió' : 'sin respuesta'}{equipment.customer.requiresDirectCall ? ' · llamada directa requerida' : ''}
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

        {activeModule === 'copilot' && <div className="grid min-h-[560px] gap-3 xl:grid-cols-[1fr_1fr]">
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
        {activeModule === 'copilot' && <p className="mt-3 text-center text-xs text-slate-400">Respuestas del bot simuladas localmente · los comandos usan la API local de SalesPilotAI.</p>}
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
