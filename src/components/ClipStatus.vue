<script setup lang="ts">
defineProps<{ state: { status: 'saved' } | { status: 'error'; message: string } }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <p v-if="state.status === 'saved'" class="clip-status clip-status--saved" role="status">
    Saved to dlmnt.
  </p>
  <div v-else class="clip-status clip-status--error" role="alert">
    <p data-test="message">{{ state.message }}</p>
    <button type="button" class="clip-status__retry" data-test="retry" @click="$emit('retry')">
      Retry
    </button>
  </div>
</template>

<style scoped lang="less">
@import '@/styles/variables.less';

.clip-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: @space-3;
  margin: @space-3 0 0;
  padding: @space-2 @space-3;
  border-radius: @radius;

  p {
    margin: 0;
  }

  &--saved {
    color: @color-success;
    background: fade(@color-success, 10%);
  }

  &--error {
    color: @color-danger;
    background: fade(@color-danger, 8%);
  }

  &__retry {
    flex-shrink: 0;
    padding: @space-1 @space-3;
    font: inherit;
    color: @color-text;
    background: @color-bg;
    border: 1px solid @color-border;
    border-radius: @radius;
    cursor: pointer;
  }
}
</style>
