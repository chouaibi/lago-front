// `PaymentProviders::MastercardProvider::REGIONS` on the API side.
export const MASTERCARD_REGIONS = ['ap', 'eu', 'na'] as const

type MastercardRegion = (typeof MASTERCARD_REGIONS)[number]

export const MASTERCARD_REGION_TRANSLATION_KEYS: Record<MastercardRegion, string> = {
  ap: 'text_1791490426178ukpgq48f01b',
  eu: 'text_1791490426178nsow70kpvw7',
  na: 'text_1791490426178ik9asxoath8',
}

export const isMastercardRegion = (value?: string | null): value is MastercardRegion =>
  MASTERCARD_REGIONS.some((region) => region === value)
