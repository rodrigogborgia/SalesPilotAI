import prisma from '../../lib/prisma';

function currentArgentinaMonth(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('No se pudo determinar el mes comercial actual.');
  const monthStart = new Date(`${year}-${month}-01T00:00:00-03:00`);
  const nextMonthStart = month === '12'
    ? new Date(`${Number(year) + 1}-01-01T00:00:00-03:00`)
    : new Date(`${year}-${String(Number(month) + 1).padStart(2, '0')}-01T00:00:00-03:00`);
  return { monthStart, nextMonthStart };
}

function customerKey(email: string | null | undefined, company: string | null | undefined) {
  return email?.trim().toLowerCase() || company?.trim().toLocaleLowerCase('es-AR') || '';
}

export async function getMonthlyCommercialKpis(organizationId: string) {
  const { monthStart, nextMonthStart } = currentArgentinaMonth(new Date());
  const [monthlyInvoices, monthlyQuotes, monthlyWins, organization] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: { organizationId, invoiceDate: { gte: monthStart, lt: nextMonthStart } }
    }),
    prisma.opportunity.findMany({
      where: { organizationId, quotedAt: { gte: monthStart, lt: nextMonthStart } },
      include: {
        lead: { select: { email: true, companyName: true, customerType: true, customerName: true } },
        salesOwnerUser: { select: { firstName: true } }
      }
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId,
        stage: 'Ganada',
        wonAt: { gte: monthStart, lt: nextMonthStart }
      },
      include: {
        lead: { select: { email: true, companyName: true, customerType: true, customerName: true } },
        salesOwnerUser: { select: { firstName: true } }
      }
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { monthlyEquipmentTarget: true, monthlyServicePartsTarget: true }
    })
  ]);
  if (!organization) throw new Error('No se encontró la organización para calcular los objetivos comerciales.');

  const personMetrics = (['David', 'Luciana'] as const).map((name) => {
    const personInvoices = monthlyInvoices.filter((invoice) => invoice.salesOwner === name);
    const relevantInvoices = personInvoices.filter((invoice) =>
      name === 'David'
        ? invoice.businessUnit === 'equipment'
        : invoice.businessUnit === 'service' || invoice.businessUnit === 'spare_parts'
    );
    const quotes = monthlyQuotes.filter((quote) => quote.salesOwnerUser?.firstName === name);
    const wins = quotes.filter((quote) => quote.stage === 'Ganada');
    const acceptedNewCustomers = name === 'David'
      ? monthlyWins
          .filter((quote) => quote.salesOwnerUser?.firstName === name && quote.lead?.customerType === 'new')
          .map((quote) => customerKey(quote.lead?.email, quote.lead?.companyName ?? quote.lead?.customerName))
          .filter(Boolean)
      : relevantInvoices
          .filter((invoice) => invoice.customerType === 'new')
          .map((invoice) => customerKey(invoice.customerEmail, invoice.customerName))
          .filter(Boolean);
    const reactivatedCustomers = relevantInvoices
      .filter((invoice) => invoice.customerType === 'reactivated')
      .map((invoice) => customerKey(invoice.customerEmail, invoice.customerName))
      .filter(Boolean);
    const billedAmount = relevantInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0);
    const quotesIssued = quotes.length;
    const acceptedQuotes = wins.length;
    const monthlyTarget = name === 'David'
      ? Number(organization.monthlyEquipmentTarget)
      : Number(organization.monthlyServicePartsTarget);
    return {
      owner: name,
      monthlyTarget,
      billedAmount,
      invoiceLineCount: relevantInvoices.length,
      targetCompletionPercent: monthlyTarget > 0 ? Math.round((billedAmount / monthlyTarget) * 100) : 0,
      equipmentUnits: name === 'David'
        ? relevantInvoices.reduce((total, invoice) => total + invoice.equipmentQuantity, 0)
        : 0,
      quotesIssued,
      acceptedQuotes,
      quoteConversionPercent: quotesIssued ? Math.round((acceptedQuotes / quotesIssued) * 100) : 0,
      newCustomers: new Set(acceptedNewCustomers).size,
      reactivatedCustomers: new Set(reactivatedCustomers).size
    };
  });
  const totalTarget = personMetrics.reduce((total, person) => total + person.monthlyTarget, 0);
  const totalBilled = personMetrics.reduce((total, person) => total + person.billedAmount, 0);
  const totalQuotes = personMetrics.reduce((total, person) => total + person.quotesIssued, 0);
  const totalAcceptedQuotes = personMetrics.reduce((total, person) => total + person.acceptedQuotes, 0);

  return {
    monthStart: monthStart.toISOString(),
    people: personMetrics,
    total: {
      monthlyTarget: totalTarget,
      billedAmount: totalBilled,
      invoiceLineCount: personMetrics.reduce((total, person) => total + person.invoiceLineCount, 0),
      targetCompletionPercent: totalTarget ? Math.round((totalBilled / totalTarget) * 100) : 0,
      equipmentUnits: personMetrics.reduce((total, person) => total + person.equipmentUnits, 0),
      quotesIssued: totalQuotes,
      acceptedQuotes: totalAcceptedQuotes,
      quoteConversionPercent: totalQuotes ? Math.round((totalAcceptedQuotes / totalQuotes) * 100) : 0,
      newCustomers: personMetrics.reduce((total, person) => total + person.newCustomers, 0),
      reactivatedCustomers: personMetrics.reduce((total, person) => total + person.reactivatedCustomers, 0)
    }
  };
}
