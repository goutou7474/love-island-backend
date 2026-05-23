import { hashPassword } from '../auth/passwords.js'
import type { CoupleSummary, IslandStore, PublicUser } from '../domain/store.js'
import { toPublicUser } from '../domain/store.js'
import { defaultAnniversaries } from './default-anniversaries.js'

export interface PrivateUserConfig {
  email: string
  password: string
  displayName: string
}

export interface PrivateCoupleConfig {
  coupleName: string
  owner: PrivateUserConfig
  partner: PrivateUserConfig
}

export interface PrivateCoupleBootstrapResult {
  owner: PublicUser
  partner: PublicUser
  couple: CoupleSummary
}

export async function bootstrapPrivateCouple(
  store: IslandStore,
  config: PrivateCoupleConfig,
): Promise<PrivateCoupleBootstrapResult> {
  if (config.owner.email.toLowerCase() === config.partner.email.toLowerCase()) {
    throw new Error('Owner and partner emails must be different')
  }

  const owner = await store.upsertUser({
    email: config.owner.email,
    displayName: config.owner.displayName,
    passwordHash: await hashPassword(config.owner.password),
  })
  const partner = await store.upsertUser({
    email: config.partner.email,
    displayName: config.partner.displayName,
    passwordHash: await hashPassword(config.partner.password),
  })

  const couple = await store.ensurePrivateCouple({
    ownerUserId: owner.id,
    partnerUserId: partner.id,
    name: config.coupleName,
    startDate: '2026-05-28',
  })

  for (const anniversary of defaultAnniversaries(couple.id)) {
    await store.upsertAnniversaryByKindOwner(anniversary)
  }

  return {
    owner: toPublicUser(owner),
    partner: toPublicUser(partner),
    couple,
  }
}
