<template>
  <label class="inline-flex items-center cursor-pointer select-none">
    <input
      type="checkbox"
      class="form-checkbox accent-primary h-4 w-4 rounded border border-input focus:ring-2 focus:ring-primary"
      :checked="modelValue"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span class="ml-2"><slot /></span>
  </label>
</template>

<script setup lang="ts">
const props = defineProps({
  modelValue: Boolean
});
const emit = defineEmits(['update:modelValue']);
</script>
