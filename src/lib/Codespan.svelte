<script lang="ts">
  export let raw
  import 'katex/contrib/mhchem'
  import renderMathInElement from 'katex/contrib/auto-render'

  let renderedMath: string | undefined
  if ( raw.startsWith('`\\(') || raw.startsWith('`\\[') || raw.startsWith('`$') || raw.startsWith('`$$') ) {
    let dummy = document.createElement("div")
    dummy.textContent = raw.replace(/`/g, '')
    renderMathInElement(dummy, {
        delimiters: [
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '$', right: '$', display: false},
            {left: '$$', right: '$$', display: true}
        ],
        throwOnError : false
        // output: "mathml"
      })
    renderedMath = dummy.innerHTML;
    dummy.remove();
  }

</script>

{#if renderedMath}
  {@html renderedMath}
{:else}
  <code>{raw.replace(/`/g, '')}</code>
{/if}
