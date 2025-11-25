import {
  BillingProvider,
  PlanCode,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { prisma } from '../config/database';
import { getStripe } from '../providers/stripeClient';
import { upsertStripeSubscriptionRecord } from '../routes/stripeWebhook';

type SubscriptionSummary = {
  planCode: PlanCode;
  status: SubscriptionStatus;
  provider: BillingProvider;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

const TRIAL_DURATION_HOURS = Number(process.env.TRIAL_DURATION_HOURS || '4');

const DEFAULT_PLANS: Array<Prisma.PlanUpsertArgs> = [
  {
    where: { code: PlanCode.FREE },
    update: {
      name: 'Free',
      description: 'Free tier with limited capabilities',
      priceCents: 0,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 0,
    },
    create: {
      code: PlanCode.FREE,
      name: 'Free',
      description: 'Free tier with limited capabilities',
      priceCents: 0,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 0,
    },
  },
  {
    where: { code: PlanCode.TRIAL },
    update: {
      name: 'Trial',
      description: 'Trial plan for newly registered users',
      priceCents: 0,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 0,
    },
    create: {
      code: PlanCode.TRIAL,
      name: 'Trial',
      description: 'Trial plan for newly registered users',
      priceCents: 0,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 0,
    },
  },
  {
    where: { code: PlanCode.PRO },
    update: {
      name: 'Pro',
      description: 'Pro subscription billed monthly',
      priceCents: 500,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 0,
    },
    create: {
      code: PlanCode.PRO,
      name: 'Pro',
      description: 'Pro subscription billed monthly',
      priceCents: 500,
      currency: 'usd',
      interval: 'month',
      trialPeriodDays: 0,
    },
  },
];

export async function ensureDefaultPlans() {
  await prisma.$transaction(DEFAULT_PLANS.map((plan) => prisma.plan.upsert(plan)));
}

export async function ensureTrialSubscription(userId: string) {
  await ensureDefaultPlans();

  const existing = await prisma.userSubscription.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  const now = new Date();
  const trialEnds =
    !Number.isNaN(TRIAL_DURATION_HOURS) && TRIAL_DURATION_HOURS > 0
      ? new Date(now.getTime() + TRIAL_DURATION_HOURS * 60 * 60 * 1000)
      : null;

  return prisma.userSubscription.create({
    data: {
      userId,
      planCode: PlanCode.TRIAL,
      status: SubscriptionStatus.TRIALING,
      provider: BillingProvider.INTERNAL,
      trialEndsAt: trialEnds,
    },
  });
}

export async function getSubscriptionSummary(userId: string): Promise<SubscriptionSummary> {
  const subscription = await prisma.userSubscription.findUnique({
    where: { userId },
  });

  if (!subscription) {
    const created = await ensureTrialSubscription(userId);
    return {
      planCode: created.planCode,
      status: created.status,
      provider: created.provider,
      trialEndsAt: created.trialEndsAt,
      currentPeriodEnd: created.currentPeriodEnd,
      cancelAtPeriodEnd: created.cancelAtPeriodEnd,
    };
  }

  return {
    planCode: subscription.planCode,
    status: subscription.status,
    provider: subscription.provider,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  };
}

export function isSubscriptionActive(summary: SubscriptionSummary) {
  if (summary.planCode === PlanCode.PRO || summary.planCode === PlanCode.ENTERPRISE) {
    return summary.status === SubscriptionStatus.ACTIVE || summary.status === SubscriptionStatus.TRIALING;
  }

  if (summary.planCode === PlanCode.TRIAL) {
    if (summary.status === SubscriptionStatus.CANCELED) return false;
    if (!summary.trialEndsAt) return true;
    return summary.trialEndsAt.getTime() >= Date.now();
  }

  return false;
}

export async function hasActivePaidSubscription(userId: string) {
  const summary = await getSubscriptionSummary(userId);
  const isPaidPlan = summary.planCode === PlanCode.PRO || summary.planCode === PlanCode.ENTERPRISE;
  return isPaidPlan && isSubscriptionActive(summary);
}

type SubscriptionOverrides = Partial<
  Pick<SubscriptionSummary, 'planCode' | 'trialEndsAt' | 'currentPeriodEnd' | 'cancelAtPeriodEnd' | 'provider'>
>;

export async function setSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
  overrides: SubscriptionOverrides = {}
) {
  await ensureDefaultPlans();

  const current = await ensureTrialSubscription(userId);

  await prisma.userSubscription.update({
    where: { id: current.id },
    data: {
      status,
      ...(overrides.planCode ? { planCode: overrides.planCode } : {}),
      ...(overrides.provider ? { provider: overrides.provider } : {}),
      ...(overrides.trialEndsAt !== undefined ? { trialEndsAt: overrides.trialEndsAt } : {}),
      ...(overrides.currentPeriodEnd !== undefined ? { currentPeriodEnd: overrides.currentPeriodEnd } : {}),
      ...(overrides.cancelAtPeriodEnd !== undefined ? { cancelAtPeriodEnd: overrides.cancelAtPeriodEnd } : {}),
    },
  });
}

export function subscriptionToResponse(summary: SubscriptionSummary) {
  return {
    plan: summary.planCode.toLowerCase(),
    subscriptionStatus: summary.status.toLowerCase(),
    trialEndsAt: summary.trialEndsAt ? summary.trialEndsAt.toISOString() : null,
    currentPeriodEnd: summary.currentPeriodEnd ? summary.currentPeriodEnd.toISOString() : null,
    cancelAtPeriodEnd: summary.cancelAtPeriodEnd,
  };
}

/**
 * Sincroniza a assinatura do Stripe durante o login para garantir
 * que o status local está atualizado com o estado real no Stripe.
 * 
 * Esta função é chamada durante o login para verificar se há mudanças
 * na assinatura que não foram capturadas pelos webhooks.
 * 
 * Se não houver um stripeCustomer no banco, busca no Stripe por email
 * e cria o registro se encontrar um cliente com assinatura ativa.
 */
export async function syncStripeSubscriptionIfExists(userId: string): Promise<void> {
  try {
    // Busca o usuário para obter o email
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      return;
    }

    // Busca o Stripe customer associado ao usuário
    let stripeCustomer = await prisma.stripeCustomer.findUnique({
      where: { userId },
      select: { customerId: true },
    });

    const stripe = getStripe();
    let customerId: string | null = null;

    if (stripeCustomer) {
      // Já existe registro no banco, usa o customerId
      customerId = stripeCustomer.customerId;
    } else {
      // Não há registro no banco, busca no Stripe por email
      console.log('[subscription] No Stripe customer in DB, searching Stripe by email:', user.email);
      
      const stripeCustomers = await stripe.customers.list({
        email: user.email,
        limit: 10,
      });

      if (stripeCustomers.data.length === 0) {
        // Não há cliente no Stripe com esse email
        return;
      }

      // Verifica se algum cliente tem assinatura ativa ou em trial
      for (const customer of stripeCustomers.data) {
        // Busca todas as assinaturas (active, trialing, etc) para verificar se há alguma válida
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'all',
          limit: 10,
        });

        // Filtra assinaturas que indicam plano pago (active, trialing, past_due)
        const validSubscriptions = subscriptions.data.filter(
          sub => ['active', 'trialing', 'past_due'].includes(sub.status)
        );

        if (validSubscriptions.length > 0) {
          // Encontrou cliente com assinatura válida (paga)
          customerId = customer.id;
          console.log('[subscription] Found Stripe customer with paid subscription:', customerId, 'status:', validSubscriptions[0].status);

          // Cria o registro no banco de dados
          await ensureDefaultPlans();
          
          const newStripeCustomer = await prisma.stripeCustomer.create({
            data: {
              userId,
              customerId: customer.id,
              email: customer.email || user.email,
            },
            select: { id: true, userId: true },
          });

          await ensureTrialSubscription(newStripeCustomer.userId);
          
          // Sincroniza a assinatura mais recente encontrada
          const latestSubscription = validSubscriptions.sort(
            (a, b) => b.created - a.created
          )[0];
          
          await upsertStripeSubscriptionRecord(latestSubscription, 'sync_on_login_email_lookup');
          
          console.log('[subscription] Created Stripe customer record and synced subscription for user:', userId);
          return;
        }
      }

      // Se chegou aqui, não encontrou assinatura ativa
      console.log('[subscription] Found Stripe customer(s) but no active subscriptions for email:', user.email);
      return;
    }

    // Se já tinha customerId, busca e sincroniza assinaturas
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all', // Busca todas para pegar a mais recente
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return; // Não há assinaturas no Stripe
    }

    // Pega a assinatura mais recente
    const latestSubscription = subscriptions.data[0];

    // Reutiliza a lógica do webhook para sincronizar
    await upsertStripeSubscriptionRecord(latestSubscription, 'sync_on_login');
    
    console.log('[subscription] Synced Stripe subscription on login for user:', userId);
  } catch (error) {
    // Log mas não falha o login se a sincronização falhar
    console.error('[subscription] Failed to sync Stripe subscription on login:', error);
  }
}

