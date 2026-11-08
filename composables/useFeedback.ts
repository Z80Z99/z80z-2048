import { onScopeDispose, ref } from 'vue'
import { createFeedbackController } from '../utils/feedback'

export function useFeedback(duration = 1500) {
  const text = ref('')
  const revision = ref(0)
  const controller = createFeedbackController(state => { text.value = state.text; revision.value = state.revision }, undefined, duration)
  onScopeDispose(controller.dispose)
  return { text, revision, show: controller.show, clear: controller.clear }
}
