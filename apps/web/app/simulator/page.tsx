'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type ChatMessage = {
  id: string;
  author: 'customer' | 'bot';
  text: string;
  time: string;
};

type Reference = {
  id: string;
  refCode: string;
  sourceChannel: string;
  summary?: string;
  resolved: boolean;
  createdAt?: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function timeNow() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function botReply(message: string) {
  const normalizedMessage = message.toLocaleLowerCase('es-AR');
  if (normalizedMessage.includes('precio') || normalizedMessage.includes('cotiz')) {
    return 'Te ayudo con eso. Para recomendarte la configuración correcta, ¿me compartís el caudal o la potencia que necesitás? Si preferís, puedo derivar tu consulta a David.';
  }
  if (normalizedMessage.includes('manten') || normalizedMessage.includes('servicio') || normalizedMessage.includes('falla')) {
    return 'Puedo orientarte con el servicio de tu equipo. Para que un especialista revise el caso y coordine los próximos pasos, puedo derivar la conversación al equipo de Pro-Aire.';
  }
  if (normalizedMessage.includes('pa 132') || normalizedMessage.includes('compresor')) {
    return 'El Compresor PA 132 está pensado para aplicaciones industriales. Contame un poco más sobre tu operación y te ayudo a encontrar la alternativa adecuada.';
  }
  return 'Gracias por escribir a Pro-Aire. Soy el asistente comercial y puedo ayudarte con equipos, cotizaciones o servicio. ¿Qué necesitás resolver hoy?';
}

export default function SimulatorPage() {
  const [token, setToken] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      author: 'bot',
      text: '¡Hola! Soy el asistente comercial de Pro-Aire. Puedo ayudarte con equipos, cotizaciones y servicio técnico.',
      time: timeNow()
    }
  ]);
  const [references, setReferences] = useState<Reference[]>([]);
  const [draft, setDraft] = useState('');
  const [command, setCommand] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');

  useEffect(() => {
    const savedToken = window.localStorage.getItem('salespilot_token');
    if (!savedToken) return;
    setToken(savedToken);
    void loadReferences(savedToken);
  }, []);

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
    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      author: 'bot',
      text: botReply(text),
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

  return (
    <main className="min-h-screen bg-[#F1F4F9] text-[#172033]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/SalesPilotAI.jpeg" alt="SalesPilotAI" width={160} height={48} className="h-9 w-auto rounded object-contain" />
            <span className="hidden border-l border-slate-200 pl-3 text-sm font-medium text-slate-500 sm:inline">Simulador comercial</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Demo local
            </span>
            <Link href="/portal" className="text-sm font-semibold text-[#1E64FF] hover:text-blue-700">Mi Planta</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-8 sm:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1E64FF]">Entorno de demostración</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Copilot Comercial</h1>
            <p className="mt-2 text-sm text-slate-500">Simula una conversación de cliente y observa cómo llega la derivación a David.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
            Sin conexiones externas <span className="mx-2 text-slate-300">·</span> API local
          </div>
        </div>

        {!token && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <span>Inicia sesión como David para enviar derivaciones a su consola.</span>
            <Link href="/login?next=%2Fsimulator" className="rounded-lg bg-[#1E64FF] px-4 py-2 font-semibold text-white hover:bg-blue-700">Iniciar sesión</Link>
          </div>
        )}
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

        <div className="grid min-h-[680px] gap-5 xl:grid-cols-[1.04fr_0.96fr]">
          <section aria-label="Chat de cliente" className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EAF1FF] text-sm font-bold text-[#1E64FF]">PA</div>
                <div>
                  <h2 className="font-bold">Pro-Aire</h2>
                  <p className="mt-0.5 text-xs text-emerald-600">Asistente comercial · en línea</p>
                </div>
              </div>
              <span className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">WhatsApp · demo</span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#F7F9FC] px-4 py-5 sm:px-6">
              <p className="mx-auto w-fit rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 shadow-sm">Hoy · conversación de prueba</p>
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.author === 'customer' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[86%] rounded-2xl px-4 py-3 shadow-sm ${message.author === 'customer' ? 'rounded-br-sm bg-[#D9FDD3] text-[#1E3527]' : 'rounded-bl-sm border border-slate-100 bg-white text-slate-700'}`}>
                    {message.author === 'bot' && <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#1E64FF]">Copilot Pro-Aire</p>}
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
                    <p className="mt-1.5 text-right text-[10px] text-slate-400">{message.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 bg-white p-4 sm:p-5">
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
            </div>
          </section>

          <section aria-label="Consola de David" className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-[#263449] bg-[#111B2B] text-white shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#71A0FF]">SalesPilot · recepción</p>
                <h2 className="mt-1 text-lg font-bold">Consola de David</h2>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> En línea
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.025] px-5 py-3 sm:px-6">
              <p className="text-xs text-slate-400">Comandos recibidos del asistente</p>
              <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-[10px] text-slate-300">#REF-XXX</span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
              {references.length ? references.map((reference) => (
                <article key={reference.id} className="rounded-xl border border-white/10 bg-[#19263A] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-[#71A0FF]/25 bg-[#1E64FF]/15 px-2 py-1 font-mono text-xs font-bold text-[#9BB9FF]">{reference.refCode}</span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${reference.resolved ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-300/10 text-amber-200'}`}>{reference.resolved ? 'Ejecutado' : 'Pendiente'}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{reference.sourceChannel}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{reference.summary ?? 'Nueva conversación derivada por Copilot.'}</p>
                  {!reference.resolved && (
                    <button type="button" onClick={() => void resolveReference(reference.refCode)} className="mt-3 text-xs font-semibold text-[#86A9FF] hover:text-white">Marcar como atendida →</button>
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

            <form onSubmit={submitCommand} className="border-t border-white/10 bg-[#0C1421] p-4 sm:p-5">
              <label htmlFor="command" className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Ejecutar comando</label>
              <div className="flex gap-2">
                <input id="command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="resolver #REF-104" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#172234] px-3 py-2.5 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-[#5487FF]" />
                <button disabled={!token || !command.trim()} className="rounded-lg bg-[#1E64FF] px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40">Ejecutar</button>
              </div>
            </form>
          </section>
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">Respuestas del bot simuladas localmente · los comandos usan la API local de SalesPilotAI.</p>
      </div>
    </main>
  );
}
