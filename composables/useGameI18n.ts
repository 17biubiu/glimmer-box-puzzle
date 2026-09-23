import { computed } from 'vue'
import { PACKS, PETS, type LevelMeta, type PackId, type PetKind } from '~/game/core/types'

export type AppLocale = 'zh' | 'en' | 'ja' | 'fr' | 'de'

export interface KnowledgeEntry {
  title: string
  text: string
}

const LOCALES: { code: AppLocale }[] = [
  { code: 'zh' },
  { code: 'en' },
  { code: 'ja' },
  { code: 'fr' },
  { code: 'de' },
]

export function useGameI18n() {
  const { t, tm, locale, locales, setLocale } = useI18n()

  const localeOptions = computed(() =>
    LOCALES.map((item) => ({
      code: item.code,
      label: t(`language.names.${item.code}`),
      short: t(`language.shorts.${item.code}`),
    })),
  )

  const localizedPets = computed(() =>
    PETS.map((pet) => ({
      ...pet,
      name: t(`pets.${pet.id}.name`),
      food: t(`pets.${pet.id}.food`),
    })),
  )

  const localizedPacks = computed(() =>
    PACKS.map((pack) => ({
      ...pack,
      name: t(`packs.${pack.id}.name`),
      desc: t(`packs.${pack.id}.desc`),
    })),
  )

  const knowledgeEntries = computed(() => tm('knowledge.entries') as KnowledgeEntry[])

  function petInfo(kind: PetKind) {
    return localizedPets.value.find((pet) => pet.id === kind) ?? localizedPets.value[0]!
  }

  function packInfo(packId: PackId) {
    return localizedPacks.value.find((pack) => pack.id === packId) ?? localizedPacks.value[0]!
  }

  function levelName(name?: string) {
    return name ? t(`levels.${name}`) : ''
  }

  function stageName(stage?: string) {
    return stage ? t(`stages.${stage}`) : ''
  }

  function localizedLevel(meta?: LevelMeta | null) {
    if (!meta) return undefined
    return {
      ...meta,
      name: levelName(meta.name),
      stage: stageName(meta.stage),
    }
  }

  async function switchLocale(code: AppLocale) {
    if (code === locale.value) return
    await setLocale(code)
  }

  return {
    t,
    tm,
    locale,
    locales,
    localeOptions,
    localizedPets,
    localizedPacks,
    knowledgeEntries,
    petInfo,
    packInfo,
    levelName,
    stageName,
    localizedLevel,
    switchLocale,
  }
}
