<script lang="ts">
  import Code from './Code.svelte'
  import Codespan from './Codespan.svelte'
  import { afterUpdate, createEventDispatcher, onMount, onDestroy } from 'svelte'
  import { deleteMessage, deleteSummaryMessage, truncateFromMessage, submitExitingPromptsNow, continueMessage, updateMessages } from './Storage.svelte'
  import { getPrice } from './Stats.svelte'
  import SvelteMarkdown from 'svelte-markdown'
  import type { Message, Model, Chat } from './Types.svelte'
  import Fa from 'svelte-fa/src/fa.svelte'
  import { faTrash, faDiagramPredecessor, faDiagramNext, faCircleCheck, faPaperPlane, faEye, faEyeSlash, faEllipsis, faDownload, faClipboard, faPenToSquare, faSquareRootVariable } from '@fortawesome/free-solid-svg-icons/index'
  import { errorNotice, scrollToMessage } from './Util.svelte'
  import { openModal } from 'svelte-modals'
  import PromptConfirm from './PromptConfirm.svelte'
  import { getImage } from './ImageStore.svelte'
  import { getModelDetail } from './Models.svelte'
  import renderMathInElement from 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/contrib/auto-render.mjs'
  
  export let message:Message
  export let chatId:string
  export let chat:Chat

  $: chatSettings = chat.settings

  const isError = message.role === 'error'
  const isSystem = message.role === 'system'
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isImage = message.role === 'image'

  // Marked options
  const markdownOptions = {
    gfm: true, // Use GitHub Flavored Markdown
    breaks: true, // Enable line breaks in markdown
    mangle: false // Do not mangle email addresses
  }
  
  const renderers = {
    code: Code,
    codespan: Codespan
  }

  const getDisplayMessage = ():string => {
    const content = message.content
    if (isSystem && chatSettings.hideSystemPrompt) {
      const result = content.match(/::NOTE::[\s\S]+?::NOTE::/g)
      return result ? result.map(r => r.replace(/::NOTE::([\s\S]+?)::NOTE::/, '$1')).join('') : '(hidden)'
    }
    return content
  }

  const dispatch = createEventDispatcher()
  let editing = false
  let original:string
  let defaultModel:Model
  let imageUrl:string
  let refreshCounter = 0
  let displayMessage = message.content

  onMount(() => {
    defaultModel = chatSettings.model
    if (message?.image) {
      getImage(message.image.id).then(i => {
        imageUrl = 'data:image/png;base64, ' + i.b64image
      })
    }
    displayMessage = getDisplayMessage()
  })

  afterUpdate(() => {
    if (message.streaming && message.content.slice(-5).includes('```')) refreshCounter++
    displayMessage = getDisplayMessage()
  })

  const edit = () => {
    if (message.summarized || message.streaming || editing) return
    editing = true
    original = message.content
    setTimeout(() => {
      const el = document.getElementById('edit-' + message.uuid)
      el && el.focus()
    }, 0)
  }

  let dbnc
  const update = () => {
    clearTimeout(dbnc)
    dbnc = setTimeout(() => { doChange() }, 250)
  }

  const doChange = () => {
    if (message.content !== original) {
      dispatch('change', message)
      updateMessages(chatId)
    }
  }

  const continueIncomplete = () => {
    editing = false
    truncateFromMessage(chatId, message.uuid)
    $continueMessage = message.uuid
  }

  const exit = () => {
    doChange()
    editing = false
  }

  const keydown = (event:KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (!editing) return
      event.stopPropagation()
      event.preventDefault()
      message.content = original
      editing = false
    }
    if (event.ctrlKey && event.key === 'Enter') {
      if (!editing) return
      event.stopPropagation()
      event.preventDefault()
      exit()
      checkTruncate()
      setTimeout(checkTruncate, 10)
    }
  }

  // Double click for mobile support
  let lastTap: number = 0
  const editOnDoubleTap = () => {
    const now: number = new Date().getTime()
    const timesince: number = now - lastTap
    if ((timesince < 400) && (timesince > 0)) {
      edit()
    }
    lastTap = new Date().getTime()
  }

  let waitingForDeleteConfirm:any = 0

  const checkDelete = () => {
    clearTimeout(waitingForTruncateConfirm); waitingForTruncateConfirm = 0
    if (!waitingForDeleteConfirm) {
      // wait a second for another click to avoid accidental deletes
      waitingForDeleteConfirm = setTimeout(() => { waitingForDeleteConfirm = 0 }, 1000)
      return
    }
    clearTimeout(waitingForDeleteConfirm)
    waitingForDeleteConfirm = 0
    if (message.summarized) {
      // is in a summary, so we're summarized
      errorNotice('Sorry, you can\'t delete a summarized message')
      return
    }
    if (message.summary) {
      // We're linked to messages we're a summary of
      openModal(PromptConfirm, {
        title: 'Delete Summary',
        message: '<p>Are you sure you want to delete this summary?</p><p>Your session may be too long to submit again after you do.</p>',
        asHtml: true,
        class: 'is-warning',
        confirmButtonClass: 'is-warning',
        confirmButton: 'Delete Summary',
        onConfirm: () => {
          try {
            deleteSummaryMessage(chatId, message.uuid)
          } catch (e) {
            errorNotice('Unable to delete summary:', e)
          }
        }
      })
    } else {
      try {
        deleteMessage(chatId, message.uuid)
      } catch (e) {
        errorNotice('Unable to delete:', e)
      }
    }
  }

  const takeReason = (msg) => {
    if (isAssistant) {
      const regex = /<think>([\s\S]*?)<\/think>/
      const match = msg.match(regex)
  
      if (match) {
        message.reason = match[1]
        msg = msg.replace(regex, '')
      }
    } else {
      message.reason = ''
    }
    return msg
  }

  let waitingForTruncateConfirm:any = 0

  // Clean up timers to prevent memory leaks
  onDestroy(() => {
    if (dbnc) {
      clearTimeout(dbnc)
      dbnc = null
    }
    if (waitingForDeleteConfirm) {
      clearTimeout(waitingForDeleteConfirm)
      waitingForDeleteConfirm = null
    }
    if (waitingForTruncateConfirm) {
      clearTimeout(waitingForTruncateConfirm)
      waitingForTruncateConfirm = null
    }
  })

  const checkTruncate = () => {
    clearTimeout(waitingForDeleteConfirm); waitingForDeleteConfirm = 0
    if (!waitingForTruncateConfirm) {
      // wait a second for another click to avoid accidental deletes
      waitingForTruncateConfirm = setTimeout(() => { waitingForTruncateConfirm = 0 }, 1000)
      return
    }
    clearTimeout(waitingForTruncateConfirm)
    waitingForTruncateConfirm = 0
    if (message.summarized) {
      // is in a summary, so we're summarized
      errorNotice('Sorry, you can\'t truncate a summarized message')
      return
    }
    try {
      truncateFromMessage(chatId, message.uuid)
      $submitExitingPromptsNow = true
    } catch (e) {
      errorNotice('Unable to delete:', e)
    }
  }

  const setSuppress = (value:boolean) => {
    if (message.summarized) {
      // is in a summary, so we're summarized
      errorNotice('Sorry, you can\'t suppress a summarized message')
      return
    }
    message.suppress = value
    updateMessages(chatId)
  }

  const downloadImage = () => {
    const filename = (message?.content || `${chat.name}-image-${message?.image?.id}`)
      .replace(/([^a-z0-9- ]|\.)+/gi, '_').trim().slice(0, 80)
    const a = document.createElement('a')
    a.download = `${filename}.png`
    a.href = imageUrl
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

const replaceLatexDelimiters = (text: string): string => {
    let result = ''
    let i = 0

    while (i < text.length) {
    // Check for display math: $$ ... $$
      if (text.startsWith('$$aaaaaaaa', i)) {
        const endPos = text.indexOf('$$', i + 2)
        if (endPos === -1) {
          console.error(`LaTeX: Delimiter mismatch (missing $$) at position ${i}`)
          result += text[i]
          i++
        } else {
        // Wrap in backticks for KaTeX
          result += `\`\\[${text.slice(i + 2, endPos)}\\]\``
          i = endPos + 2
        }
      }
      // Check for inline math: $ ... $
      else if (text.startsWith('$aaaaaaaaa', i)) {
        const endPos = text.indexOf('$', i + 1)
        if (endPos === -1) {
          console.error(`LaTeX: Delimiter mismatch (missing $) at position ${i}`)
          result += text[i]
          i++
        } else {
          result += `\`$${text.slice(i + 1, endPos)}$\``
          i = endPos + 1
        }
      }
      // Check for inline math: \(...\)
      else if (text.startsWith('\\(', i)) {
        const endPos = text.indexOf('\\)', i + 2)
        if (endPos === -1) {
          console.error(`LaTeX: Delimiter mismatch (missing \\)) at position ${i}`)
          result += text[i]
          i++
        } else {
          result += '`\\(' + text.slice(i + 2, endPos) + '\\)`'
          i = endPos + 2
        }
      }
      // Check for display math: \[...\]
      else if (text.startsWith('\\[', i)) {
        const endPos = text.indexOf('\\]', i + 2)
        if (endPos === -1) {
          console.error(`LaTeX: Delimiter mismatch (missing \\]) at position ${i}`)
          result += text[i]
          i++
        } else {
          result += `\`\\[${text.slice(i + 2, endPos)}\\]\``
          i = endPos + 2
        }
      }
      // Otherwise, just copy the current character (also handling backslash escapes)
      else {
        if (text.startsWith('\\(', i)) {
          result += '\\('
          i += 2
        } else if (text.startsWith('\\)', i)) {
          result += '\\)'
          i += 2
        } else if (text.startsWith('\\[', i)) {
          result += '\\['
          i += 2
        } else if (text.startsWith('\\]', i)) {
          result += '\\]'
          i += 2
        } else {
          result += text[i]
          i++
        }
      }
    }
    return result
}


  const renderMathMsg = () => {
    displayMessage = replaceLatexDelimiters(message.content)
  }

</script>

<article
  id="{'message-' + message.uuid}"
  class="message chat-message" 
  class:is-info={isUser}
  class:is-success={isAssistant || isImage}
  class:is-warning={isSystem}
  class:is-danger={isError}
  class:user-message={isUser || isSystem}
  class:assistant-message={isError || isAssistant || isImage}
  class:summarized={message.summarized}
  class:suppress={message.suppress} 
  class:editing={editing}
  class:streaming={message.streaming}
  class:incomplete={message.finish_reason === 'length'}
>
  <div class="message-body content">
 
    {#if editing}
      <form class="message-edit" on:submit|preventDefault={update} on:keydown={keydown}>
        <div id={'edit-' + message.uuid} class="message-editor" bind:innerText={message.content} contenteditable
        on:input={update} on:blur={exit} />
      </form>
        {#if imageUrl}
          <img src={imageUrl} alt="">
        {/if}
    {:else}
      <div 
        class="message-display" 
          on:touchend={editOnDoubleTap}
          on:dblclick|preventDefault={() => { if (isUser) { edit() } }}
        >
        {#if message.summary && !message.summary.length}
        <p><b>Summarizing...</b></p>
        {/if}
        {#key refreshCounter}
        {#if message.reason}
        <details>
          <summary>Reasoning..</summary>
            <div style="background-color:#333;padding:10px;">
              <SvelteMarkdown source={message.reason}/>
            </div>
        </details>
        <br/>
        {/if}
        <SvelteMarkdown 
          source={takeReason(replaceLatexDelimiters(displayMessage))}
          options={markdownOptions}
          renderers={renderers}
        />
        {/key}
        {#if imageUrl}
          <img src={imageUrl} alt="">
        {/if}
    </div>
    {/if}
    {#if isSystem}
      <p class="is-size-7 message-note">System Prompt</p>
    {:else if message.usage}
      <p class="is-size-7 message-note">
        <em>{getModelDetail(message.model || '').label || message.model || defaultModel}</em> using <span class="has-text-weight-bold">{message.usage.total_tokens}</span>
        tokens ~= <span class="has-text-weight-bold">${getPrice(message.usage, message.model || defaultModel).toFixed(6)}</span>
      </p>
    {/if}
  </div>
  <div class="tool-drawer-mask"></div>
  <div class="tool-drawer">
    <div class="button-pack">
      {#if message.finish_reason === 'length' || message.finish_reason === 'abort'}
      <a
        href={'#'}
        title="Continue "
        class="msg-incomplete button is-small"
        on:click|preventDefault={() => {
          continueIncomplete()
        }}
      >
      <span class="icon"><Fa icon={faEllipsis} /></span>
      </a>
      {/if}
      {#if message.summarized}
      <a
        href={'#'}
        title="Jump to summary"
        class="msg-summary button is-small"
        on:click|preventDefault={() => {
          scrollToMessage(message.summarized)
        }}
      >
      <span class="icon"><Fa icon={faDiagramNext} /></span>
      </a>
      {/if}
      {#if message.summary}
      <a
        href={'#'}
        title="Jump to summarized"
        class="msg-summarized button is-small"
        on:click|preventDefault={() => {
          scrollToMessage(message.summary)
        }}
      >
      <span class="icon"><Fa icon={faDiagramPredecessor} /></span>
      </a>
      {/if}
      {#if !isImage}
        <a
          href={'#'}
          title="Edit"
          class="msg-image button is-small"
          on:click|preventDefault={() => {
            edit()
          }}
        >
        <span class="icon"><Fa icon={faPenToSquare} /></span>
        </a>
      {/if}
      {#if !message.summarized}
      <a
        href={'#'}
        title="Delete this message"
        class="msg-delete button is-small"
        on:click|preventDefault={() => {
          checkDelete()
        }}
      >
      {#if waitingForDeleteConfirm}
      <span class="icon"><Fa icon={faCircleCheck} /></span>
      {:else}
      <span class="icon"><Fa icon={faTrash} /></span>
      {/if}
      </a>
      {/if}
      {#if !isImage && !message.summarized && !isError}
        <a
          href={'#'}
          title="Truncate from here and send"
          class="msg-truncate button is-small"
          on:click|preventDefault={() => {
            checkTruncate()
          }}
        >
        {#if waitingForTruncateConfirm}
        <span class="icon"><Fa icon={faCircleCheck} /></span>
        {:else}
        <span class="icon"><Fa icon={faPaperPlane} /></span>
        {/if}
        </a>
      {/if}
      {#if !isImage && !message.summarized && !isSystem && !isError}
        <a
          href={'#'}
          title={(message.suppress ? 'Uns' : 'S') + 'uppress message from submission'}
          class="msg-supress button is-small"
          on:click|preventDefault={() => {
            setSuppress(!message.suppress)
          }}
        >
        {#if message.suppress}
        <span class="icon"><Fa icon={faEye} /></span>
        {:else}
        <span class="icon"><Fa icon={faEyeSlash} /></span>
        {/if}
        </a>
      {/if}
      {#if !isImage}
        <a
          href={'#'}
          title="Copy to Clipboard"
          class="msg-image button is-small"
          on:click|preventDefault={() => {
            navigator.clipboard.writeText(message.content)
          }}
        >
        <span class="icon"><Fa icon={faClipboard} /></span>
        </a>
      {/if}
      <a
        href={'#'}
        title="Render LaTeX in message"
        class="button is-small"
        on:click|preventDefault={() => {
          renderMathMsg()
        }}
      >
      <span class="icon"><Fa icon={faSquareRootVariable} /></span>
      </a>
      {#if imageUrl}
        <a
          href={'#'}
          title="Download Image"
          class="msg-image button is-small"
          on:click|preventDefault={() => {
            downloadImage()
          }}
        >
        <span class="icon"><Fa icon={faDownload} /></span>
        </a>
      {/if}
      </div>

  </div>
</article>
