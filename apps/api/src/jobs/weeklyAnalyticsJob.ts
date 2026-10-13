export async function runWeeklyAnalyticsJob() {
  const now = new Date().toISOString();

  return {
    startedAt: now,
    job: 'weekly-conversation-audit',
    status: 'scheduled',
    description: 'Revisa conversaciones semanales, evalúa objeciones, sentimiento y oportunidades de mejora del sistema prompt.'
  };
}
