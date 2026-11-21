import { Prisma } from '@prisma/client';

import prisma from '../../lib/prisma';

export type CreateCustomerInput = {
  entityType: 'person' | 'company';
  fullName: string;
  companyName?: string;
  documentNumber?: string;
  bejermanId?: string;
  email?: string;
  phone?: string;
  contact?: {
    fullName: string;
    title?: string;
    relationship?: 'owner' | 'employee' | 'other';
    email?: string;
    phone?: string;
  };
};

export type LeadCustomerIdentityInput = {
  entityType: 'person' | 'company';
  fullName: string;
  companyName?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  title?: string;
  relationship: 'owner' | 'employee' | 'other';
};

function normalizeText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es-AR');
}

function normalizeDocumentNumber(value: string) {
  return value.replace(/\D/g, '');
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export async function resolveLeadCustomerIdentity(
  tx: Prisma.TransactionClient,
  organizationId: string,
  input: LeadCustomerIdentityInput
) {
  const customers = await tx.customer.findMany({
    where: { organizationId, entityType: input.entityType },
    include: { contacts: true }
  });
  const documentNumber = input.documentNumber ? normalizeDocumentNumber(input.documentNumber) : '';
  const email = input.email?.toLocaleLowerCase('es-AR') ?? '';
  const phone = input.phone ? normalizePhone(input.phone) : '';
  const displayName = input.entityType === 'company'
    ? input.companyName ?? input.fullName
    : input.fullName;
  const matchingCustomers = customers.filter((customer) => {
    if (documentNumber) {
      return customer.documentNumber !== null &&
        normalizeDocumentNumber(customer.documentNumber) === documentNumber;
    }
    if (input.entityType === 'company') {
      return normalizeText(customer.companyName ?? '') === normalizeText(displayName);
    }
    if (normalizeText(customer.fullName) !== normalizeText(displayName)) return false;
    return Boolean(email && customer.email?.toLocaleLowerCase('es-AR') === email) ||
      Boolean(phone && normalizePhone(customer.phone ?? '') === phone);
  });

  if (matchingCustomers.length > 1) return { ambiguous: true as const };
  if (
    documentNumber &&
    matchingCustomers.length === 0 &&
    customers.some((customer) => normalizeText(customer.companyName ?? '') === normalizeText(displayName))
  ) {
    return { ambiguous: true as const };
  }
  if (
    input.entityType === 'person' &&
    !documentNumber &&
    matchingCustomers.length === 0 &&
    customers.some((customer) => normalizeText(customer.fullName) === normalizeText(displayName))
  ) {
    return { ambiguous: true as const };
  }

  let customer = matchingCustomers[0];
  if (!customer) {
    customer = await tx.customer.create({
      data: {
        organizationId,
        entityType: input.entityType,
        fullName: displayName,
        companyName: input.entityType === 'company' ? displayName : null,
        documentNumber: input.documentNumber
          ? documentNumber
          : null,
        email: input.entityType === 'person' ? email || null : null,
        corporateEmail: input.entityType === 'company' ? email || null : null,
        phone: input.entityType === 'person' ? input.phone?.trim() || null : null
      },
      include: { contacts: true }
    });
  } else if (documentNumber && !customer.documentNumber) {
    customer = await tx.customer.update({
      where: { id: customer.id },
      data: { documentNumber },
      include: { contacts: true }
    });
  }

  if (input.entityType === 'person') {
    if (email || input.phone?.trim() || input.title?.trim()) {
      customer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          ...(email ? { email } : {}),
          ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
          ...(input.title?.trim() ? { contactTitle: input.title.trim() } : {})
        },
        include: { contacts: true }
      });
    }
    return { ambiguous: false as const, customer, contact: null };
  }

  const normalizedName = normalizeText(input.fullName);
  const sameNameContacts = customer.contacts.filter((contact) => normalizeText(contact.fullName) === normalizedName);
  const matchingContacts = sameNameContacts.filter((contact) => {
    return Boolean(email && contact.email?.toLocaleLowerCase('es-AR') === email) ||
      Boolean(phone && normalizePhone(contact.phone ?? '') === phone);
  });
  if (
    matchingContacts.length > 1 ||
    (matchingContacts.length === 0 && sameNameContacts.length > 1 && !email && !phone)
  ) {
    return { ambiguous: true as const };
  }

  const existingContact = matchingContacts[0] ??
    (!email && !phone && sameNameContacts.length === 1 ? sameNameContacts[0] : undefined);
  const contact = existingContact
    ? await tx.customerContact.update({
        where: { id: existingContact.id },
        data: {
          ...(input.title?.trim() ? { title: input.title.trim() } : {}),
          relationship: input.relationship === 'other' ? existingContact.relationship : input.relationship,
          ...(email ? { email } : {}),
          ...(input.phone?.trim() ? { phone: input.phone.trim() } : {})
        }
      })
    : await tx.customerContact.create({
        data: {
          organizationId,
          customerId: customer.id,
          fullName: input.fullName.trim(),
          title: input.title?.trim() || null,
          relationship: input.relationship,
          email: email || null,
          phone: input.phone?.trim() || null,
          isPrimary: customer.contacts.length === 0
        }
      });

  return { ambiguous: false as const, customer, contact };
}

export const customersService = {
  list(organizationId: string) {
    return prisma.customer.findMany({
      where: { organizationId },
      include: { contacts: { orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }] } },
      orderBy: [{ companyName: 'asc' }, { fullName: 'asc' }]
    });
  },

  async create(organizationId: string, input: CreateCustomerInput) {
    const candidates = await prisma.customer.findMany({
      where: { organizationId, entityType: input.entityType },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        documentNumber: true,
        bejermanId: true,
        email: true,
        phone: true
      }
    });
    const documentNumber = input.documentNumber ? normalizeDocumentNumber(input.documentNumber) : '';
    const phone = input.phone ? normalizePhone(input.phone) : '';
    const email = input.email?.toLocaleLowerCase('es-AR') ?? '';
    const normalizedName = normalizeText(input.entityType === 'company'
      ? input.companyName ?? input.fullName
      : input.fullName);
    const explicitMatches = candidates.filter((candidate) =>
      (input.bejermanId && candidate.bejermanId === input.bejermanId) ||
      (documentNumber && candidate.documentNumber &&
        normalizeDocumentNumber(candidate.documentNumber) === documentNumber)
    );
    if (explicitMatches.length) {
      return {
        duplicate: true as const,
        customerId: explicitMatches.length === 1 ? explicitMatches[0].id : null
      };
    }
    const sameNameCandidates = candidates.filter((candidate) =>
      normalizeText(input.entityType === 'company'
        ? candidate.companyName ?? ''
        : candidate.fullName) === normalizedName
    );
    if (sameNameCandidates.length) {
      if (documentNumber) {
        if (sameNameCandidates.some((candidate) => !candidate.documentNumber)) {
          return { duplicate: true as const, customerId: null };
        }
      } else if (input.entityType === 'person' && email && phone) {
        const exactContactMatches = sameNameCandidates.filter((candidate) =>
          candidate.email?.toLocaleLowerCase('es-AR') === email &&
          normalizePhone(candidate.phone ?? '') === phone
        );
        if (exactContactMatches.length === 1) {
          return { duplicate: true as const, customerId: exactContactMatches[0].id };
        }
        return { duplicate: true as const, customerId: null };
      } else {
        return {
          duplicate: true as const,
          customerId: sameNameCandidates.length === 1 ? sameNameCandidates[0].id : null
        };
      }
    }

    return prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          organizationId,
          entityType: input.entityType,
          fullName: input.fullName,
          companyName: input.entityType === 'company' ? input.companyName ?? input.fullName : null,
          documentNumber: input.documentNumber ?? null,
          bejermanId: input.bejermanId ?? null,
          email: input.entityType === 'person' ? input.email ?? null : null,
          corporateEmail: input.entityType === 'company' ? input.email ?? null : null,
          phone: input.entityType === 'person' ? input.phone ?? null : null
        }
      });
      if (input.entityType === 'company' && input.contact) {
        await tx.customerContact.create({
          data: {
            organizationId,
            customerId: customer.id,
            fullName: input.contact.fullName,
            title: input.contact.title ?? null,
            relationship: input.contact.relationship ?? 'other',
            email: input.contact.email ?? null,
            phone: input.contact.phone ?? null,
            isPrimary: true
          }
        });
      }
      return { duplicate: false as const, customer };
    });
  }
};
