<script setup lang="ts">
import { computed } from 'vue'
import type { ExtractionMethod, PagePreview } from '@/types/extracted-page'

const props = defineProps<{ page: PagePreview; saving?: boolean; saved?: boolean }>()
defineEmits<{ save: [] }>()

const METHOD_LABELS: Record<ExtractionMethod, string> = {
  readability: 'Article',
  selection: 'Selection',
  fallback: 'Full page text',
}

const source = computed(() => props.page.siteName ?? new URL(props.page.url).hostname)
const words = computed(
  () =>
    `${props.page.wordCount.toLocaleString('en')} ${props.page.wordCount === 1 ? 'word' : 'words'}`,
)
</script>

<template>
  <section class="clip-preview">
    <p class="clip-preview__meta">
      <span class="clip-preview__method" data-test="method">{{ METHOD_LABELS[page.method] }}</span>
      <span>{{ source }}</span>
    </p>

    <h2 class="clip-preview__title" :title="page.title">{{ page.title }}</h2>
    <p v-if="page.byline" class="clip-preview__byline" data-test="byline">{{ page.byline }}</p>
    <p v-if="page.excerpt" class="clip-preview__excerpt" data-test="excerpt">{{ page.excerpt }}</p>

    <footer class="clip-preview__footer">
      <span class="clip-preview__count">{{ words }}</span>
      <button
        type="button"
        class="clip-preview__save"
        :disabled="saving || saved"
        data-test="save"
        @click="$emit('save')"
      >
        {{ saved ? 'Saved' : saving ? 'Saving…' : 'Save' }}
      </button>
    </footer>
  </section>
</template>

<style scoped lang="less">
@import '@/styles/variables.less';

.clamp(@lines) {
  display: -webkit-box;
  -webkit-line-clamp: @lines;
  line-clamp: @lines;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.clip-preview {
  display: flex;
  flex-direction: column;
  gap: @space-2;

  p {
    margin: 0;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: @space-2;
    font-size: @font-size-sm;
    color: @color-text-muted;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  &__method {
    flex-shrink: 0;
    padding: 1px @space-2;
    border: 1px solid @color-border;
    border-radius: @radius;
  }

  &__title {
    .clamp(2);
    margin: 0;
    font-size: @font-size-lg;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  &__byline {
    color: @color-text-muted;
  }

  &__excerpt {
    .clamp(3);
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: @space-2;
  }

  &__count {
    font-size: @font-size-sm;
    color: @color-text-muted;
  }

  &__save {
    padding: @space-2 @space-4;
    font: inherit;
    font-weight: 600;
    color: #fff;
    background: @color-accent;
    border: 0;
    border-radius: @radius;
    cursor: pointer;

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }

    &:focus-visible {
      outline: 2px solid @color-accent;
      outline-offset: 2px;
    }
  }
}
</style>
