<script lang="ts">
  // Iterate messages
  import type { Message, Chat } from './Types.svelte'
  import { globalStorage } from './Storage.svelte'
  import EditMessage from './EditMessage.svelte'

  export let messages : Message[]
  export let chatId: string
  export let chat: Chat
  
  $: chatSettings = chat.settings

  // Pre-compute filtered messages to avoid complex filtering in template
  $: filteredMessages = messages.filter((message, i) => {
    const isHiddenSummarized = (message.summarized) && $globalStorage.hideSummarized
    const isHiddenSystemPrompt = i === 0 && message.role === 'system' && !chatSettings.useSystemPrompt
    return !isHiddenSummarized && !isHiddenSystemPrompt
  })

</script>

{#each filteredMessages as message}
  {#key message.uuid}<EditMessage bind:message={message} chatId={chatId} chat={chat} />{/key}
{/each}
