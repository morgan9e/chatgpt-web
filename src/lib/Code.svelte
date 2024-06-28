<script lang="ts">
  import { HighlightAuto } from 'svelte-highlight'

  // Import both dark and light styles
  import { github, githubDark } from 'svelte-highlight/styles/index'

  // Style depends on system theme
  const style = window.matchMedia('(prefers-color-scheme: dark)').matches ? githubDark : github

  // Copy function for the code block
  import copy from 'copy-to-clipboard'

  import 'katex/contrib/mhchem'
  import renderMathInElement from 'katex/contrib/auto-render'

  export const type: 'code' = 'code'
  export const raw: string = ''
  export const codeBlockStyle: 'indented' | undefined = undefined
  export let text: string

  let renderedMath: string | undefined;

  // For copying code - reference: https://vyacheslavbasharov.com/blog/adding-click-to-copy-code-markdown-blog
  const copyFunction = (event) => {
    // Get the button the user clicked on
    const clickedElement = event.target as HTMLButtonElement

    // Get the next element
    const nextElement = clickedElement.nextElementSibling as HTMLElement

    // Modify the appearance of the button
    const originalButtonContent = clickedElement.innerHTML
    clickedElement.classList.add('is-success')
    clickedElement.innerHTML = 'Copied!'

    // Retrieve the code in the code block
    const codeBlock = (nextElement.querySelector('pre > code') as HTMLPreElement).innerText
    copy(codeBlock)

    // Restored the button after copying the text in 1 second.
    setTimeout(() => {
      clickedElement.innerHTML = originalButtonContent
      clickedElement.classList.remove('is-success')
      clickedElement.blur()
    }, 1000)
  }
</script>

<svelte:head>
  {@html style}
</svelte:head>

{#if renderedMath}
  {@html renderedMath}
{:else}
  <div class="code-block is-relative">
    <button class="button is-light is-outlined is-small p-2" on:click={copyFunction}>Copy</button>
    <HighlightAuto code={text} />
    </HighlightAuto>
  </div>
{/if}
