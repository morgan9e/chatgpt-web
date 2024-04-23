<script lang="ts">
  export let raw
  import katex from 'katex';

  let renderedMath: string | undefined;
  if (raw.startsWith("`rendermath")) {
    renderedMath = katex.renderToString(raw.replace(/`rendermath|`/g, ''), {
      throwOnError: false,
      displayMode: false
    });
  }

</script>

{#if renderedMath}
  {@html renderedMath}
{:else}
  <code>{raw.replace(/`/g, '')}</code>
{/if}