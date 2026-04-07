<template>
  <label class="inline-flex items-center cursor-pointer select-none">
    <input
      type="checkbox"
      class="form-checkbox accent-primary h-4 w-4 rounded border border-input focus:ring-2 focus:ring-primary"
      :checked="modelValue"
      @change="onChange"
    />
    <span v-if="slots.default" class="ml-2"><slot /></span>
  </label>
</template>

<script setup lang="ts">
import { useSlots } from "vue";

const props = defineProps({
  modelValue: Boolean
});
const emit = defineEmits(['update:modelValue']);
const slots = useSlots();

function onChange(event: Event) {
  const target = event.target as HTMLInputElement | null;
  emit('update:modelValue', !!(target && target.checked));
}
</script>
