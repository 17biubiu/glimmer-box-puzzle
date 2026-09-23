import { loadSave, type SaveData } from '~/game/core/storage'

/** 全局共享的存档对象（ref 深响应式；修改后由 storage.ts 的 helper 负责落盘） */
export function useSave() {
  return useState<SaveData>('glimmer-save', () => loadSave())
}
