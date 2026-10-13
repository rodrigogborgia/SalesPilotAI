export type CopilotReferenceInput = {
  conversationId: string;
  customerId?: string;
  refCode: string;
  sourceChannel: 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL' | 'PHONE' | 'OTHER';
  assignedToUserId?: string;
  requiresDerivation?: boolean;
  summary?: string;
};

export const copilotService = {
  async listReferences() {
    return [
      {
        id: 'ref-1',
        organizationId: 'demo-org',
        refCode: '#REF-104',
        sourceChannel: 'WHATSAPP',
        requiresDerivation: true,
        resolved: false,
        summary: 'Derivación pendiente a David para responder al cliente.'
      }
    ];
  },

  async createReference(input: CopilotReferenceInput) {
    return {
      id: 'ref-new',
      ...input,
      organizationId: 'demo-org',
      resolved: false,
      createdAt: new Date().toISOString()
    };
  },

  async resolveReference(refCode: string) {
    return {
      refCode,
      resolved: true,
      resolvedAt: new Date().toISOString(),
      status: 'executed'
    };
  }
};
