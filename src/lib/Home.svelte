<script lang="ts">
  import { apiKeyStorage, lastChatId, getChat, started, checkStateChange } from './Storage.svelte'
  import Footer from './Footer.svelte'
  import { replace } from 'svelte-spa-router'
  import { afterUpdate, onMount } from 'svelte'
  import { getApiBase, setApiBase } from './ApiUtil.svelte'
  import { set as setOpenAI } from './api/util.svelte'
  import { hasActiveModels } from './Models.svelte'

$: apiKey = $apiKeyStorage

let hasModels = hasActiveModels()

onMount(() => {
    if (!$started) {
      $started = true
      // console.log('started', apiKey, $lastChatId, getChat($lastChatId))
      if (hasActiveModels() && getChat($lastChatId)) {
        const chatId = $lastChatId
        $lastChatId = ''
        replace(`/chat/${chatId}`)
      }
    }
    $lastChatId = ''
})

afterUpdate(() => {
    hasModels = hasActiveModels()
    $checkStateChange++
})

</script>

<section class="section">
  <article class="message">
    <div class="message-body">
    <p class="mb-4">
      <strong><a href="https://github.com/Niek/chatgpt-web" target="_blank">ChatGPT-web</a></strong>
      is a simple one-page web interface to the OpenAI ChatGPT API. To use it, you need to register for
      <a href="https://platform.openai.com/account/api-keys" target="_blank" rel="noreferrer">an OpenAI API key</a>
      first. OpenAI bills per token (usage-based), which means it is a lot cheaper than
      <a href="https://openai.com/blog/chatgpt-plus" target="_blank" rel="noreferrer">ChatGPT Plus</a>, unless you use
      more than 10 million tokens per month. All messages are stored in your browser's local storage, so everything is
      <strong>private</strong>. You can also close the browser tab and come back later to continue the conversation.
    </p>
    <br>
    <style>
      .katex-version {display: none;}
      .katex-version::after {content:"0.10.2 or earlier";}
    </style>
    <span class="katex">
      <span class="katex-mathml">The KaTeX stylesheet is not loaded!</span>
      <span class="katex-version rule">KaTeX version:&nbsp;</span>
    </span>

    </div>
  </article>
  <article class="message" class:is-danger={!hasModels} class:is-warning={!apiKey} class:is-info={apiKey}>
    <div class="message-body">
      Set your OpenAI API key below:

      <form
        class="field has-addons has-addons-right"
        on:submit|preventDefault={(event) => {
          let val = ''
          if (event.target && event.target[0].value) {
            val = (event.target[0].value).trim()
          }
          setOpenAI({ apiKey: val })
          hasModels = hasActiveModels()
        }}
      >
        <p class="control is-expanded">
          <input
            aria-label="OpenAI API key"
            type="password"
            autocomplete="off"
            class="input"
            class:is-danger={!hasModels}
            class:is-warning={!apiKey} class:is-info={apiKey}
            value={apiKey}
          />
        </p>
        <p class="control">
          <button class="button is-info" type="submit">Save</button>
        </p>


      </form>

      {#if !apiKey}
        <p class:is-danger={!hasModels} class:is-warning={!apiKey}>
          Please enter your <a target="_blank" href="https://platform.openai.com/account/api-keys">OpenAI API key</a> above to use Open AI's ChatGPT API.
        </p>
      {/if}
    </div>
  </article>

  <article class="message is-danger">
    <div class="message-body">
        <p>Set OpenAI API Endpoint:</p>
        <form
          class="field has-addons has-addons-right"
          on:submit|preventDefault={(event) => {
            if (event.target && event.target[0].value) {
              setApiBase(event.target[0].value)
            } else {
              setApiBase('https://api.openai.com')
              event.target[0].value = 'https://api.openai.com'
            }
          }}
        >
          <p class="control is-expanded">
            <input
              aria-label="OpenAI API  Endpoint"
              type="text"
              class="input"
              placeholder="https://api.openai.com"
              value={getApiBase() || 'https://api.openai.com'}
            />
          </p>
          <p class="control">
            <button class="button is-info" type="submit">Save</button>
          </p>
        </form>
    </div>
  </article>
  {#if apiKey}
    <article class="message is-info">
      <div class="message-body">
        Select an existing chat on the sidebar, or
        <a href={'#/chat/new'}>create a new chat</a>
      </div>
    </article>
  {/if}
</section>
<Footer pin={true} />