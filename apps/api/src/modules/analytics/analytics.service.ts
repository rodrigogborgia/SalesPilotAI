export const analyticsService = {
  async listAudits() {
    return [
      {
        id: 'audit-1',
        organizationId: 'demo-org',
        conversationId: 'conv-1',
        severity: 'MEDIUM',
        sentiment: 'neutral',
        objections: ['precio', 'tiempo de entrega'],
        summary: 'El cliente necesitaba mayor claridad sobre capacidad y garantía.'
      }
    ];
  },

  async runAudit() {
    return {
      startedAt: new Date().toISOString(),
      status: 'completed',
      summary: 'Auditoría semanal completada. Se detectaron 3 objeciones principales y 2 oportunidades de mejora de prompt.',
      insights: {
        sentiment: 'mixed',
        mainObjections: ['precio', 'tiempo de entrega', 'filtros'],
        recommendations: ['Más claridad en ROI', 'Mejorar frase de cierre']
      }
    };
  },

  async listPromptHistory() {
    return [
      {
        id: 'prompt-1',
        title: 'Prompt base para diagnóstico consultivo',
        version: 1,
        createdAt: new Date().toISOString()
      }
    ];
  },

  async savePromptHistory(payload: Record<string, unknown>) {
    return {
      id: 'prompt-new',
      ...payload,
      createdAt: new Date().toISOString()
    };
  }
};
